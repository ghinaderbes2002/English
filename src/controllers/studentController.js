const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { getSubjectAccessError, sendAccessError } = require('../utils/subjectAccess');

// كل الأقسام والسنوات والفصول والمواد بتطلع لكل الطلاب
exports.getDepartments = asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { order_num: 'asc' },
    select: { id: true, name: true, description: true, order_num: true },
  });

  res.json({ success: true, data: departments });
});

// السنوات داخل قسم معين
exports.getYears = asyncHandler(async (req, res) => {
  const departmentId = parseInt(req.params.departmentId);

  const years = await prisma.academicYear.findMany({
    where: { department_id: departmentId },
    orderBy: { order_num: 'asc' },
    select: { id: true, name: true, order_num: true, cover_image: true },
  });

  res.json({ success: true, data: years });
});

exports.getSemesters = asyncHandler(async (req, res) => {
  const yearId = parseInt(req.params.yearId);

  const semesters = await prisma.semester.findMany({
    where: { year_id: yearId },
    orderBy: { order_num: 'asc' },
  });

  res.json({ success: true, data: semesters });
});

// كل مواد الفصل — المقفولة عند الكل بتطلع مع is_locked: true،
// ويلي لغى الأدمن تفعيلها لهالطالب بتطلع مع has_access: false
exports.getSubjects = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const semesterId = parseInt(req.params.semesterId);

  const subjects = await prisma.subject.findMany({
    where: { semester_id: semesterId },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      cover_image: true,
      notebook_ai_url: true,
      is_locked: true,
      _count: { select: { lectures: true } },
      student_blocks: { where: { user_id: userId }, select: { id: true } },
    },
  });

  res.json({
    success: true,
    data: subjects.map(({ _count, student_blocks, ...s }) => ({
      ...s,
      has_access: student_blocks.length === 0,
      lectures_count: _count.lectures,
    })),
  });
});

exports.getLectures = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const subjectId = parseInt(req.params.subjectId);
  // category: LECTURE | EXAM_QUESTIONS | GOLDEN_PAPER | SUMMARY (default: LECTURE)
  const category = req.query.category || 'LECTURE';

  const accessError = await getSubjectAccessError(userId, subjectId);
  if (accessError) return sendAccessError(res, accessError);

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

  const accessError = await getSubjectAccessError(userId, lecture.subject_id);
  if (accessError) return sendAccessError(res, accessError);

  res.json({ success: true, data: lecture });
});

exports.getSubjectQuizzes = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const subjectId = parseInt(req.params.subjectId);

  const accessError = await getSubjectAccessError(userId, subjectId);
  if (accessError) return sendAccessError(res, accessError);

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
  if (!lecture) return { error: { status: 404, message: 'Lecture not found' } };

  const accessError = await getSubjectAccessError(userId, lecture.subject_id);
  if (accessError) return { error: accessError };

  return { lecture };
};

exports.getLectureQuestions = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId);

  const { lecture, error } = await getLectureWithAccess(userId, lectureId);
  if (error) return sendAccessError(res, error);

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
  if (error) return sendAccessError(res, error);

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
