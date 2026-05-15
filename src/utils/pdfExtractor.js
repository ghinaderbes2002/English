const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const pdfParseModule = require('pdf-parse');
const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule.default;

const MAX_CHARS = 30000;

exports.extractText = async (filePath) => {
  // المحاولة الأولى: pdf-parse (سريع، مجاني، للـ PDFs النصية)
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();
    if (text.length > 50) {
      console.log('[pdfExtractor] pdf-parse نجح، طول النص:', text.length);
      return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    }
  } catch (err) {
    console.warn('[pdfExtractor] pdf-parse فشل:', err.message);
  }

  // المحاولة الثانية: Gemini Vision (للـ PDFs الممسوحة/scanned)
  return extractWithGeminiVision(filePath);
};

const extractWithGeminiVision = async (filePath) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[pdfExtractor] GEMINI_API_KEY غير موجود');
    return null;
  }

  try {
    console.log('[pdfExtractor] جاري استخراج النص عبر Gemini Vision...');
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString('base64');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });

    const result = await model.generateContent([
      { inlineData: { mimeType: 'application/pdf', data: base64Data } },
      'استخرج جميع النصوص من هذا الملف. أعد النص فقط كما هو بشكل منظم، بدون أي تعليق أو مقدمة.',
    ]);

    const text = result?.response?.text?.()?.trim();
    console.log('[pdfExtractor] Gemini Vision نجح، طول النص:', text?.length || 0);
    return text ? text.slice(0, MAX_CHARS) : null;
  } catch (err) {
    console.warn('[pdfExtractor] Gemini Vision فشل:', err.message);
    return null;
  }
};
