const prisma = require('../config/prisma');

const checkSubjectAccess = async (req, res, next) => {
  const subjectId = parseInt(req.params.subjectId);
  const userId = req.user.id;

  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: subjectId } },
  });

  if (!access) {
    return res.status(403).json({ success: false, message: 'Access denied to this subject' });
  }

  if (access.expires_at && access.expires_at < new Date()) {
    return res.status(403).json({ success: false, message: 'Subject access expired' });
  }

  next();
};

module.exports = { checkSubjectAccess };
