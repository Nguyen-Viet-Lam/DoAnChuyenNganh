const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Lấy danh sách tiểu thuyết (có phân trang, tìm kiếm, lọc)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const { q, status, genreId, sourceLanguage } = req.query;

    const where = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { originalTitle: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (sourceLanguage) {
      where.sourceLanguage = sourceLanguage;
    }

    if (genreId) {
      where.genres = {
        some: { genreId },
      };
    }

    const [total, novels] = await Promise.all([
      prisma.novel.count({ where }),
      prisma.novel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          uploader: {
            select: { id: true, displayName: true, email: true },
          },
          genres: {
            include: {
              genre: true,
            },
          },
          _count: {
            select: { chapters: true },
          },
        },
      }),
    ]);

    const formattedNovels = novels.map((novel) => ({
      ...novel,
      genres: novel.genres.map((g) => g.genre),
      totalChapters: novel._count.chapters,
    }));

    return res.json({
      data: formattedNovels,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải danh sách tiểu thuyết', error: error.message });
  }
});

// Lấy chi tiết một tiểu thuyết theo ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const novel = await prisma.novel.findUnique({
      where: { id },
      include: {
        uploader: {
          select: { id: true, displayName: true, email: true },
        },
        genres: {
          include: {
            genre: true,
          },
        },
        chapters: {
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
        },
      },
    });

    if (!novel) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }

    return res.json({
      data: {
        ...novel,
        genres: novel.genres.map((g) => g.genre),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết tiểu thuyết', error: error.message });
  }
});

// Tạo tiểu thuyết mới (yêu cầu đăng nhập)
router.post('/', authenticate, async (req, res) => {
  const {
    title,
    originalTitle,
    author,
    description,
    coverUrl,
    sourceLanguage = 'zh',
    targetLanguage = 'vi',
    status = 'ONGOING',
    genreIds = [],
  } = req.body;

  if (!title) {
    return res.status(400).json({ message: 'Tiêu đề tiểu thuyết không được để trống' });
  }

  try {
    const novel = await prisma.novel.create({
      data: {
        title,
        originalTitle,
        author,
        description,
        coverUrl,
        sourceLanguage,
        targetLanguage,
        status,
        uploaderId: req.user.sub,
        genres: {
          create: genreIds.map((genreId) => ({
            genre: { connect: { id: genreId } },
          })),
        },
      },
      include: {
        genres: {
          include: { genre: true },
        },
      },
    });

    return res.status(201).json({
      message: 'Tạo tiểu thuyết thành công',
      data: {
        ...novel,
        genres: novel.genres.map((g) => g.genre),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tạo tiểu thuyết', error: error.message });
  }
});

// Cập nhật thông tin tiểu thuyết (Chủ sở hữu hoặc ADMIN)
router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    originalTitle,
    author,
    description,
    coverUrl,
    sourceLanguage,
    targetLanguage,
    status,
    genreIds,
  } = req.body;

  try {
    const existing = await prisma.novel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }

    if (existing.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa bộ truyện này' });
    }

    const updateData = {
      ...(title !== undefined && { title }),
      ...(originalTitle !== undefined && { originalTitle }),
      ...(author !== undefined && { author }),
      ...(description !== undefined && { description }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(sourceLanguage !== undefined && { sourceLanguage }),
      ...(targetLanguage !== undefined && { targetLanguage }),
      ...(status !== undefined && { status }),
    };

    if (Array.isArray(genreIds)) {
      await prisma.novelGenre.deleteMany({ where: { novelId: id } });
      updateData.genres = {
        create: genreIds.map((genreId) => ({
          genre: { connect: { id: genreId } },
        })),
      };
    }

    const updated = await prisma.novel.update({
      where: { id },
      data: updateData,
      include: {
        genres: {
          include: { genre: true },
        },
      },
    });

    return res.json({
      message: 'Cập nhật tiểu thuyết thành công',
      data: {
        ...updated,
        genres: updated.genres.map((g) => g.genre),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi cập nhật tiểu thuyết', error: error.message });
  }
});

// Xóa tiểu thuyết (Chủ sở hữu hoặc ADMIN)
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.novel.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }

    if (existing.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa bộ truyện này' });
    }

    await prisma.novel.delete({ where: { id } });

    return res.json({ message: 'Đã xóa tiểu thuyết thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi xóa tiểu thuyết', error: error.message });
  }
});

module.exports = router;
