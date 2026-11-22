const crypto = require('node:crypto');
const prisma = require('../prismaClient');

const DEFAULT_SHORT_RATIO = 0.25;
const DEFAULT_MIN_SOURCE_LENGTH = 20;

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMeaningfulCharacters(value) {
  return normalizeText(value).replace(/[\s\p{P}\p{S}]/gu, '').length;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsTerm(text, term, language) {
  const haystack = normalizeText(text);
  const needle = normalizeText(term);
  if (!needle) return false;
  if (language === 'en') return new RegExp(`(^|\\W)${escapeRegex(needle)}(?=\\W|$)`, 'iu').test(haystack);
  return haystack.includes(needle);
}

function fingerprintFor(issue, segment) {
  const value = [
    issue.type,
    segment.id,
    issue.glossaryTermId || '',
    normalizeText(segment.originalText),
    normalizeText(segment.translatedText),
  ].join('|');
  return crypto.createHash('sha256').update(value).digest('hex');
}

function inspectSegment(segment, glossary, sourceLanguage, options = {}) {
  const issues = [];
  const translated = normalizeText(segment.translatedText);

  if (!translated) {
    issues.push({
      type: 'EMPTY_TRANSLATION',
      severity: 'ERROR',
      message: 'Bản dịch đang để trống.',
      glossaryTermId: null,
    });
  } else {
    const sourceLength = countMeaningfulCharacters(segment.originalText);
    const translatedLength = countMeaningfulCharacters(segment.translatedText);
    const ratio = Number(options.shortRatio ?? process.env.QA_SHORT_RATIO) || DEFAULT_SHORT_RATIO;
    const minimumSourceLength = Number(options.minimumSourceLength ?? process.env.QA_MIN_SOURCE_LENGTH)
      || DEFAULT_MIN_SOURCE_LENGTH;
    const minimumTargetLength = Math.max(10, Math.ceil(sourceLength * ratio));

    if (sourceLength >= minimumSourceLength && translatedLength < minimumTargetLength) {
      issues.push({
        type: 'TOO_SHORT',
        severity: 'WARNING',
        message: `Bản dịch có ${translatedLength} ký tự nội dung, thấp hơn ngưỡng ${minimumTargetLength}.`,
        glossaryTermId: null,
      });
    }
  }

  for (const term of glossary || []) {
    if (
      containsTerm(segment.originalText, term.originalTerm, sourceLanguage)
      && !containsTerm(segment.translatedText, term.vietnameseTerm, 'vi')
    ) {
      issues.push({
        type: 'GLOSSARY_MISMATCH',
        severity: 'WARNING',
        message: `Thuật ngữ “${term.originalTerm}” cần được dịch là “${term.vietnameseTerm}”.`,
        glossaryTermId: term.id,
      });
    }
  }

  return issues.map((issue) => ({ ...issue, fingerprint: fingerprintFor(issue, segment) }));
}

function summarizeQaIssues(issues) {
  return {
    total: issues.length,
    errors: issues.filter((issue) => issue.severity === 'ERROR' && !issue.ignored).length,
    warnings: issues.filter((issue) => issue.severity === 'WARNING' && !issue.ignored).length,
    ignored: issues.filter((issue) => issue.ignored).length,
  };
}

async function listQaIssues(chapterId) {
  const issues = await prisma.translationQaIssue.findMany({
    where: { chapterId },
    include: {
      segment: { select: { id: true, orderIndex: true } },
      glossaryTerm: { select: { id: true, originalTerm: true, vietnameseTerm: true } },
    },
    orderBy: [{ ignored: 'asc' }, { severity: 'asc' }, { segment: { orderIndex: 'asc' } }, { createdAt: 'asc' }],
  });
  return { issues, summary: summarizeQaIssues(issues) };
}

async function runQaForChapter(chapterId) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      novel: { include: { glossaryTerms: true } },
      segments: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!chapter) return null;

  const candidates = chapter.segments.flatMap((segment) =>
    inspectSegment(segment, chapter.novel.glossaryTerms, chapter.novel.sourceLanguage)
      .map((issue) => ({ ...issue, chapterId, segmentId: segment.id }))
  );
  const fingerprints = candidates.map((issue) => issue.fingerprint);

  const operations = [
    prisma.translationQaIssue.deleteMany({
      where: {
        chapterId,
        ...(fingerprints.length ? { fingerprint: { notIn: fingerprints } } : {}),
      },
    }),
    ...candidates.map((issue) => prisma.translationQaIssue.upsert({
      where: { segmentId_fingerprint: { segmentId: issue.segmentId, fingerprint: issue.fingerprint } },
      create: issue,
      update: {
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        glossaryTermId: issue.glossaryTermId,
      },
    })),
  ];

  await prisma.$transaction(operations);
  return listQaIssues(chapterId);
}

module.exports = {
  containsTerm,
  countMeaningfulCharacters,
  inspectSegment,
  listQaIssues,
  normalizeText,
  runQaForChapter,
  summarizeQaIssues,
};
