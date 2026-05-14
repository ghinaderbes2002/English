const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { askAboutLecture } = require('../services/aiService');

const QUESTION_LIMIT = parseInt(process.env.CHAT_LIMIT_PER_DAY || '8', 10);

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isToday = (date) => date && date >= startOfToday();

// مجموع الأسئلة المطروحة اليوم عبر كل المحاضرات
const getDailyTotal = async (userId) => {
  const result = await prisma.lectureChatUsage.aggregate({
    where: { student_id: userId, count_date: { gte: startOfToday() } },
    _sum: { count: true },
  });
  return result._sum.count || 0;
};

const loadLectureWithAccessCheck = async (userId, lectureId) => {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      id: true, title: true, text_content: true, explanation_text: true,
      subject_id: true,
    },
  });
  if (!lecture) return { error: { status: 404, message: 'المحاضرة غير موجودة' } };

  const access = await prisma.userSubjectAccess.findUnique({
    where: { user_id_subject_id: { user_id: userId, subject_id: lecture.subject_id } },
  });
  if (!access) return { error: { status: 403, message: 'لا تملك صلاحية الوصول لهذه المادة' } };

  return { lecture };
};

// GET /api/student/chat/usage  ← حصة اليوم الإجمالية
exports.getDailyUsage = asyncHandler(async (req, res) => {
  const used = await getDailyTotal(req.user.id);
  res.json({
    success: true,
    data: { used, remaining: Math.max(0, QUESTION_LIMIT - used), limit: QUESTION_LIMIT },
  });
});

// GET /api/student/lectures/:lectureId/chat/usage
exports.getUsage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId, 10);

  const { lecture, error } = await loadLectureWithAccessCheck(userId, lectureId);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  const used = await getDailyTotal(userId);
  res.json({
    success: true,
    data: { used, remaining: Math.max(0, QUESTION_LIMIT - used), limit: QUESTION_LIMIT },
  });
});

// POST /api/student/lectures/:lectureId/chat   { question: "..." }
exports.askQuestion = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId, 10);
  const question = (req.body?.question || '').toString().trim();

  if (!question) {
    return res.status(400).json({ success: false, message: 'السؤال مطلوب' });
  }
  if (question.length > 1000) {
    return res.status(400).json({ success: false, message: 'السؤال طويل جداً (حد أقصى 1000 حرف)' });
  }

  const { lecture, error } = await loadLectureWithAccessCheck(userId, lectureId);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  // تحقق من الحد اليومي الإجمالي عبر كل المحاضرات
  const totalUsed = await getDailyTotal(userId);
  if (totalUsed >= QUESTION_LIMIT) {
    return res.status(403).json({
      success: false,
      message: `وصلت للحد الأقصى من الأسئلة لليوم (${QUESTION_LIMIT}). تتجدد عند منتصف الليل.`,
    });
  }

  const content = [lecture.text_content, lecture.explanation_text]
    .filter(Boolean)
    .join('\n\n---\n\n');

  let answer;
  try {
    answer = await askAboutLecture({ title: lecture.title, content }, question);
  } catch (e) {
    console.error('AI Error:', e.message);
    return res.status(502).json({ success: false, message: 'تعذّر الحصول على إجابة من الذكاء الاصطناعي حالياً' });
  }

  // زِد عداد هذه المحاضرة تحديداً (مع إعادة ضبط لو يوم جديد)
  const now = new Date();
  const existing = await prisma.lectureChatUsage.findUnique({
    where: { student_id_lecture_id: { student_id: userId, lecture_id: lecture.id } },
  });
  const sameDay = existing && isToday(existing.count_date);

  await prisma.lectureChatUsage.upsert({
    where: { student_id_lecture_id: { student_id: userId, lecture_id: lecture.id } },
    update: sameDay ? { count: { increment: 1 } } : { count: 1, count_date: now },
    create: { student_id: userId, lecture_id: lecture.id, count: 1, count_date: now },
  });

  res.json({
    success: true,
    data: { answer, remaining: Math.max(0, QUESTION_LIMIT - (totalUsed + 1)) },
  });
});
