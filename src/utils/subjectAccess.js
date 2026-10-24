const prisma = require('../config/prisma');

// المواد مفتوحة لكل الطلاب، إلا إذا الأدمن قفلها عند الكل (is_locked)
// أو لغى تفعيلها لهالطالب (UserSubjectBlock)
// بترجّع null إذا مسموح، أو { status, message, code } إذا لأ
exports.getSubjectAccessError = async (userId, subjectId, deniedMessage = 'Access denied') => {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { is_locked: true, student_blocks: { where: { user_id: userId }, select: { id: true } } },
  });

  if (!subject) return { status: 404, message: 'المادة غير موجودة' };
  if (subject.is_locked) return { status: 403, code: 'SUBJECT_LOCKED', message: 'المادة مقفلة حالياً' };
  if (subject.student_blocks.length) return { status: 403, code: 'NO_ACCESS', message: deniedMessage };
  return null;
};

exports.sendAccessError = (res, error) =>
  res.status(error.status).json({ success: false, code: error.code, message: error.message });
