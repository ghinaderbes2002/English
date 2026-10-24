const prisma = require('../config/prisma');

// صلاحية الطالب على مادة: لازم تكون مفعّلة إلو، وما تكون مقفلة عند الكل من الأدمن
// بترجّع null إذا مسموح، أو { status, message, code } إذا لأ
exports.getSubjectAccessError = async (userId, subjectId, deniedMessage = 'Access denied') => {
  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: subjectId } },
    include: { subject: { select: { is_locked: true } } },
  });

  if (!access) return { status: 403, code: 'NO_ACCESS', message: deniedMessage };
  if (access.subject.is_locked) return { status: 403, code: 'SUBJECT_LOCKED', message: 'المادة مقفلة حالياً' };
  return null;
};

exports.sendAccessError = (res, error) =>
  res.status(error.status).json({ success: false, code: error.code, message: error.message });
