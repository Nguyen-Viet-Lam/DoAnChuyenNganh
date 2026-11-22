const test = require('node:test');
const assert = require('node:assert/strict');
const { containsTerm, inspectSegment, normalizeText } = require('../src/services/qaService');

const segment = (translatedText) => ({
  id: 'segment-1',
  originalText: '萧炎 bước vào quảng trường với Đấu Khí.',
  translatedText,
});

const glossary = [
  { id: 'term-1', originalTerm: '萧炎', vietnameseTerm: 'Tiêu Viêm' },
];

test('normalizes unicode text and whitespace', () => {
  assert.equal(normalizeText('  TIÊU   VIÊM  '), 'tiêu viêm');
});

test('detects empty translations as blocking errors', () => {
  const issues = inspectSegment(segment('   '), glossary, 'zh');
  assert.equal(issues.find((issue) => issue.type === 'EMPTY_TRANSLATION').severity, 'ERROR');
});

test('detects unusually short translations', () => {
  const issues = inspectSegment(
    { id: 'segment-2', originalText: 'A'.repeat(120), translatedText: 'Quá ngắn.' },
    [],
    'en',
    { shortRatio: 0.25, minimumSourceLength: 20 }
  );
  assert.ok(issues.some((issue) => issue.type === 'TOO_SHORT'));
});

test('detects glossary mismatches and accepts the required translation', () => {
  assert.equal(containsTerm('The hero Xiao Yan arrived', 'Xiao Yan', 'en'), true);
  assert.ok(inspectSegment(segment('Anh bước vào quảng trường.'), glossary, 'zh')
    .some((issue) => issue.type === 'GLOSSARY_MISMATCH'));
  assert.equal(inspectSegment(segment('Tiêu Viêm bước vào quảng trường.'), glossary, 'zh')
    .some((issue) => issue.type === 'GLOSSARY_MISMATCH'), false);
});
