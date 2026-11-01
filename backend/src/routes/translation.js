const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { translateChapterText, splitIntoSegments, STYLE_GUIDES } = require('../services/geminiService');

const router = express.Router();

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 200;
const MAX_SEGMENTS_PER_REQUEST = Number(process.env.AI_MAX_SEGMENTS_PER_REQUEST) || 20;
const MAX_CHAPTER_CHARS = Number(process.env.AI_MAX_CHAPTER_CHARS) || 50000;
const STALE_TRANSLATING_MS = 5 * 60 * 1000;

const novelSelect = {
  uploaderId: true,
  title: true,
  sourceLanguage: true,
  targetLanguage: true,
  description: true,
};

const canEdit = (novel, user) => novel.uploaderId === user.sub || user.role === 'ADMIN';

async function usedToday(userId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.aiUsageLog.count({ where: { userId, createdAt: { gte: start } } });
}

async function loadChapter(id) {
  return prisma.chapter.findUnique({ where: { id }, include: { novel: { select: novelSelect } } });
}

// Dịch một đoạn và lưu kết quả ngay, để lỗi giữa chừng không làm mất tiến độ
async function translateSegment(segment, chapter, userId, style) {
  await prisma.chapterSegment.update({
    where: { id: segment.id },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, errorMessage: null },
  });
  try {
    const translated = await translateChapterText({
      text: segment.originalText,
      sourceLang: chapter.novel.sourceLanguage,
      targetLang: chapter.novel.targetLanguage,
      style,
      context: `Truyện: ${chapter.novel.title}. ${chapter.novel.description || ''}`,
    });
    await prisma.chapterSegment.update({
      where: { id: segment.id },
      data: { translatedText: translated, status: 'COMPLETED', needsReview: false },
    });
    await prisma.aiUsageLog.create({
      data: { userId, chapterId: chapter.id, segmentId: segment.id, success: true },
    });
    return { ok: true };
  } catch (err) {
    await prisma.chapterSegment.update({
      where: { id: segment.id },
      data: { status: 'FAILED', errorMessage: err.message },
    });
    await prisma.aiUsageLog.create({
      data: { userId, chapterId: chapter.id, segmentId: segment.id, success: false },
    });
    return { ok: false, error: err };
  }
}

// Tính lại trạng thái chương và gộp bản dịch theo đúng thứ tự đoạn
async function refreshChapter(chapterId) {
  const segments = await prisma.chapterSegment.findMany({
    where: { chapterId },
    orderBy: { orderIndex: 'asc' },
  });
  const done = segments.filter((s) => s.status === 'COMPLETED');

  let status;
  if (segments.length > 0 && done.length === segments.length) status = 'TRANSLATED';
  else if (done.length > 0) status = 'PARTIAL';
  else if (segments.some((s) => s.status === 'FAILED')) status = 'FAILED';
  else status = 'DRAFT';

  return prisma.chapter.update({
    where: { id: chapterId },
    data: {
      status,
      translatedContent: done.length ? done.map((s) => s.translatedText).join('\n\n') : null,
    },
  });
}

