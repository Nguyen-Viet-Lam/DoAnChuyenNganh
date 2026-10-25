const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { translateChapterText } = require('../services/geminiService');

const router = express.Router({ mergeParams: true });

// Helper đếm số từ
function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).length;
}

// Lấy danh sách chương của một tiểu thuyết
router.get('/novels/:novelId/chapters', async (req, res) => {
  const { novelId } = req.params;

  try {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true, title: true, uploaderId: true },
    });

    if (!novel) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }

    const chapters = await prisma.chapter.findMany({
      where: { novelId },
      select: {
        id: true,
        chapterNumber: true,
        title: true,
        status: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { chapterNumber: 'asc' },
    });

    return res.json({ data: chapters });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải danh sách chương', error: error.message });
  }
});

// Lấy nội dung chi tiết một chương
router.get('/chapters/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        novel: {
          select: {
            id: true,
            title: true,
            uploaderId: true,
            sourceLanguage: true,
            targetLanguage: true,
          },
        },
      },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }

    return res.json({ data: chapter });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết chương', error: error.message });
  }
});

// Thêm chương mới cho tiểu thuyết
router.post('/novels/:novelId/chapters', authenticate, async (req, res) => {
  const { novelId } = req.params;
  const { chapterNumber, title, originalContent, translatedContent, status = 'DRAFT' } = req.body;

  if (!title || !originalContent) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tiêu đề và nội dung gốc của chương' });
  }

  try {
    const novel = await prisma.novel.findUnique({ where: { id: novelId } });
    if (!novel) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }

    if (novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền thêm chương cho bộ truyện này' });
    }

    // Tự động tính số thứ tự chương nếu không truyền
    let targetChapterNumber = chapterNumber;
    if (!targetChapterNumber) {
      const lastChapter = await prisma.chapter.findFirst({
        where: { novelId },
        orderBy: { chapterNumber: 'desc' },
      });
      targetChapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
    }

    const wordCount = countWords(originalContent);

    const chapter = await prisma.chapter.create({
      data: {
        novelId,
        chapterNumber: targetChapterNumber,
        title,
        originalContent,
        translatedContent,
        status,
        wordCount,
      },
    });

    return res.status(201).json({ message: 'Tạo chương thành công', data: chapter });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: `Chương số ${chapterNumber} đã tồn tại trong truyện này` });
    }
    return res.status(500).json({ message: 'Lỗi khi tạo chương', error: error.message });
  }
});

// Cập nhật chương (nội dung gốc, bản dịch, tiêu đề, trạng thái)
router.put('/chapters/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { chapterNumber, title, originalContent, translatedContent, status } = req.body;

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: { novel: { select: { uploaderId: true } } },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }

    if (chapter.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa chương này' });
    }

    const updateData = {};
    if (chapterNumber !== undefined) updateData.chapterNumber = chapterNumber;
    if (title !== undefined) updateData.title = title;
    if (originalContent !== undefined) {
      updateData.originalContent = originalContent;
      updateData.wordCount = countWords(originalContent);
    }
    if (translatedContent !== undefined) updateData.translatedContent = translatedContent;
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.chapter.update({
      where: { id },
      data: updateData,
    });

    return res.json({ message: 'Cập nhật chương thành công', data: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi cập nhật chương', error: error.message });
  }
});

// Xóa chương
router.delete('/chapters/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: { novel: { select: { uploaderId: true } } },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }

    if (chapter.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa chương này' });
    }

    await prisma.chapter.delete({ where: { id } });

    return res.json({ message: 'Đã xóa chương thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi xóa chương', error: error.message });
  }
});

// Kích hoạt AI Gemini dịch nội dung chương tự động
router.post('/chapters/:id/translate', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        novel: {
          select: {
            uploaderId: true,
            title: true,
            sourceLanguage: true,
            targetLanguage: true,
            description: true,
          },
        },
      },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }

    if (chapter.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện dịch chương này' });
    }

    if (!chapter.originalContent) {
      return res.status(400).json({ message: 'Chương chưa có nội dung gốc để dịch' });
    }

    // Đánh dấu trạng thái đang dịch
    await prisma.chapter.update({
      where: { id },
      data: { status: 'TRANSLATING' },
    });

    try {
      const translated = await translateChapterText({
        text: chapter.originalContent,
        sourceLang: chapter.novel.sourceLanguage,
        targetLang: chapter.novel.targetLanguage,
        context: `Truyện: ${chapter.novel.title}. ${chapter.novel.description || ''}`,
      });

      const updatedChapter = await prisma.chapter.update({
        where: { id },
        data: {
          translatedContent: translated,
          status: 'TRANSLATED',
        },
      });

      return res.json({
        message: 'Dịch chương bằng Gemini AI thành công',
        data: updatedChapter,
      });
    } catch (aiError) {
      // Revert lại trạng thái nếu AI bị lỗi
      await prisma.chapter.update({
        where: { id },
        data: { status: 'DRAFT' },
      });
      return res.status(502).json({
        message: 'Lỗi khi gọi Google Gemini API để dịch',
        error: aiError.message,
      });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi xử lý dịch chương', error: error.message });
  }
});

module.exports = router;
