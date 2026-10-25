const express = require('express');
const prisma = require('../prismaClient');
const { authenticate, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// Lấy danh sách toàn bộ thể loại
router.get('/', async (req, res) => {
  try {
    const genres = await prisma.genre.findMany({
      orderBy: { name: 'asc' },
    });
    return res.json({ data: genres });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi lấy danh sách thể loại', error: error.message });
  }
});

// Tạo thể loại mới (chỉ Admin)
router.post('/', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  const { name, slug, description } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ message: 'Vui lòng cung cấp tên (name) và slug của thể loại' });
  }

  try {
    const existing = await prisma.genre.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'Tên hoặc slug thể loại đã tồn tại' });
    }

    const genre = await prisma.genre.create({
      data: { name, slug, description },
    });

    return res.status(201).json({ message: 'Tạo thể loại thành công', data: genre });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi khi tạo thể loại', error: error.message });
  }
});

module.exports = router;
