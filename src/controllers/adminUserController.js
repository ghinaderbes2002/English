const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');

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

  if (Array.isArray(subject_ids) && subject_ids.length > 0) {
    await prisma.userSubjectAccess.createMany({
      skipDuplicates: true,
      data: subject_ids.map((subject_id) => ({
        user_id: student.id,
        subject_id,
        expires_at: expires_at ? new Date(expires_at) : null,
      })),
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

// تفاصيل طالب مع موادو
exports.getStudent = asyncHandler(async (req, res) => {
  const student = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: {
      subject_access: {
        include: { subject: { select: { id: true, name: true } } },
      },
    },
  });

  if (!student || student.role !== 'STUDENT') {
    return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
  }

  res.json({ success: true, data: student });
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

// تفعيل مواد لطالب
exports.grantSubjects = asyncHandler(async (req, res) => {
  const { subject_ids, expires_at } = req.body;
  const userId = req.params.id;

  if (!Array.isArray(subject_ids) || subject_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'subject_ids مطلوبة' });
  }

  await prisma.userSubjectAccess.createMany({
    skipDuplicates: true,
    data: subject_ids.map((subject_id) => ({
      user_id: userId,
      subject_id,
      expires_at: expires_at ? new Date(expires_at) : null,
    })),
  });

  res.json({ success: true, message: 'تم تفعيل المواد' });
});

// سحب مادة من طالب
exports.revokeSubject = asyncHandler(async (req, res) => {
  const { id: user_id, subjectId } = req.params;
  await prisma.userSubjectAccess.delete({
    where: { user_id_subject_id: { user_id, subject_id: parseInt(subjectId) } },
  });
  res.json({ success: true, message: 'تم سحب المادة' });
});
