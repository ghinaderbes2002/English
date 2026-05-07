const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { extractText } = require('../utils/pdfExtractor');

// ─── Lectures ─────────────────────────────────────────────────────

exports.getLecturesBySubject = asyncHandler(async (req, res) => {
  const subjectId = parseInt(req.params.subjectId);
  const { category } = req.query; // LECTURE | EXAM_QUESTIONS | GOLDEN_PAPER | SUMMARY

  const lectures = await prisma.lecture.findMany({
    where: { subject_id: subjectId, ...(category ? { category } : {}) },
    orderBy: { order_num: 'asc' },
    select: {
      id: true, title: true, content_type: true,
      category: true, order_num: true,
      _count: { select: { quizzes: true } },
    },
  });
  res.json({ success: true, data: lectures });
});

exports.getQuizzesByLecture = asyncHandler(async (req, res) => {
  const lectureId = parseInt(req.params.lectureId);
  const quizzes = await prisma.quiz.findMany({
    where: { lecture_id: lectureId },
    select: { id: true, title: true, description: true,
               _count: { select: { questions: true } } },
  });
  res.json({ success: true, data: quizzes });
});

exports.getLecture = asyncHandler(async (req, res) => {
  const lecture = await prisma.lecture.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { _count: { select: { quizzes: true } } },
  });
  if (!lecture) return res.status(404).json({ success: false, message: 'المحاضرة غير موجودة' });
  res.json({ success: true, data: lecture });
});

exports.createLecture = asyncHandler(async (req, res) => {
  const { subject_id, title, content_type, category, text_content, explanation_text, notebook_ai_url, order_num } = req.body;

  const pdf_url = req.files?.pdf?.[0]?.path || null;
  const explanation_pdf = req.files?.explanation_pdf?.[0]?.path || null;

  // استخراج نص الـ PDF تلقائياً لو الأدمن ما لصق نص يدوي
  // (نص الأدمن أولوية لأنه قد يكون أدق)
  let finalText = text_content || null;
  if (!finalText && pdf_url) {
    finalText = await extractText(pdf_url);
  }

  let finalExplanationText = explanation_text || null;
  if (!finalExplanationText && explanation_pdf) {
    finalExplanationText = await extractText(explanation_pdf);
  }

  const lecture = await prisma.lecture.create({
    data: {
      subject_id: parseInt(subject_id),
      title,
      content_type,
      category: category || 'LECTURE',
      text_content: finalText,
      explanation_text: finalExplanationText,
      pdf_url,
      explanation_pdf,
      notebook_ai_url: notebook_ai_url || null,
      order_num: parseInt(order_num),
    },
  });
  res.status(201).json({ success: true, data: lecture });
});

exports.updateLecture = asyncHandler(async (req, res) => {
  const updateData = { ...req.body };

  if (req.files?.pdf?.[0]) {
    updateData.pdf_url = req.files.pdf[0].path;
    // أعد استخراج النص لو ما عبّى الأدمن text_content يدوياً
    if (!updateData.text_content) {
      const extracted = await extractText(req.files.pdf[0].path);
      if (extracted) updateData.text_content = extracted;
    }
  }

  if (req.files?.explanation_pdf?.[0]) {
    updateData.explanation_pdf = req.files.explanation_pdf[0].path;
    if (!updateData.explanation_text) {
      const extracted = await extractText(req.files.explanation_pdf[0].path);
      if (extracted) updateData.explanation_text = extracted;
    }
  }

  if (updateData.subject_id) updateData.subject_id = parseInt(updateData.subject_id);
  if (updateData.order_num) updateData.order_num = parseInt(updateData.order_num);

  const lecture = await prisma.lecture.update({
    where: { id: parseInt(req.params.id) },
    data: updateData,
  });
  res.json({ success: true, data: lecture });
});

exports.deleteLecture = asyncHandler(async (req, res) => {
  await prisma.lecture.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Lecture deleted' });
});

// ─── Quizzes ──────────────────────────────────────────────────────

exports.createQuiz = asyncHandler(async (req, res) => {
  const { lecture_id, title, description } = req.body;
  const quiz = await prisma.quiz.create({
    data: { lecture_id: parseInt(lecture_id), title, description },
  });
  res.status(201).json({ success: true, data: quiz });
});

exports.updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  res.json({ success: true, data: quiz });
});

exports.deleteQuiz = asyncHandler(async (req, res) => {
  await prisma.quiz.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Quiz deleted' });
});

// ─── Questions ────────────────────────────────────────────────────

exports.addQuestion = asyncHandler(async (req, res) => {
  const { question_text, question_type, explanation, points, order_num, options } = req.body;
  const quizId = parseInt(req.params.quizId);

  const question = await prisma.quizQuestion.create({
    data: {
      quiz_id: quizId,
      question_text,
      question_type,
      explanation,
      points: parseInt(points) || 1,
      order_num: parseInt(order_num),
      options: options?.length
        ? { create: options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })) }
        : undefined,
    },
    include: { options: true },
  });
  res.status(201).json({ success: true, data: question });
});

exports.deleteQuestion = asyncHandler(async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Question deleted' });
});
