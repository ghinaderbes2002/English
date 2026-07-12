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

// ─── أسئلة عنصر المحتوى (اختيار من متعدد لمحتوى نوعه MCQ) ──
// مربوطة بعنصر المحتوى (المحاضرة)، منفصلة عن الكويزات، تصحيح فوري بدون حفظ محاولات

// تحقق من صلاحية الطالب على المادة يلي تبعها هالمحتوى، وترجّع عنصر المحتوى
const getLectureWithAccess = async (userId, lectureId) => {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { id: true, subject_id: true },
  });
  if (!lecture) return { error: 404 };

  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: lecture.subject_id } },
  });
  if (!access) return { error: 403 };

  return { lecture };
};

exports.getLectureQuestions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId);

  const { lecture, error } = await getLectureWithAccess(userId, lectureId);
  if (error === 404) return res.status(404).json({ success: false, message: 'Lecture not found' });
  if (error === 403) return res.status(403).json({ success: false, message: 'Access denied' });

  const questions = await prisma.lectureQuestion.findMany({
    where: { lecture_id: lecture.id },
    orderBy: { order_num: 'asc' },
    select: {
      id: true,
      question_text: true,
      question_type: true,
      points: true,
      order_num: true,
      options: { select: { id: true, option_text: true } }, // بدون is_correct
    },
  });

  res.json({ success: true, data: questions });
});

exports.submitLectureQuestions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId);
  const { answers } = req.body; // [{ question_id, selected_option_id?, answer_text? }]

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ success: false, message: 'Answers are required' });
  }

  const { lecture, error } = await getLectureWithAccess(userId, lectureId);
  if (error === 404) return res.status(404).json({ success: false, message: 'Lecture not found' });
  if (error === 403) return res.status(403).json({ success: false, message: 'Access denied' });

  const questions = await prisma.lectureQuestion.findMany({
    where: { lecture_id: lecture.id },
    include: { options: true },
  });

  let score = 0;
  let totalPoints = 0;
  const results = [];

  for (const question of questions) {
    totalPoints += question.points;
    const submitted = answers.find((a) => a.question_id === question.id);
    let is_correct = false;

    if (question.question_type === 'SHORT_ANSWER') {
      is_correct = false; // ما منصحح الأسئلة المقالية تلقائياً
    } else if (submitted?.selected_option_id) {
      const option = question.options.find((o) => o.id === submitted.selected_option_id);
      is_correct = option?.is_correct || false;
    }

    if (is_correct) score += question.points;

    const correctOption = question.options.find((o) => o.is_correct);
    results.push({
      question_id: question.id,
      selected_option_id: submitted?.selected_option_id || null,
      correct_option_id: correctOption?.id || null,
      is_correct,
      explanation: question.explanation || null,
    });
  }

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percentage >= 60;

  res.json({ success: true, data: { score, total_points: totalPoints, percentage, passed, results } });
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
