const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { askAboutLecture } = require('../services/aiService');

const QUESTION_LIMIT = parseInt(process.env.CHAT_LIMIT_PER_LECTURE || '3', 10);

// هل التاريخ هو اليوم (نفس السنة + الشهر + اليوم بتوقيت السيرفر)؟
const isToday = (date) => {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

// كم سؤال استخدم الطالب اليوم لهذه المحاضرة
const usedToday = (usage) => {
  if (!usage) return 0;
  return isToday(usage.count_date) ? usage.count : 0;
};

// تأكد من صلاحية الطالب لرؤية محاضرة معينة، وأرجعها مع المادة
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

// GET /api/student/lectures/:lectureId/chat/usage
exports.getUsage = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const lectureId = parseInt(req.params.lectureId, 10);

  const { lecture, error } = await loadLectureWithAccessCheck(userId, lectureId);
  if (error) return res.status(error.status).json({ success: false, message: error.message });

  const usage = await prisma.lectureChatUsage.findUnique({
    where: { student_id_lecture_id: { student_id: userId, lecture_id: lecture.id } },
  });

  const used = usedToday(usage);
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

  // تحقق من العداد قبل الاستدعاء عشان ما نضرب الـ AI من غير داعي
  const existing = await prisma.lectureChatUsage.findUnique({
    where: { student_id_lecture_id: { student_id: userId, lecture_id: lecture.id } },
  });
  const sameDay = existing && isToday(existing.count_date);
  const currentCount = sameDay ? existing.count : 0;
  if (currentCount >= QUESTION_LIMIT) {
    return res.status(403).json({
      success: false,
      message: `وصلت للحد الأقصى من الأسئلة لليوم (${QUESTION_LIMIT}). تتجدد عند منتصف الليل.`,
    });
  }

  // ابنِ الـ context من النص + الشرح
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

  // زِد العداد بعد نجاح الإجابة فقط
  // - لو نفس اليوم: نزيد بـ 1
  // - لو يوم جديد: نعيد العداد إلى 1 ونحدّث count_date
  const now = new Date();
  const updated = await prisma.lectureChatUsage.upsert({
    where: { student_id_lecture_id: { student_id: userId, lecture_id: lecture.id } },
    update: sameDay
      ? { count: { increment: 1 } }
      : { count: 1, count_date: now },
    create: { student_id: userId, lecture_id: lecture.id, count: 1, count_date: now },
  });

  res.json({
    success: true,
    data: { answer, remaining: Math.max(0, QUESTION_LIMIT - updated.count) },
  });
});
