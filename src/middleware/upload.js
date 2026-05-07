const multer = require('multer');
const path = require('path');

const PDF_FIELDS = new Set(['pdf', 'explanation_pdf']);
const IMAGE_FIELDS = new Set(['cover_image']);
const PDF_EXTS = new Set(['.pdf']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const isPdfFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return PDF_EXTS.has(ext) || file.mimetype === 'application/pdf';
};

const isImageFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return IMAGE_EXTS.has(ext) || file.mimetype.startsWith('image/');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = isPdfFile(file) ? './uploads/pdfs' : './uploads/images';
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // تحقق حسب اسم الحقل: pdf و explanation_pdf لازم PDF فقط، cover_image صورة فقط
  if (PDF_FIELDS.has(file.fieldname)) {
    if (isPdfFile(file)) return cb(null, true);
    return cb(new Error(`الحقل "${file.fieldname}" يجب أن يكون ملف PDF`), false);
  }

  if (IMAGE_FIELDS.has(file.fieldname)) {
    if (isImageFile(file)) return cb(null, true);
    return cb(new Error(`الحقل "${file.fieldname}" يجب أن يكون صورة (jpg/png/webp)`), false);
  }

  // أي حقل ثاني: اقبل PDF أو صورة
  if (isPdfFile(file) || isImageFile(file)) return cb(null, true);
  return cb(new Error(`نوع الملف غير مدعوم: ${file.originalname}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 },
});

// لرفع محاضرة + شرحها بنفس الوقت
const uploadLecture = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'explanation_pdf', maxCount: 1 },
]);

module.exports = upload;
module.exports.uploadLecture = uploadLecture;
