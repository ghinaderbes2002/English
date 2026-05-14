const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI, GoogleAIFileManager } = require('@google/generative-ai');

const MAX_CHARS = 30000;

exports.extractText = async (filePath) => {
  // المحاولة الأولى: pdf-parse (سريع، مجاني، للـ PDFs النصية)
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    const text = (result.text || '').trim();
    if (text.length > 50) {
      return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
    }
  } catch (err) {
    console.warn(`[pdfExtractor] pdf-parse فشل:`, err.message);
  }

  // المحاولة الثانية: Gemini Vision (للـ PDFs الممسوحة/scanned)
  return extractWithGeminiVision(filePath);
};

const extractWithGeminiVision = async (filePath) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  let uploadedFileName = null;
  try {
    const fileManager = new GoogleAIFileManager(apiKey);

    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType: 'application/pdf',
      displayName: path.basename(filePath),
    });
    uploadedFileName = uploadResult.file.name;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    });

    const result = await model.generateContent([
      { fileData: { mimeType: 'application/pdf', fileUri: uploadResult.file.uri } },
      'استخرج جميع النصوص من هذا الملف. أعد النص فقط كما هو بشكل منظم، بدون أي تعليق أو مقدمة.',
    ]);

    const text = result?.response?.text?.()?.trim();
    return text ? text.slice(0, MAX_CHARS) : null;
  } catch (err) {
    console.warn(`[pdfExtractor] Gemini Vision فشل:`, err.message);
    return null;
  } finally {
    // حذف الملف من Gemini بعد الاستخدام
    if (uploadedFileName) {
      try {
        const fileManager = new GoogleAIFileManager(apiKey);
        await fileManager.deleteFile(uploadedFileName);
      } catch {}
    }
  }
};
