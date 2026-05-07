const fs = require('fs');
const pdfParse = require('pdf-parse');

const MAX_CHARS = 30000; // ~7-10 صفحات نص كثيف، يكفي للـ AI context

/**
 * يستخرج النص من ملف PDF
 * يرجع null لو فشل (PDF صور، تالف، إلخ) — لا يرمي خطأ
 * @param {string} filePath مسار الملف على الديسك
 * @returns {Promise<string|null>}
 */
exports.extractText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();
    if (!text) return null;
    return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  } catch (err) {
    console.warn(`[pdfExtractor] فشل استخراج النص من ${filePath}:`, err.message);
    return null;
  }
};
