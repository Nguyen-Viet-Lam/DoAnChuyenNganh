const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { translateChapterText } = require('../services/geminiService');

const router = express.Router();

// Helper kiểm tra quyền chỉnh sửa
function canEdit(novel, user) {
  return novel.uploaderId === user.sub || user.role === 'ADMIN';
}

// 1. Lấy toàn bộ dữ liệu phục vụ Trình biên tập song ngữ của một chương
router.get('/chapters/:id/editor', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        novel: {
          select: {
            id: true,
            title: true,
            originalTitle: true,
            sourceLanguage: true,
            targetLanguage: true,
            uploaderId: true,
            glossaryTerms: {
              select: {
                id: true,
                originalTerm: true,
                vietnameseTerm: true,
                category: true,
                notes: true,
              },
              orderBy: { originalTerm: 'asc' },
            },
          },
        },
        segments: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương truyện' });
    }

    if (!canEdit(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa chương này' });
    }

    const segments = chapter.segments || [];
    const total = segments.length;
    const completed = segments.filter((s) => s.status === 'COMPLETED').length;
    const needsReview = segments.filter((s) => s.needsReview).length;
    const failed = segments.filter((s) => s.status === 'FAILED').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return res.json({
      data: {
        chapter: {
          id: chapter.id,
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          status: chapter.status,
          wordCount: chapter.wordCount,
          translationStyle: chapter.translationStyle,
          createdAt: chapter.createdAt,
          updatedAt: chapter.updatedAt,
        },
        novel: {
          id: chapter.novel.id,
          title: chapter.novel.title,
          originalTitle: chapter.novel.originalTitle,
          sourceLanguage: chapter.novel.sourceLanguage,
          targetLanguage: chapter.novel.targetLanguage,
        },
        summary: {
          total,
          completed,
          needsReview,
          failed,
          percent,
        },
        glossary: chapter.novel.glossaryTerms || [],
        segments,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải dữ liệu trình biên tập', error: error.message });
  }
});

// 2. Chỉnh sửa trực tiếp bản dịch của một đoạn (Hỗ trợ Auto-save nháp)
router.put('/segments/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { translatedText, needsReview } = req.body;

  try {
    const segment = await prisma.chapterSegment.findUnique({
      where: { id },
      include: {
        chapter: {
          include: { novel: { select: { uploaderId: true } } },
        },
      },
    });

    if (!segment) {
      return res.status(404).json({ message: 'Không tìm thấy đoạn dịch' });
    }

    if (!canEdit(segment.chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đoạn này' });
    }

    const updateData = {};
    if (translatedText !== undefined) {
      updateData.translatedText = translatedText;
      updateData.status = 'COMPLETED';
      updateData.errorMessage = null;
    }
    if (needsReview !== undefined) {
      updateData.needsReview = Boolean(needsReview);
    }

    const updated = await prisma.chapterSegment.update({
      where: { id },
      data: updateData,
    });

    // Đồng bộ lại nội dung tổng thể của chương
    const allSegments = await prisma.chapterSegment.findMany({
      where: { chapterId: segment.chapterId },
      orderBy: { orderIndex: 'asc' },
    });
    const completedSegments = allSegments.filter((s) => s.status === 'COMPLETED');

    let chapterStatus = segment.chapter.status;
    if (chapterStatus !== 'REVIEWED' && chapterStatus !== 'PUBLISHED') {
      if (allSegments.length > 0 && completedSegments.length === allSegments.length) {
        chapterStatus = 'TRANSLATED';
      } else if (completedSegments.length > 0) {
        chapterStatus = 'PARTIAL';
      }
    }

    await prisma.chapter.update({
      where: { id: segment.chapterId },
      data: {
        status: chapterStatus,
        translatedContent: completedSegments.map((s) => s.translatedText || '').join('\n\n'),
      },
    });

    return res.json({
      message: 'Lưu bản dịch đoạn thành công',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lưu bản dịch đoạn', error: error.message });
  }
});

// 3. Đánh dấu / Bỏ đánh dấu đoạn cần xem lại (Toggle needsReview)
router.put('/segments/:id/toggle-review', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const segment = await prisma.chapterSegment.findUnique({
      where: { id },
      include: {
        chapter: {
          include: { novel: { select: { uploaderId: true } } },
        },
      },
    });

    if (!segment) {
      return res.status(404).json({ message: 'Không tìm thấy đoạn' });
    }

    if (!canEdit(segment.chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền thao tác' });
    }

    const updated = await prisma.chapterSegment.update({
      where: { id },
      data: { needsReview: !segment.needsReview },
    });

    return res.json({
      message: updated.needsReview ? 'Đã đánh dấu cần xem lại' : 'Đã bỏ đánh dấu cần xem lại',
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái xem lại', error: error.message });
  }
});

// 4. Dịch lại riêng một đoạn được chọn bằng Gemini AI
router.post('/segments/:id/retranslate', authenticate, async (req, res) => {
  const { id } = req.params;
  const { style } = req.body;

  try {
    const segment = await prisma.chapterSegment.findUnique({
      where: { id },
      include: {
        chapter: {
          include: {
            novel: {
              select: {
                id: true,
                uploaderId: true,
                title: true,
                description: true,
                sourceLanguage: true,
                targetLanguage: true,
                glossaryTerms: true,
              },
            },
          },
        },
      },
    });

    if (!segment) {
      return res.status(404).json({ message: 'Không tìm thấy đoạn cần dịch' });
    }

    const novel = segment.chapter.novel;
    if (!canEdit(novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện dịch đoạn này' });
    }

    // Đánh dấu đang xử lý
    await prisma.chapterSegment.update({
      where: { id },
      data: { status: 'PROCESSING', attempts: { increment: 1 }, errorMessage: null },
    });

    // Lọc thuật ngữ liên quan xuất hiện trong đoạn
    const relevantGlossary = (novel.glossaryTerms || []).filter((term) => {
      if (!term.originalTerm) return false;
      if (novel.sourceLanguage === 'en') {
        const regex = new RegExp(`\\b${term.originalTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(segment.originalText);
      }
      return segment.originalText.includes(term.originalTerm);
    });

    const chosenStyle = style || segment.chapter.translationStyle || 'natural';

    try {
      const translated = await translateChapterText({
        text: segment.originalText,
        sourceLang: novel.sourceLanguage,
        targetLang: novel.targetLanguage,
        style: chosenStyle,
        context: `Truyện: ${novel.title}. ${novel.description || ''}`,
        glossary: relevantGlossary,
      });

      const updated = await prisma.chapterSegment.update({
        where: { id },
        data: {
          translatedText: translated,
          status: 'COMPLETED',
          needsReview: false,
          errorMessage: null,
        },
      });

      // Ghi log AI usage
      await prisma.aiUsageLog.create({
        data: {
          userId: req.user.sub,
          chapterId: segment.chapterId,
          segmentId: segment.id,
          success: true,
        },
      });

      return res.json({
        message: 'Dịch lại đoạn thành công',
        data: updated,
      });
    } catch (aiErr) {
      await prisma.chapterSegment.update({
        where: { id },
        data: { status: 'FAILED', errorMessage: aiErr.message },
      });

      await prisma.aiUsageLog.create({
        data: {
          userId: req.user.sub,
          chapterId: segment.chapterId,
          segmentId: segment.id,
          success: false,
        },
      });

      return res.status(502).json({
        message: 'Lỗi khi gọi AI dịch lại đoạn',
        error: aiErr.message,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi hệ thống khi dịch lại đoạn', error: error.message });
  }
});

// 5. Xác nhận hoàn tất biên tập toàn chương (Chuyển sang REVIEWED)
router.post('/chapters/:id/complete-review', authenticate, async (req, res) => {
  const { id } = req.params;
  const { force } = req.body; // force = true cho phép duyệt dù còn đoạn needsReview

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        novel: { select: { uploaderId: true } },
        segments: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương truyện' });
    }

    if (!canEdit(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền duyệt chương này' });
    }

    const segments = chapter.segments || [];
    if (segments.length === 0) {
      return res.status(400).json({ message: 'Chương chưa có đoạn nào để hoàn tất biên tập' });
    }

    const uncompleted = segments.filter((s) => s.status !== 'COMPLETED');
    if (uncompleted.length > 0) {
      return res.status(400).json({
        message: `Còn ${uncompleted.length} đoạn chưa hoàn thành bản dịch. Vui lòng hoàn tất trước khi duyệt.`,
      });
    }

    const flagged = segments.filter((s) => s.needsReview);
    if (flagged.length > 0 && !force) {
      return res.status(400).json({
        message: `Còn ${flagged.length} đoạn đang được đánh dấu "Cần xem lại". Hãy xử lý hoặc chọn xác nhận bỏ qua để duyệt.`,
        flaggedCount: flagged.length,
      });
    }

    // Gộp toàn bộ bản dịch theo đúng thứ tự
    const fullTranslation = segments.map((s) => s.translatedText || '').join('\n\n');

    const updatedChapter = await prisma.chapter.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        translatedContent: fullTranslation,
      },
    });

    return res.json({
      message: 'Đã xác nhận hoàn tất biên tập chương thành công',
      data: updatedChapter,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi hoàn tất biên tập chương', error: error.message });
  }
});

module.exports = router;

