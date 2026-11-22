const bcrypt = require('bcrypt');
const prisma = require('../src/prismaClient');

async function main() {
  const passwordHash = await bcrypt.hash('Demo1234', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@novelverse.local' },
    update: { displayName: 'Dịch giả Demo', passwordHash },
    create: {
      email: 'demo@novelverse.local',
      displayName: 'Dịch giả Demo',
      passwordHash,
    },
  });

  const genre = await prisma.genre.upsert({
    where: { slug: 'tien-hiep' },
    update: { name: 'Tiên hiệp' },
    create: { name: 'Tiên hiệp', slug: 'tien-hiep', description: 'Dữ liệu mẫu phục vụ kiểm thử.' },
  });

  let novel = await prisma.novel.findFirst({
    where: { uploaderId: user.id, title: 'Đấu Phá Thương Khung - Bản mẫu' },
  });
  if (!novel) {
    novel = await prisma.novel.create({
      data: {
        title: 'Đấu Phá Thương Khung - Bản mẫu',
        originalTitle: '斗破苍穹',
        author: 'Dữ liệu kiểm thử',
        description: 'Bộ dữ liệu nhỏ dùng để kiểm tra trình biên tập và Translation QA Engine.',
        sourceLanguage: 'zh',
        targetLanguage: 'vi',
        status: 'DRAFT',
        uploaderId: user.id,
        genres: { create: { genreId: genre.id } },
      },
    });
  }

  const chapter = await prisma.chapter.upsert({
    where: { novelId_chapterNumber: { novelId: novel.id, chapterNumber: 1 } },
    update: {},
    create: {
      novelId: novel.id,
      chapterNumber: 1,
      title: 'Thiên tài sa sút',
      originalContent: '萧炎 nhìn lên ma thạch bia. Đấu之气 chỉ còn ba đoạn.',
      status: 'PARTIAL',
      wordCount: 12,
    },
  });

  await prisma.glossaryTerm.upsert({
    where: { novelId_originalTerm: { novelId: novel.id, originalTerm: '萧炎' } },
    update: { vietnameseTerm: 'Tiêu Viêm', category: 'CHARACTER' },
    create: {
      novelId: novel.id,
      originalTerm: '萧炎',
      vietnameseTerm: 'Tiêu Viêm',
      category: 'CHARACTER',
    },
  });

  const segments = [
    { orderIndex: 0, originalText: '萧炎 nhìn lên ma thạch bia.', translatedText: 'Chàng nhìn lên tấm bia đá.', status: 'COMPLETED' },
    { orderIndex: 1, originalText: 'Đấu之气 chỉ còn ba đoạn.', translatedText: '', status: 'PENDING' },
  ];
  for (const segment of segments) {
    await prisma.chapterSegment.upsert({
      where: { chapterId_orderIndex: { chapterId: chapter.id, orderIndex: segment.orderIndex } },
      update: segment,
      create: { chapterId: chapter.id, ...segment },
    });
  }

  console.log('Seed completed: demo@novelverse.local / Demo1234');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
