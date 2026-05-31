const multer = require('multer');
const path = require('path');

const PDF_FIELDS = new Set(['pdf', 'explanation_pdf']);
const IMAGE_FIELDS = new Set(['cover_image']);
const AUDIO_FIELDS = new Set(['audio']);

const PDF_EXTS = new Set(['.pdf']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.webm', '.opus']);

const isPdfFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return PDF_EXTS.has(ext) || file.mimetype === 'application/pdf';
};

const isImageFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return IMAGE_EXTS.has(ext) || file.mimetype.startsWith('image/');
};

const isAudioFile = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  return AUDIO_EXTS.has(ext) || file.mimetype.startsWith('audio/');
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (isPdfFile(file)) return cb(null, './uploads/pdfs');
    if (isAudioFile(file)) return cb(null, './uploads/audio');
    cb(null, './uploads/images');
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (PDF_FIELDS.has(file.fieldname)) {
    if (isPdfFile(file)) return cb(null, true);
    return cb(new Error(`الحقل "${file.fieldname}" يجب أن يكون ملف PDF`), false);
  }

  if (IMAGE_FIELDS.has(file.fieldname)) {
    if (isImageFile(file)) return cb(null, true);
    return cb(new Error(`الحقل "${file.fieldname}" يجب أن يكون صورة (jpg/png/webp)`), false);
  }

  if (AUDIO_FIELDS.has(file.fieldname)) {
    if (isAudioFile(file)) return cb(null, true);
    return cb(new Error(`الحقل "audio" يجب أن يكون ملف صوتي (mp3/m4a/wav/ogg)`), false);
  }

  if (isPdfFile(file) || isImageFile(file) || isAudioFile(file)) return cb(null, true);
  return cb(new Error(`نوع الملف غير مدعوم: ${file.originalname}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 },
});

const uploadLecture = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'explanation_pdf', maxCount: 1 },
  { name: 'audio', maxCount: 1 },
]);

module.exports = upload;
module.exports.uploadLecture = uploadLecture;
