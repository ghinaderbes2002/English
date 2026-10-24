const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const { groupSubjectsByYear, subjectSemesterInclude, subjectOrderBy } = require('../utils/groupSubjects');

const studentSelect = {
  id: true,
  full_name: true,
  university_id: true,
  is_active: true,
  is_pending: true,
  expires_at: true,
  device_id: true,
  created_at: true,
};

// الطلاب المفعّلين
exports.getStudents = asyncHandler(async (req, res) => {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', is_pending: false },
    select: studentSelect,
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, data: students });
});

// الطلاب المعلّقين (سجّلوا بس لم يُفعَّلوا)
exports.getPendingStudents = asyncHandler(async (req, res) => {
  const students = await prisma.user.findMany({
    where: { role: 'STUDENT', is_pending: true },
    select: studentSelect,
    orderBy: { created_at: 'desc' },
  });
  res.json({ success: true, data: students });
});

// تفعيل طالب — يصير قادر يدخل برقمه الجامعي وكلمة سره مباشرة
exports.activateStudent = asyncHandler(async (req, res) => {
  const { university_id, expires_at, subject_ids } = req.body;

  if (!university_id) {
    return res.status(400).json({ success: false, message: 'university_id مطلوب' });
  }

  const student = await prisma.user.findUnique({ where: { university_id } });

  if (!student || student.role !== 'STUDENT') {
    return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
  }

  if (!student.is_pending) {
    return res.status(409).json({ success: false, message: 'الطالب مفعّل مسبقاً' });
  }

  const updated = await prisma.user.update({
    where: { id: student.id },
    data: {
      is_active: true,
      is_pending: false,
      expires_at: expires_at ? new Date(expires_at) : null,
    },
    select: studentSelect,
  });

  // المواد مفتوحة للكل افتراضياً، subject_ids بس بيرجّع تفعيل مواد كانت ملغاة لهالطالب
  if (Array.isArray(subject_ids) && subject_ids.length > 0) {
    await prisma.userSubjectBlock.deleteMany({
      where: { user_id: student.id, subject_id: { in: subject_ids.map((id) => parseInt(id)) } },
    });
  }

  res.json({
    success: true,
    message: 'تم تفعيل الطالب بنجاح',
    data: updated,
  });
});

// إنشاء طالب يدوياً من الأدمن (بدون تسجيل ذاتي)
exports.createStudent = asyncHandler(async (req, res) => {
  const { full_name, university_id, password, expires_at } = req.body;
  if (!full_name || !university_id || !password) {
    return res.status(400).json({ success: false, message: 'full_name و university_id و password مطلوبة' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const student = await prisma.user.create({
    data: {
      full_name,
      university_id,
      password: hashed,
      role: 'STUDENT',
      is_active: true,
      is_pending: false,
      expires_at: expires_at ? new Date(expires_at) : null,
    },
    select: studentSelect,
  });

  res.status(201).json({ success: true, data: student });
});

// تفاصيل طالب مع المواد يلي لغى الأدمن تفعيلها إلو
exports.getStudent = asyncHandler(async (req, res) => {
  const student = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      ...studentSelect,
      role: true,
      subject_blocks: { select: { subject: { select: { id: true, name: true } } } },
    },
  });

  if (!student || student.role !== 'STUDENT') {
    return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
  }

  const { role, subject_blocks, ...data } = student;
  res.json({ success: true, data: { ...data, blocked_subjects: subject_blocks.map((b) => b.subject) } });
});

// تعديل: تعليق / تمديد / reset الجهاز
exports.updateStudent = asyncHandler(async (req, res) => {
  const { is_active, expires_at, resetDevice } = req.body;
  const updateData = {};

  if (typeof is_active === 'boolean') updateData.is_active = is_active;
  if (expires_at !== undefined) updateData.expires_at = expires_at ? new Date(expires_at) : null;
  if (resetDevice) updateData.device_id = null;

  const student = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: studentSelect,
  });

  res.json({ success: true, data: student });
});

exports.deleteStudent = asyncHandler(async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'تم حذف الطالب' });
});

// إعادة تفعيل مواد لطالب كان الأدمن لاغي تفعيلها إلو
exports.grantSubjects = asyncHandler(async (req, res) => {
  const { subject_ids } = req.body;
  const userId = req.params.id;

  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'subject_ids مطلوبة' });
  }

  await prisma.userSubjectBlock.deleteMany({
    where: { user_id: userId, subject_id: { in: subject_ids.map((id) => parseInt(id)) } },
  });

  res.json({ success: true, message: 'تم تفعيل المواد' });
});

// إلغاء تفعيل مادة لطالب (لو ملغاة أصلاً ما بيصير خطأ)
exports.revokeSubject = asyncHandler(async (req, res) => {
  const { id: user_id, subjectId } = req.params;
  const subject_id = parseInt(subjectId);

  const [student, subject] = await Promise.all([
    prisma.user.findUnique({ where: { id: user_id }, select: { role: true } }),
    prisma.subject.findUnique({ where: { id: subject_id }, select: { id: true } }),
  ]);
  if (!student || student.role !== 'STUDENT') {
    return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
  }
  if (!subject) return res.status(404).json({ success: false, message: 'المادة غير موجودة' });

  await prisma.userSubjectBlock.createMany({ skipDuplicates: true, data: [{ user_id, subject_id }] });
  res.json({ success: true, message: 'تم إلغاء تفعيل المادة' });
});

// كل المواد مع حالتها لطالب معيّن — لقائمة فتح / قفل المواد
// ?grouped=true → مقسّمة حسب السنة ثم الفصل
exports.getStudentSubjects = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const student = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!student || student.role !== 'STUDENT') {
    return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
  }

  const subjects = await prisma.subject.findMany({
    orderBy: subjectOrderBy,
    select: {
      id: true,
      name: true,
      cover_image: true,
      is_locked: true,
      semester: subjectSemesterInclude,
      student_blocks: { where: { user_id: userId }, select: { id: true } },
    },
  });

  const data = subjects.map(({ student_blocks, ...s }) => ({ ...s, has_access: student_blocks.length === 0 }));
  res.json({ success: true, data: req.query.grouped === 'true' ? groupSubjectsByYear(data) : data });
});
