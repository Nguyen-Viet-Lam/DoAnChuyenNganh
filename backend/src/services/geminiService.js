const { GoogleGenAI } = require('@google/genai');

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong biến môi trường');
  }
  return new GoogleGenAI({ apiKey });
};

const STYLE_GUIDES = {
  modern: 'hiện đại: câu văn gọn, đời thường, từ ngữ đương đại',
  natural: 'tự nhiên: mượt mà, dễ đọc, sát nghĩa nhưng không cứng nhắc',
  ancient: 'cổ trang: văn phong trang nhã, dùng từ Hán Việt vừa phải, xưng hô thời xưa',
  wuxia: 'kiếm hiệp: hào sảng, giang hồ, xưng hô huynh/đệ/tại hạ phù hợp',
  xianxia: 'tiên hiệp: huyền ảo, giữ thuật ngữ tu luyện/cảnh giới theo Hán Việt',
};
const DEFAULT_STYLE = 'natural';

class TranslationError extends Error {
  constructor(message, { retryable = false, quota = false } = {}) {
    super(message);
    this.name = 'TranslationError';
    this.retryable = retryable;
    this.quota = quota;
  }
}

// Phân loại lỗi Gemini/mạng: lỗi tạm thời được thử lại có giới hạn, hết hạn mức thì dừng
function classifyError(error) {
  if (error instanceof TranslationError) return error;
  const status = error.status || error.code;
  const msg = String(error.message || error);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return new TranslationError('Gemini API đã hết hạn mức (quota)', { quota: true });
  }
  if (
    [500, 502, 503, 504].includes(status) ||
    /ECONNRESET|ENOTFOUND|ETIMEDOUT|fetch failed|timeout|UNAVAILABLE/i.test(msg)
  ) {
    return new TranslationError(`Lỗi kết nối/tạm thời từ Gemini: ${msg}`, { retryable: true });
  }
  return new TranslationError(`Gemini API lỗi: ${msg}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chia văn bản thành các đoạn <= maxChars, ưu tiên cắt theo đoạn văn rồi theo câu
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string[]}
 */
function splitIntoSegments(text, maxChars = Number(process.env.AI_SEGMENT_MAX_CHARS) || 1500) {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pieces = [];
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      pieces.push(p);
      continue;
    }
    const sentences = p.match(/[^。！？.!?]+[。！？.!?]*["”」』]?\s*/g) || [p];
    let buf = '';
    for (const sentence of sentences) {
      if (buf && (buf + sentence).length > maxChars) {
        pieces.push(buf.trim());
        buf = '';
      }
      if (sentence.length > maxChars) {
        // câu đơn quá dài: cắt cứng
        for (let i = 0; i < sentence.length; i += maxChars) {
          const part = sentence.slice(i, i + maxChars);
          if (part.length === maxChars) pieces.push(part.trim());
          else buf += part;
        }
      } else {
        buf += sentence;
      }
    }
    if (buf.trim()) pieces.push(buf.trim());
  }

  // Gộp các đoạn ngắn liền kề cho tới giới hạn
  const segments = [];
  let cur = '';
  for (const piece of pieces) {
    if (cur && (cur + '\n' + piece).length > maxChars) {
      segments.push(cur);
      cur = piece;
    } else {
      cur = cur ? cur + '\n' + piece : piece;
    }
  }
  if (cur) segments.push(cur);
  return segments;
}

/**
 * Dịch văn bản bằng Google Gemini (thử lại có giới hạn với lỗi tạm thời)
 * @param {Object} params
 * @param {string} params.text Nội dung gốc cần dịch
 * @param {string} params.sourceLang Ngôn ngữ nguồn ('zh' | 'en')
 * @param {string} params.targetLang Ngôn ngữ đích (mặc định 'vi')
 * @param {string} [params.style] modern | natural | ancient | wuxia | xianxia
 * @param {string} [params.context] Ngữ cảnh truyện
 * @param {Array} [params.glossary] Bảng thuật ngữ [{ originalTerm, vietnameseTerm, category, notes }]
 * @returns {Promise<string>} Nội dung đã dịch
 */
async function translateChapterText({
  text,
  sourceLang = 'zh',
  targetLang = 'vi',
  style = DEFAULT_STYLE,
  context = '',
  glossary = [],
}) {
  const ai = getGeminiClient();

  const langNames = {
    zh: 'tiếng Trung',
    en: 'tiếng Anh',
    vi: 'tiếng Việt',
  };

  const fromLang = langNames[sourceLang] || sourceLang;
  const toLang = langNames[targetLang] || targetLang;
  const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES[DEFAULT_STYLE];

  let glossarySection = '';
  if (Array.isArray(glossary) && glossary.length > 0) {
    const lines = glossary.map(
      (g) => `- "${g.originalTerm}" -> "${g.vietnameseTerm}" (${g.category}${g.notes ? ': ' + g.notes : ''})`
    );
    glossarySection = `\nBẢNG THUẬT NGỮ BẮT BUỘC TUÂN THỦ:
${lines.join('\n')}
(Yêu cầu: Dịch chuẩn xác các tên riêng/thuật ngữ trên đúng từ điển, bảo đảm sự nhất quán trong toàn bộ câu chuyện).\n`;
  }

  const prompt = `Bạn là một dịch giả tiểu thuyết chuyên nghiệp. Hãy dịch văn bản sau từ ${fromLang} sang ${toLang}.
Yêu cầu:
- Phong cách dịch: ${styleGuide}.
- Bản dịch phải mượt mà, mang văn phong tiểu thuyết, không dịch thô kiểu máy móc.
- Giữ nguyên cấu trúc phân đoạn, lời thoại nhân vật và ngữ điệu phù hợp.
${context ? `- Ngữ cảnh truyện: ${context}` : ''}
${glossarySection}
Nội dung gốc:
${text}

Chỉ trả về nội dung đã dịch, không kèm lời giải thích hay ghi chú phụ.`;

  const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 2);
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const output = (response.text || '').trim();
      if (!output) {
        throw new TranslationError('Gemini trả về phản hồi rỗng', { retryable: true });
      }
      return output;
    } catch (err) {
      lastError = classifyError(err);
      if (!lastError.retryable || attempt === maxRetries) break;
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
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
  STYLE_GUIDES,
  TranslationError,
  splitIntoSegments,
  translateChapterText,
  testGeminiConnection,
};
