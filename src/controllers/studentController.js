const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');

const hasAccessFilter = (userId) => ({
  semesters: {
    some: {
      subjects: {
        some: { student_access: { some: { user_id: userId } } },
      },
    },
  },
});

// الأقسام المتاحة للطالب (فيها مواد مفعّلة له)
exports.getDepartments = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const departments = await prisma.department.findMany({
    where: { years: { some: hasAccessFilter(userId) } },
    orderBy: { order_num: 'asc' },
    select: { id: true, name: true, description: true, order_num: true },
  });

  res.json({ success: true, data: departments });
});

// السنوات داخل قسم معين
exports.getYears = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const departmentId = parseInt(req.params.departmentId);

  const years = await prisma.academicYear.findMany({
    where: { department_id: departmentId, ...hasAccessFilter(userId) },
    orderBy: { order_num: 'asc' },
    select: { id: true, name: true, order_num: true },
  });

  res.json({ success: true, data: years });
});

exports.getSemesters = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const yearId = parseInt(req.params.yearId);

  const semesters = await prisma.semester.findMany({
    where: {
      year_id: yearId,
      subjects: {
        some: {
          student_access: { some: { user_id: userId } },
        },
      },
    },
    orderBy: { order_num: 'asc' },
  });

  res.json({ success: true, data: semesters });
});

exports.getSubjects = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const semesterId = parseInt(req.params.semesterId);

  const subjects = await prisma.subject.findMany({
    where: {
      semester_id: semesterId,
      student_access: { some: { user_id: userId } },
    },
    select: {
      id: true,
      name: true,
      description: true,
      cover_image: true,
      notebook_ai_url: true,
    },
  });

  res.json({ success: true, data: subjects });
});

exports.getLectures = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const subjectId = parseInt(req.params.subjectId);
  // category: LECTURE | EXAM_QUESTIONS | GOLDEN_PAPER | SUMMARY (default: LECTURE)
  const category = req.query.category || 'LECTURE';

  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: subjectId } },
  });

  if (!access) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const lectures = await prisma.lecture.findMany({
    where: { subject_id: subjectId, category },
    select: {
      id: true,
      title: true,
      content_type: true,
      category: true,
      order_num: true,
      notebook_ai_url: true,
    },
    orderBy: { order_num: 'asc' },
  });

  res.json({ success: true, data: lectures });
});

exports.getLecture = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId);

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: {
      subject: true,
      quizzes: { select: { id: true, title: true, description: true } },
    },
  });

  if (!lecture) {
    return res.status(404).json({ success: false, message: 'Lecture not found' });
  }

  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: lecture.subject_id } },
  });

  if (!access) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  res.json({ success: true, data: lecture });
});

exports.getSubjectQuizzes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const subjectId = parseInt(req.params.subjectId);

  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: subjectId } },
  });
  if (!access) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const quizzes = await prisma.quiz.findMany({
    where: { lecture: { subject_id: subjectId } },
    select: {
      id: true,
      title: true,
      description: true,
      lecture: { select: { id: true, title: true } },
    },
  });

  res.json({ success: true, data: quizzes });
});

exports.getMyAttempts = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const attempts = await prisma.quizAttempt.findMany({
    where: { user_id: userId },
    include: { quiz: { select: { title: true } } },
    orderBy: { completed_at: 'desc' },
  });

  res.json({ success: true, data: attempts });
});
