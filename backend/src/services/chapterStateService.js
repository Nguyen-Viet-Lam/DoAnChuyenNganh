const prisma = require('../prismaClient');

function summarizeSegments(segments) {
  const total = segments.length;
  const completed = segments.filter((segment) => segment.status === 'COMPLETED').length;
  return {
    total,
    completed,
    failed: segments.filter((segment) => segment.status === 'FAILED').length,
    pending: segments.filter((segment) => segment.status === 'PENDING').length,
    processing: segments.filter((segment) => segment.status === 'PROCESSING').length,
    needsReview: segments.filter((segment) => segment.needsReview).length,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

function deriveChapterStatus(segments) {
  const summary = summarizeSegments(segments);
  if (summary.total > 0 && summary.completed === summary.total) return 'TRANSLATED';
  if (summary.completed > 0) return 'PARTIAL';
  if (summary.failed > 0) return 'FAILED';
  if (summary.processing > 0) return 'TRANSLATING';
  return 'DRAFT';
}

async function refreshChapter(chapterId) {
  const segments = await prisma.chapterSegment.findMany({
    where: { chapterId },
    orderBy: { orderIndex: 'asc' },
  });

  const status = deriveChapterStatus(segments);
  const translatedContent = segments.some((segment) => segment.translatedText?.trim())
    ? segments.map((segment) => segment.translatedText?.trim() || '').join('\n\n')
    : null;

  const chapter = await prisma.chapter.update({
    where: { id: chapterId },
    data: { status, translatedContent },
  });

  return { chapter, segments, summary: summarizeSegments(segments) };
}

module.exports = { deriveChapterStatus, refreshChapter, summarizeSegments };
