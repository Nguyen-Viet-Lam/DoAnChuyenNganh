const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['CHARACTER', 'LOCATION', 'SKILL', 'ITEM', 'REALM', 'OTHER'];

// Kiểm tra quyền sở hữu tiểu thuyết
async function checkNovelOwnership(novelId, user) {
  const novel = await prisma.novel.findUnique({
    where: { id: novelId },
    select: { id: true, uploaderId: true },
  });
  if (!novel) {
    const error = new Error('Không tìm thấy tiểu thuyết');
    error.status = 404;
    throw error;
  }
  if (novel.uploaderId !== user.sub && user.role !== 'ADMIN') {
    const error = new Error('Bạn không có quyền quản lý thuật ngữ của bộ truyện này');
    error.status = 403;
    throw error;
  }
  return novel;
}

// Lấy danh sách thuật ngữ của tiểu thuyết
// Hỗ trợ tìm kiếm (?q=), lọc loại (?category=), sắp xếp (?sortBy=)
router.get('/novels/:novelId/glossary', async (req, res) => {
  const { novelId } = req.params;
  const { q, category } = req.query;

  try {
    const novelExists = await prisma.novel.findUnique({
      where: { id: novelId },
      select: { id: true, title: true },
    });
    if (!novelExists) {
      return res.status(404).json({ message: 'Không tìm thấy tiểu thuyết' });
    }

    const where = { novelId };

    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
      where.category = category.toUpperCase();
    }

    if (q) {
      where.OR = [
        { originalTerm: { contains: q, mode: 'insensitive' } },
        { vietnameseTerm: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const terms = await prisma.glossaryTerm.findMany({
      where,
      orderBy: [{ category: 'asc' }, { originalTerm: 'asc' }],
    });

    // Thống kê số lượng theo từng danh mục
    const countsByCategory = terms.reduce((acc, term) => {
      acc[term.category] = (acc[term.category] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      data: terms,
      summary: {
        total: terms.length,
        byCategory: countsByCategory,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tải bảng thuật ngữ', error: error.message });
  }
});

// Thêm một thuật ngữ mới vào tiểu thuyết
router.post('/novels/:novelId/glossary', authenticate, async (req, res) => {
  const { novelId } = req.params;
  const { originalTerm, vietnameseTerm, category = 'CHARACTER', notes } = req.body;

  if (!originalTerm || !vietnameseTerm) {
    return res.status(400).json({ message: 'Vui lòng cung cấp từ gốc và từ dịch tiếng Việt' });
  }

  const cleanCategory = category.toUpperCase();
  if (!VALID_CATEGORIES.includes(cleanCategory)) {
    return res.status(400).json({
      message: `Danh mục không hợp lệ. Chỉ chấp nhận: ${VALID_CATEGORIES.join(', ')}`,
    });
  }

  try {
    await checkNovelOwnership(novelId, req.user);

    const existing = await prisma.glossaryTerm.findUnique({
      where: {
        novelId_originalTerm: {
          novelId,
          originalTerm: originalTerm.trim(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        message: `Thuật ngữ gốc "${originalTerm.trim()}" đã tồn tại trong bộ truyện này`,
      });
    }

    const term = await prisma.glossaryTerm.create({
      data: {
        novelId,
        originalTerm: originalTerm.trim(),
        vietnameseTerm: vietnameseTerm.trim(),
        category: cleanCategory,
        notes: notes ? notes.trim() : null,
      },
    });

    return res.status(201).json({
      message: 'Thêm thuật ngữ thành công',
      data: term,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

// Thêm hàng loạt thuật ngữ (Batch Import)
router.post('/novels/:novelId/glossary/batch', authenticate, async (req, res) => {
  const { novelId } = req.params;
  const { terms } = req.body;

  if (!Array.isArray(terms) || terms.length === 0) {
    return res.status(400).json({ message: 'Vui lòng gửi mảng danh sách thuật ngữ (terms)' });
  }

  try {
    await checkNovelOwnership(novelId, req.user);

    const created = [];
    const skipped = [];

    for (const item of terms) {
      if (!item.originalTerm || !item.vietnameseTerm) {
        skipped.push({ item, reason: 'Thiếu từ gốc hoặc từ dịch' });
        continue;
      }
      const cat = (item.category || 'CHARACTER').toUpperCase();
      const validCat = VALID_CATEGORIES.includes(cat) ? cat : 'CHARACTER';

      try {
        const term = await prisma.glossaryTerm.upsert({
          where: {
            novelId_originalTerm: {
              novelId,
              originalTerm: item.originalTerm.trim(),
            },
          },
          update: {
            vietnameseTerm: item.vietnameseTerm.trim(),
            category: validCat,
            notes: item.notes ? item.notes.trim() : null,
          },
          create: {
            novelId,
            originalTerm: item.originalTerm.trim(),
            vietnameseTerm: item.vietnameseTerm.trim(),
            category: validCat,
            notes: item.notes ? item.notes.trim() : null,
          },
        });
        created.push(term);
      } catch (err) {
        skipped.push({ item, reason: err.message });
      }
    }

    return res.json({
      message: `Đã xử lý ${created.length} thuật ngữ`,
      createdCount: created.length,
      skippedCount: skipped.length,
      data: created,
      skipped,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
});

// Lấy chi tiết một thuật ngữ
router.get('/glossary/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const term = await prisma.glossaryTerm.findUnique({
      where: { id },
      include: {
        novel: {
          select: { id: true, title: true, uploaderId: true },
        },
      },
    });

    if (!term) {
      return res.status(404).json({ message: 'Không tìm thấy thuật ngữ' });
    }

    return res.json({ data: term });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lấy chi tiết thuật ngữ', error: error.message });
  }
});

// Cập nhật thuật ngữ
router.put('/glossary/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { originalTerm, vietnameseTerm, category, notes } = req.body;

  try {
    const term = await prisma.glossaryTerm.findUnique({
      where: { id },
      include: { novel: { select: { uploaderId: true } } },
    });

    if (!term) {
      return res.status(404).json({ message: 'Không tìm thấy thuật ngữ' });
    }

    if (term.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa thuật ngữ này' });
    }

    const updateData = {};
    if (originalTerm !== undefined) updateData.originalTerm = originalTerm.trim();
    if (vietnameseTerm !== undefined) updateData.vietnameseTerm = vietnameseTerm.trim();
    if (category !== undefined) {
      const cleanCat = category.toUpperCase();
      if (!VALID_CATEGORIES.includes(cleanCat)) {
        return res.status(400).json({
          message: `Danh mục không hợp lệ. Chỉ chấp nhận: ${VALID_CATEGORIES.join(', ')}`,
        });
      }
      updateData.category = cleanCat;
    }
    if (notes !== undefined) updateData.notes = notes ? notes.trim() : null;

    const updated = await prisma.glossaryTerm.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      message: 'Cập nhật thuật ngữ thành công',
      data: updated,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Từ gốc này đã tồn tại trong bộ truyện' });
    }
    return res.status(500).json({ message: 'Lỗi khi cập nhật thuật ngữ', error: error.message });
  }
});

// Xóa thuật ngữ
router.delete('/glossary/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const term = await prisma.glossaryTerm.findUnique({
      where: { id },
      include: { novel: { select: { uploaderId: true } } },
    });

    if (!term) {
      return res.status(404).json({ message: 'Không tìm thấy thuật ngữ' });
    }

    if (term.novel.uploaderId !== req.user.sub && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa thuật ngữ này' });
    }

    await prisma.glossaryTerm.delete({ where: { id } });

    return res.json({ message: 'Đã xóa thuật ngữ thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi xóa thuật ngữ', error: error.message });
  }
});

module.exports = router;
