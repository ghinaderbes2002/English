const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

// ─── Departments ──────────────────────────────────────────────────

exports.getDepartments = asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { order_num: 'asc' },
    include: { _count: { select: { years: true } } },
  });
  res.json({ success: true, data: departments });
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, description, order_num } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'name مطلوب' });
  const dept = await prisma.department.create({ data: { name, description, order_num: order_num || 0 } });
  res.status(201).json({ success: true, data: dept });
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await prisma.department.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  res.json({ success: true, data: dept });
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  await prisma.department.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'تم حذف القسم' });
});

// ─── Academic Years ───────────────────────────────────────────────

exports.getYears = asyncHandler(async (req, res) => {
  const departmentId = req.params.departmentId ? parseInt(req.params.departmentId) : undefined;
  const years = await prisma.academicYear.findMany({
    where: departmentId ? { department_id: departmentId } : undefined,
    orderBy: { order_num: 'asc' },
    include: {
      department: { select: { id: true, name: true } },
      semesters: { orderBy: { order_num: 'asc' } },
    },
  });
  res.json({ success: true, data: years });
});

exports.createYear = asyncHandler(async (req, res) => {
  const { name, order_num, department_id } = req.body;
  if (!department_id) return res.status(400).json({ success: false, message: 'department_id مطلوب' });
  const year = await prisma.academicYear.create({
    data: { name, order_num, department_id: parseInt(department_id) },
  });
  res.status(201).json({ success: true, data: year });
});

exports.updateYear = asyncHandler(async (req, res) => {
  const year = await prisma.academicYear.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  res.json({ success: true, data: year });
});

exports.deleteYear = asyncHandler(async (req, res) => {
  await prisma.academicYear.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Year deleted' });
});

// ─── Subjects ─────────────────────────────────────────────────────

exports.getSubjects = asyncHandler(async (req, res) => {
  const subjects = await prisma.subject.findMany({
    include: { semester: { include: { year: true } } },
  });
  res.json({ success: true, data: subjects });
});

exports.createSubject = asyncHandler(async (req, res) => {
  const { semester_id, name, description, notebook_ai_url } = req.body;
  const cover_image = req.file ? req.file.path : undefined;

  const subject = await prisma.subject.create({
    data: { semester_id: parseInt(semester_id), name, description, cover_image, notebook_ai_url },
  });
  res.status(201).json({ success: true, data: subject });
});

exports.updateSubject = asyncHandler(async (req, res) => {
  const updateData = { ...req.body };
  if (req.file) updateData.cover_image = req.file.path;
  if (updateData.semester_id) updateData.semester_id = parseInt(updateData.semester_id);

  const subject = await prisma.subject.update({
    where: { id: parseInt(req.params.id) },
    data: updateData,
  });
  res.json({ success: true, data: subject });
});

exports.deleteSubject = asyncHandler(async (req, res) => {
  await prisma.subject.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Subject deleted' });
});