function summarize(segments) {
  const count = (st) => segments.filter((s) => s.status === st).length;
  const total = segments.length;
  const completed = count('COMPLETED');
  return {
    total,
    completed,
    failed: count('FAILED'),
    pending: count('PENDING'),
    processing: count('PROCESSING'),
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

// Danh sách phong cách dịch
router.get('/translation/styles', (req, res) => {
  res.json({ data: Object.keys(STYLE_GUIDES) });
});

// Số lượt gọi AI trong ngày
router.get('/translation/usage', authenticate, async (req, res) => {
  try {
    const used = await usedToday(req.user.sub);
    return res.json({ data: { used, limit: DAILY_LIMIT, remaining: Math.max(DAILY_LIMIT - used, 0) } });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải thống kê lượt gọi AI', error: error.message });
  }
});

// Xem các đoạn và tiến độ dịch của chương
router.get('/chapters/:id/segments', authenticate, async (req, res) => {
  try {
    const chapter = await loadChapter(req.params.id);
    if (!chapter) return res.status(404).json({ message: 'Không tìm thấy chương' });
    if (!canEdit(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền xem bản dịch của chương này' });
    }
    const segments = await prisma.chapterSegment.findMany({
      where: { chapterId: chapter.id },
      orderBy: { orderIndex: 'asc' },
    });
    return res.json({ chapterStatus: chapter.status, progress: summarize(segments), data: segments });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải các đoạn dịch', error: error.message });
  }
});

/**
 * Dịch chương theo từng đoạn. Gọi lại endpoint này để tiếp tục phần còn lại:
 * đoạn đã COMPLETED không bị dịch lại. body: { style, resegment }
 */
router.post('/chapters/:id/translate', authenticate, async (req, res) => {
  const { style = 'natural', resegment = false } = req.body || {};
  if (!STYLE_GUIDES[style]) {
    return res.status(400).json({ message: `Phong cách không hợp lệ. Chọn: ${Object.keys(STYLE_GUIDES).join(', ')}` });
  }

  try {
    const chapter = await loadChapter(req.params.id);
    if (!chapter) return res.status(404).json({ message: 'Không tìm thấy chương' });
    if (!canEdit(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện dịch chương này' });
    }
    if (!chapter.originalContent?.trim()) {
      return res.status(400).json({ message: 'Chương chưa có nội dung gốc để dịch' });
    }
    if (chapter.originalContent.length > MAX_CHAPTER_CHARS) {
      return res.status(413).json({ message: `Chương vượt quá giới hạn ${MAX_CHAPTER_CHARS} ký tự` });
    }
    if (chapter.status === 'TRANSLATING' && Date.now() - chapter.updatedAt.getTime() < STALE_TRANSLATING_MS) {
      return res.status(409).json({ message: 'Chương đang được dịch, vui lòng chờ' });
    }

    // Chia đoạn lần đầu (hoặc chia lại theo yêu cầu, sẽ mất bản dịch cũ)
    let segments = await prisma.chapterSegment.findMany({
      where: { chapterId: chapter.id },
      orderBy: { orderIndex: 'asc' },
    });
    if (resegment || segments.length === 0) {
      const parts = splitIntoSegments(chapter.originalContent);
      await prisma.$transaction([
        prisma.chapterSegment.deleteMany({ where: { chapterId: chapter.id } }),
        prisma.chapterSegment.createMany({
          data: parts.map((originalText, orderIndex) => ({ chapterId: chapter.id, orderIndex, originalText })),
        }),
      ]);
      segments = await prisma.chapterSegment.findMany({
        where: { chapterId: chapter.id },
        orderBy: { orderIndex: 'asc' },
      });
    }

    // Đoạn kẹt ở PROCESSING (server sập giữa chừng) được xử lý như chưa dịch
    const todo = segments.filter((s) => s.status !== 'COMPLETED');
    if (todo.length === 0) {
      return res.json({ message: 'Tất cả các đoạn đã được dịch', progress: summarize(segments), data: chapter });
    }

    const remainingQuota = DAILY_LIMIT - (await usedToday(req.user.sub));
    if (remainingQuota <= 0) {
      return res.status(429).json({ message: `Đã đạt giới hạn ${DAILY_LIMIT} lượt gọi AI trong ngày` });
    }
    const batch = todo.slice(0, Math.min(MAX_SEGMENTS_PER_REQUEST, remainingQuota));

    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { status: 'TRANSLATING', translationStyle: style },
    });

    // Dịch tuần tự theo thứ tự; dừng ở lỗi đầu tiên (hết hạn mức, mất mạng...) để không gọi API vô ích
    let stopReason = null;
    for (const segment of batch) {
      const result = await translateSegment(segment, chapter, req.user.sub, style);
      if (!result.ok) {
        stopReason = result.error.message;
        break;
      }
    }

    const updated = await refreshChapter(chapter.id);
    const progress = summarize(await prisma.chapterSegment.findMany({ where: { chapterId: chapter.id } }));

    if (stopReason) {
      return res.status(502).json({
        message: `Dịch bị gián đoạn: ${stopReason}. Gọi lại để tiếp tục từ các đoạn còn lại`,
        progress,
        data: updated,
      });
    }
    return res.json({
      message:
        progress.completed < progress.total
          ? `Đã dịch ${batch.length} đoạn, còn ${progress.total - progress.completed} đoạn. Gọi lại để tiếp tục`
          : 'Dịch chương bằng Gemini AI thành công. Vui lòng kiểm tra bản dịch trước khi xuất bản',
      progress,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi xử lý dịch chương', error: error.message });
  }
});

// Dịch lại một đoạn được chọn
router.post('/segments/:id/retranslate', authenticate, async (req, res) => {
  const { style } = req.body || {};
  if (style && !STYLE_GUIDES[style]) {
    return res.status(400).json({ message: 'Phong cách dịch không hợp lệ' });
  }

  try {
    const segment = await prisma.chapterSegment.findUnique({ where: { id: req.params.id } });
    if (!segment) return res.status(404).json({ message: 'Không tìm thấy đoạn' });

    const chapter = await loadChapter(segment.chapterId);
    if (!canEdit(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền dịch lại đoạn này' });
    }
    if ((await usedToday(req.user.sub)) >= DAILY_LIMIT) {
      return res.status(429).json({ message: `Đã đạt giới hạn ${DAILY_LIMIT} lượt gọi AI trong ngày` });
    }

    const result = await translateSegment(segment, chapter, req.user.sub, style || chapter.translationStyle || 'natural');
    await refreshChapter(chapter.id);
    const fresh = await prisma.chapterSegment.findUnique({ where: { id: segment.id } });

    if (!result.ok) {
      return res.status(502).json({ message: 'Dịch lại đoạn thất bại', error: result.error.message, data: fresh });
    }
    return res.json({ message: 'Đã dịch lại đoạn', data: fresh });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi dịch lại đoạn', error: error.message });
  }
});

module.exports = router;
