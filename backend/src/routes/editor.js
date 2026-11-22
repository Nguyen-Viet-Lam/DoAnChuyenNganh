const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { canEditNovel } = require('../utils/permissions');
const { refreshChapter, summarizeSegments } = require('../services/chapterStateService');
const { listQaIssues, runQaForChapter } = require('../services/qaService');

const router = express.Router();

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

    if (!canEditNovel(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa chương này' });
    }

    const segments = chapter.segments || [];
    const summary = summarizeSegments(segments);
    const qa = await listQaIssues(chapter.id);

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
        summary,
        qa: { issues: qa.issues, summary: qa.summary },
        glossary: chapter.novel.glossaryTerms || [],
        segments,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải dữ liệu trình biên tập' });
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

    if (!canEditNovel(segment.chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đoạn này' });
    }

    const updateData = {};
    if (translatedText !== undefined) {
      if (typeof translatedText !== 'string') {
        return res.status(400).json({ message: 'Bản dịch phải là chuỗi văn bản' });
      }
      updateData.translatedText = translatedText;
      updateData.status = translatedText.trim() ? 'COMPLETED' : 'PENDING';
      updateData.errorMessage = null;
    }
    if (needsReview !== undefined) {
      updateData.needsReview = Boolean(needsReview);
    }

    const updated = await prisma.chapterSegment.update({
      where: { id },
      data: updateData,
    });

    const state = await refreshChapter(segment.chapterId);
    const qa = await runQaForChapter(segment.chapterId);

    return res.json({
      message: 'Lưu bản dịch đoạn thành công',
      data: updated,
      chapter: state.chapter,
      summary: state.summary,
      qa: qa ? { issues: qa.issues, summary: qa.summary } : null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lưu bản dịch đoạn' });
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

    if (!canEditNovel(segment.chapter.novel, req.user)) {
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
    return res.status(500).json({ message: 'Lỗi khi cập nhật trạng thái xem lại' });
  }
});

// 4. Xác nhận hoàn tất biên tập toàn chương (Chuyển sang REVIEWED)
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

    if (!canEditNovel(chapter.novel, req.user)) {
      return res.status(403).json({ message: 'Bạn không có quyền duyệt chương này' });
    }

    const segments = chapter.segments || [];
    if (segments.length === 0) {
      return res.status(400).json({ message: 'Chương chưa có đoạn nào để hoàn tất biên tập' });
    }

    const uncompleted = segments.filter((s) => s.status !== 'COMPLETED' || !s.translatedText?.trim());
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

    const qa = await runQaForChapter(chapter.id);
    const blockingIssues = qa.issues.filter((issue) => issue.severity === 'ERROR' && !issue.ignored);
    if (blockingIssues.length > 0) {
      return res.status(400).json({
        message: `Còn ${blockingIssues.length} lỗi QA bắt buộc phải sửa trước khi duyệt chương.`,
        qaSummary: qa.summary,
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
    return res.status(500).json({ message: 'Lỗi khi hoàn tất biên tập chương' });
  }
});

module.exports = router;

