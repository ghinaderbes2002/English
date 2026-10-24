const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { getSubjectAccessError, sendAccessError } = require('../utils/subjectAccess');

exports.getQuiz = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const quizId = parseInt(req.params.quizId);

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: { include: { subject: true } },
      questions: {
        orderBy: { order_num: 'asc' },
        include: {
          options: {
            select: { id: true, option_text: true }, // no is_correct
          },
        },
      },
    },
  });

  if (!quiz) {
    return res.status(404).json({ success: false, message: 'Quiz not found' });
  }

  const accessError = await getSubjectAccessError(userId, quiz.lecture.subject_id);
  if (accessError) return sendAccessError(res, accessError);

  res.json({ success: true, data: quiz });
});

exports.submitQuiz = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const quizId = parseInt(req.params.quizId);
  const { answers } = req.body; // [{ question_id, selected_option_id?, answer_text? }]

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ success: false, message: 'Answers are required' });
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      lecture: true,
      questions: { include: { options: true } },
    },
  });

  if (!quiz) {
    return res.status(404).json({ success: false, message: 'Quiz not found' });
  }

  const accessError = await getSubjectAccessError(userId, quiz.lecture.subject_id);
  if (accessError) return sendAccessError(res, accessError);

  let score = 0;
  let totalPoints = 0;
  const gradedAnswers = [];

  for (const question of quiz.questions) {
    totalPoints += question.points;
    const submitted = answers.find((a) => a.question_id === question.id);
    let is_correct = false;

    if (question.question_type === 'SHORT_ANSWER') {
      is_correct = false; // manual grading
    } else if (submitted?.selected_option_id) {
      const option = question.options.find((o) => o.id === submitted.selected_option_id);
      is_correct = option?.is_correct || false;
    }

    if (is_correct) score += question.points;

    gradedAnswers.push({
      question_id: question.id,
      selected_option_id: submitted?.selected_option_id || null,
      answer_text: submitted?.answer_text || null,
      is_correct,
    });
  }

  const attempt = await prisma.quizAttempt.create({
    data: {
      user_id: userId,
      quiz_id: quizId,
      score,
      total_points: totalPoints,
      answers: { create: gradedAnswers },
    },
    include: {
      answers: {
        include: {
          question: { select: { question_text: true, explanation: true, points: true } },
          selected_option: { select: { option_text: true } },
        },
      },
    },
  });

  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
  const passed = percentage >= 60;

  res.json({ success: true, data: { score, total_points: totalPoints, percentage, passed, attempt } });
});
