const { GoogleGenAI } = require('@google/genai');

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong biến môi trường');
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Dịch văn bản chương tiểu thuyết bằng Google Gemini
 * @param {Object} params
 * @param {string} params.text Nội dung gốc cần dịch
 * @param {string} params.sourceLang Ngôn ngữ nguồn (mặc định 'zh')
 * @param {string} params.targetLang Ngôn ngữ đích (mặc định 'vi')
 * @param {string} [params.context] Ngữ cảnh truyện (thể loại, phong cách)
 * @returns {Promise<string>} Nội dung đã dịch
 */
async function translateChapterText({ text, sourceLang = 'zh', targetLang = 'vi', context = '' }) {
  const ai = getGeminiClient();

  const langNames = {
    zh: 'tiếng Trung',
    en: 'tiếng Anh',
    vi: 'tiếng Việt',
  };

  const fromLang = langNames[sourceLang] || sourceLang;
  const toLang = langNames[targetLang] || targetLang;

  const prompt = `Bạn là một dịch giả tiểu thuyết chuyên nghiệp. Hãy dịch văn bản sau từ ${fromLang} sang ${toLang}.
Yêu cầu:
- Bản dịch phải mượt mà, tự nhiên, mang đậm văn phong tiểu thuyết/văn học, không dịch thô kiểu máy móc.
- Giữ nguyên cấu trúc phân đoạn, lời thoại nhân vật và ngữ điệu phù hợp.
${context ? `- Ngữ cảnh truyện: ${context}` : ''}

Nội dung gốc:
${text}

Chỉ trả về nội dung đã dịch, không kèm lời giải thích hay ghi chú phụ.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text;
}

/**
 * Kiểm tra kết nối Gemini API
 */
async function testGeminiConnection() {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'Xin chào, hãy trả lời ngắn gọn: Sẵn sàng hỗ trợ NovelVerse AI.',
  });
  return response.text;
}

module.exports = {
  translateChapterText,
  testGeminiConnection,
};
