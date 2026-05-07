const multer = require('multer');

const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // أخطاء multer (الرفع)
  if (err instanceof multer.MulterError) {
    status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'حجم الملف كبير جداً (الحد الأقصى 50 MB)';
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = `حقل ملف غير متوقع: ${err.field}`;
  }

  // أخطاء fileFilter (الرسالة عربية واضحة)
  if (err.message?.startsWith('الحقل') || err.message?.startsWith('نوع الملف')) {
    status = 400;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  res.status(status).json({ success: false, message });
};

module.exports = errorHandler;
