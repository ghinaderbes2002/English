const multer = require('multer');
const { MAX_FILE_SIZE } = require('./upload');

const toMB = (bytes) => Math.round(bytes / (1024 * 1024));

const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code;

  // أخطاء multer (الرفع)
  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      code = 'FILE_TOO_LARGE';
      const limitMB = toMB(req.uploadSizeLimit || MAX_FILE_SIZE);
      message = `حجم الملف "${err.field}" كبير جداً (الحد الأقصى ${limitMB} MB)`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = `حقل ملف غير متوقع: ${err.field}`;
  }

  // أخطاء fileFilter (الرسالة عربية واضحة)
  if (err.message?.startsWith('الحقل') || err.message?.startsWith('نوع الملف')) {
    status = 400;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  res.status(status).json({ success: false, code, message });
};

module.exports = errorHandler;
