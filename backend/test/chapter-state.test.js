const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveChapterStatus, summarizeSegments } = require('../src/services/chapterStateService');

test('empty translations stay pending in chapter progress', () => {
  const segments = [
    { status: 'COMPLETED', needsReview: false },
    { status: 'PENDING', needsReview: true },
  ];
  assert.equal(deriveChapterStatus(segments), 'PARTIAL');
  assert.deepEqual(summarizeSegments(segments), {
    total: 2,
    completed: 1,
    failed: 0,
    pending: 1,
    processing: 0,
    needsReview: 1,
    percent: 50,
  });
});

test('all completed segments produce translated status', () => {
  assert.equal(deriveChapterStatus([{ status: 'COMPLETED' }, { status: 'COMPLETED' }]), 'TRANSLATED');
});
