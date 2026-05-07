const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

// الطالب يسجل حساب بنفسه
exports.register = asyncHandler(async (req, res) => {
  const { full_name, university_id, password } = req.body;

  if (!full_name || !university_id || !password) {
    return res.status(400).json({ success: false, message: 'full_name و university_id و password مطلوبة' });
  }

  const exists = await prisma.user.findUnique({ where: { university_id } });
  if (exists) {
    return res.status(409).json({ success: false, message: 'الرقم الجامعي مسجل مسبقاً' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      full_name,
      university_id,
      password: hashed,
      role: 'STUDENT',
      is_active: false,
      is_pending: true,
    },
  });

  res.status(201).json({
    success: true,
    message: 'تم تسجيل حسابك، انتظر تفعيل المدير وستحصل على كودك',
    data: { id: user.id, full_name: user.full_name, university_id: user.university_id },
  });
});

// الطالب يدخل برقمه الجامعي + كلمة السر + device_id
exports.studentLogin = asyncHandler(async (req, res) => {
  const { university_id, password, device_id } = req.body;
  if (!university_id || !password || !device_id) {
    return res.status(400).json({ success: false, message: 'university_id و password و device_id مطلوبة' });
  }

  const user = await prisma.user.findUnique({ where: { university_id } });

  if (!user || user.role !== 'STUDENT' || !user.password) {
    return res.status(401).json({ success: false, message: 'الرقم الجامعي أو كلمة السر غير صحيحة' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'الرقم الجامعي أو كلمة السر غير صحيحة' });
  }

  if (user.is_pending) {
    return res.status(403).json({ success: false, message: 'حسابك لم يُفعَّل بعد، تواصل مع المدير' });
  }

  if (!user.is_active) {
    return res.status(403).json({ success: false, message: 'الحساب موقوف' });
  }

  if (user.expires_at && user.expires_at < new Date()) {
    return res.status(403).json({ success: false, message: 'انتهت صلاحية الاشتراك' });
  }

  if (user.device_id && user.device_id !== device_id) {
    return res.status(403).json({ success: false, message: 'هذا الحساب مربوط بجهاز آخر' });
  }

  if (!user.device_id) {
    await prisma.user.update({ where: { id: user.id }, data: { device_id } });
  }

  const token = signToken(user.id);
  res.json({
    success: true,
    token,
    user: { id: user.id, full_name: user.full_name, university_id: user.university_id, role: user.role },
  });
});

// Admin يدخل بالكود + باسوورد
exports.adminLogin = asyncHandler(async (req, res) => {
  const { access_code, password } = req.body;
  if (!access_code || !password) {
    return res.status(400).json({ success: false, message: 'access_code و password مطلوبان' });
  }

  const user = await prisma.user.findUnique({ where: { access_code } });

  if (!user || user.role !== 'ADMIN' || !user.is_active) {
    return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'بيانات غير صحيحة' });
  }

  const token = signToken(user.id);
  res.json({ success: true, token, user: { id: user.id, full_name: user.full_name, role: user.role } });
});

exports.getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});
