const express = require('express');
const { authenticate } = require('../middleware/auth');
const { testGeminiConnection, translateChapterText } = require('../services/geminiService');

const router = express.Router();

// Kiểm tra kết nối Gemini API
router.get('/test-connection', authenticate, async (req, res) => {
  try {
    const result = await testGeminiConnection();
    return res.json({
      status: 'connected',
      message: 'Kết nối thành công với Google Gemini API',
      response: result,
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Không thể kết nối với Gemini API',
      error: error.message,
    });
  }
});

// Thử nghiệm dịch nhanh một đoạn văn bản
router.post('/quick-translate', authenticate, async (req, res) => {
  const { text, sourceLang = 'zh', targetLang = 'vi', context } = req.body;

  if (!text) {
    return res.status(400).json({ message: 'Vui lòng cung cấp văn bản cần dịch (text)' });
  }

  try {
    const translated = await translateChapterText({ text, sourceLang, targetLang, context });
    return res.json({
      original: text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
      translated,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Lỗi khi thực hiện dịch thuật AI',
      error: error.message,
    });
  }
});

module.exports = router;
