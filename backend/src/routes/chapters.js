const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
const CHAPTER_STATUSES = new Set(['DRAFT', 'TRANSLATING', 'PARTIAL', 'TRANSLATED', 'REVIEWED', 'FAILED', 'PUBLISHED']);

// Helper đếm số từ
function countWords(str) {
  if (!str) return 0;
  return str.trim().split(/\s+/).length;
}

// Lấy danh sách chương của một tiểu thuyết
router.get('/novels/:novelId/chapters', authenticate, async (req, res) => {
  const { novelId } = req.params;

  try {
    const novel = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true, title: true, uploaderId: true },
    });

    if (!novel) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }
    if (novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xem danh sách chương của truyện này' });
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
    return res.status(500).json({ message: 'Lỗi khi tải danh sách chương' });
  }
});

// Lấy nội dung chi tiết một chương
router.get('/chapters/:id', authenticate, async (req, res) => {
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
    if (chapter.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xem chương này' });
    }

    return res.json({ data: chapter });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết chương' });
  }
});

// Thêm chương mới cho tiểu thuyết
router.post('/novels/:novelId/chapters', authenticate, async (req, res) => {
  const { novelId } = req.params;
  const { chapterNumber, title, originalContent, translatedContent, status = 'DRAFT' } = req.body;

  if (!title || !originalContent) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tiêu đề và nội dung gốc của chương' });
  }
  if (chapterNumber !== undefined && (!Number.isInteger(Number(chapterNumber)) || Number(chapterNumber) < 1)) {
    return res.status(400).json({ message: 'Số chương phải là số nguyên dương' });
  }
  if (!CHAPTER_STATUSES.has(status)) {
    return res.status(400).json({ message: 'Trạng thái chương không hợp lệ' });
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
        chapterNumber: Number(targetChapterNumber),
        title: title.trim(),
        originalContent: originalContent.trim(),
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
    return res.status(500).json({ message: 'Lỗi khi tạo chương' });
  }
});

// Cập nhật chương (nội dung gốc, bản dịch, tiêu đề, trạng thái)
router.put('/chapters/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { chapterNumber, title, originalContent, translatedContent, status } = req.body;

  if (chapterNumber !== undefined && (!Number.isInteger(Number(chapterNumber)) || Number(chapterNumber) < 1)) {
    return res.status(400).json({ message: 'Số chương phải là số nguyên dương' });
  }
  if (status !== undefined && !CHAPTER_STATUSES.has(status)) {
    return res.status(400).json({ message: 'Trạng thái chương không hợp lệ' });
  }

  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        novel: { select: { uploaderId: true } },
        _count: { select: { segments: true } },
      },
    });

    if (!chapter) {
      return res.status(404).json({ message: 'Không tìm thấy chương' });
    }

    if (chapter.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa chương này' });
    }
    if (
      originalContent !== undefined
      && originalContent.trim() !== chapter.originalContent.trim()
      && chapter._count.segments > 0
    ) {
      return res.status(409).json({
        message: 'Không thể đổi nội dung gốc sau khi đã chia đoạn. Hãy dùng chức năng chia lại khi dịch chương.',
      });
    }

    const updateData = {};
    if (chapterNumber !== undefined) updateData.chapterNumber = Number(chapterNumber);
    if (title !== undefined) updateData.title = String(title).trim();
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
    return res.status(500).json({ message: 'Lỗi khi cập nhật chương' });
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
    return res.status(500).json({ message: 'Lỗi khi xóa chương' });
  }
});

module.exports = router;
