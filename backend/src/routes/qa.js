const express = require('express');
const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth');
const { canEditNovel } = require('../utils/permissions');
const { listQaIssues, runQaForChapter } = require('../services/qaService');

const router = express.Router();

async function loadEditableChapter(chapterId, user) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: { novel: { select: { uploaderId: true } } },
  });
  if (!chapter) return { status: 404, message: 'Không tìm thấy chương truyện' };
  if (!canEditNovel(chapter.novel, user)) return { status: 403, message: 'Bạn không có quyền kiểm tra chương này' };
  return { chapter };
}

router.get('/chapters/:id/qa', authenticate, async (req, res) => {
  try {
    const access = await loadEditableChapter(req.params.id, req.user);
    if (!access.chapter) return res.status(access.status).json({ message: access.message });
    const result = await listQaIssues(access.chapter.id);
    return res.json({ data: result.issues, summary: result.summary });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể tải cảnh báo QA' });
  }
});

router.post('/chapters/:id/qa/run', authenticate, async (req, res) => {
  try {
    const access = await loadEditableChapter(req.params.id, req.user);
    if (!access.chapter) return res.status(access.status).json({ message: access.message });
    const result = await runQaForChapter(access.chapter.id);
    return res.json({ message: 'Đã kiểm tra chất lượng bản dịch', data: result.issues, summary: result.summary });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể chạy kiểm tra QA' });
  }
});

router.put('/qa-issues/:id/ignore', authenticate, async (req, res) => {
  try {
    const issue = await prisma.translationQaIssue.findUnique({
      where: { id: req.params.id },
      include: { chapter: { include: { novel: { select: { uploaderId: true } } } } },
    });
    if (!issue) return res.status(404).json({ message: 'Không tìm thấy cảnh báo QA' });
    if (!canEditNovel(issue.chapter.novel, req.user)) return res.status(403).json({ message: 'Bạn không có quyền thao tác' });
    if (issue.severity === 'ERROR') return res.status(400).json({ message: 'Lỗi bắt buộc phải được sửa, không thể bỏ qua' });

    const updated = await prisma.translationQaIssue.update({
      where: { id: issue.id },
      data: { ignored: true, ignoredAt: new Date() },
    });
    return res.json({ message: 'Đã bỏ qua cảnh báo', data: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể bỏ qua cảnh báo QA' });
  }
});

router.put('/qa-issues/:id/restore', authenticate, async (req, res) => {
  try {
    const issue = await prisma.translationQaIssue.findUnique({
      where: { id: req.params.id },
      include: { chapter: { include: { novel: { select: { uploaderId: true } } } } },
    });
    if (!issue) return res.status(404).json({ message: 'Không tìm thấy cảnh báo QA' });
    if (!canEditNovel(issue.chapter.novel, req.user)) return res.status(403).json({ message: 'Bạn không có quyền thao tác' });

    const updated = await prisma.translationQaIssue.update({
      where: { id: issue.id },
      data: { ignored: false, ignoredAt: null },
    });
    return res.json({ message: 'Đã khôi phục cảnh báo', data: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Không thể khôi phục cảnh báo QA' });
  }
});

module.exports = router;
