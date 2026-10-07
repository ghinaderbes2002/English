const prisma = require('../config/prisma');
const asyncHandler = require('../utils/asyncHandler');
const { extractText } = require('../utils/pdfExtractor');
const { extractQuestionsFromFiles } = require('../services/aiService');

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
  const audio_url = req.files?.audio?.[0]?.path || null;

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
      audio_url,
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

  if (req.files?.audio?.[0]) {
    updateData.audio_url = req.files.audio[0].path;
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

// POST /admin/maintenance/reextract-texts
// يعيد استخراج النص لكل المحاضرات يلي text_content فارغ عندها
exports.reextractTexts = asyncHandler(async (req, res) => {
  const lectures = await prisma.lecture.findMany({
    where: {
      text_content: null,
      pdf_url: { not: null },
    },
    select: { id: true, title: true, pdf_url: true, explanation_pdf: true },
  });

  if (!lectures.length) {
    return res.json({ success: true, message: 'كل المحاضرات عندها نص بالفعل', updated: 0 });
  }

  let updated = 0;
  const errors = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  for (const lecture of lectures) {
    try {
      const text = await extractText(lecture.pdf_url);
      let explanationText = null;
      if (lecture.explanation_pdf) {
        explanationText = await extractText(lecture.explanation_pdf);
      }

      if (text || explanationText) {
        await prisma.lecture.update({
          where: { id: lecture.id },
          data: {
            ...(text && { text_content: text }),
            ...(explanationText && { explanation_text: explanationText }),
          },
        });
        updated++;
      } else {
        errors.push({ id: lecture.id, title: lecture.title, reason: 'فشل الاستخراج' });
      }
    } catch (e) {
      errors.push({ id: lecture.id, title: lecture.title, reason: e.message });
    }

    await sleep(8000); // 8 ثواني بين كل محاضرة لتجنب rate limit
  }

  res.json({ success: true, total: lectures.length, updated, failed: errors.length, errors });
});

// ─── Quizzes ──────────────────────────────────────────────────────

exports.getQuiz = asyncHandler(async (req, res) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      questions: {
        orderBy: { order_num: 'asc' },
        include: { options: true },
      },
    },
  });
  if (!quiz) return res.status(404).json({ success: false, message: 'الكويز غير موجود' });
  res.json({ success: true, data: quiz });
});

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

// POST /admin/quizzes/extract-questions   (multipart: files = صور أو PDF)
// بيرجّع الأسئلة المستخرجة للمراجعة فقط — الحفظ عبر /quizzes/:quizId/questions/bulk
const MAX_EXTRACT_BYTES = 18 * 1024 * 1024; // حد Gemini للطلب الواحد ~20MB

exports.extractQuestions = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) {
    return res.status(400).json({ success: false, message: 'ارفع صورة أو ملف PDF واحد على الأقل (الحقل files)' });
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_EXTRACT_BYTES) {
    return res.status(400).json({ success: false, message: 'حجم الملفات كبير جداً (الحد الأقصى 18 MB للطلب الواحد)' });
  }

  let questions;
  try {
    questions = await extractQuestionsFromFiles(
      files.map((f) => ({
        buffer: f.buffer,
        mimetype: f.originalname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : f.mimetype,
      })),
    );
  } catch (e) {
    console.error('AI Error:', e.message);
    return res.status(502).json({ success: false, message: 'تعذّر استخراج الأسئلة بالذكاء الاصطناعي حالياً' });
  }

  if (!questions.length) {
    return res.status(422).json({ success: false, message: 'لم يتم العثور على أسئلة في الملف' });
  }

  res.json({ success: true, data: questions });
});

const QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'];

// POST /admin/quizzes/:quizId/questions/bulk   { questions: [...] }
exports.addQuestionsBulk = asyncHandler(async (req, res) => {
  const quizId = parseInt(req.params.quizId);
  const { questions } = req.body;

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, message: 'questions مطلوبة' });
  }

  for (const [i, q] of questions.entries()) {
    const label = `السؤال رقم ${i + 1}`;
    if (!q.question_text || !String(q.question_text).trim()) {
      return res.status(400).json({ success: false, message: `${label}: نص السؤال مطلوب` });
    }
    if (!QUESTION_TYPES.includes(q.question_type)) {
      return res.status(400).json({ success: false, message: `${label}: question_type غير صالح` });
    }
    if (q.question_type !== 'SHORT_ANSWER') {
      const options = Array.isArray(q.options) ? q.options : [];
      if (options.length < 2) {
        return res.status(400).json({ success: false, message: `${label}: يجب إضافة خيارين على الأقل` });
      }
      if (options.filter((o) => o.is_correct === true).length !== 1) {
        return res.status(400).json({ success: false, message: `${label}: يجب تحديد جواب صحيح واحد` });
      }
    }
  }

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { id: true } });
  if (!quiz) return res.status(404).json({ success: false, message: 'الكويز غير موجود' });

  // الأسئلة الجديدة بتنضاف بعد آخر سؤال موجود بالكويز
  const last = await prisma.quizQuestion.aggregate({ where: { quiz_id: quizId }, _max: { order_num: true } });
  const startOrder = last._max.order_num || 0;

  const created = await prisma.$transaction(
    questions.map((q, i) =>
      prisma.quizQuestion.create({
        data: {
          quiz_id: quizId,
          question_text: String(q.question_text).trim(),
          question_type: q.question_type,
          explanation: q.explanation || null,
          points: parseInt(q.points) || 1,
          order_num: startOrder + i + 1,
          options:
            q.question_type !== 'SHORT_ANSWER'
              ? { create: q.options.map((o) => ({ option_text: String(o.option_text), is_correct: o.is_correct === true })) }
              : undefined,
        },
        include: { options: true },
      }),
    ),
  );

  res.status(201).json({ success: true, data: created });
});

exports.updateQuestion = asyncHandler(async (req, res) => {
  const { question_text, points, explanation } = req.body;
  const data = {};
  if (question_text !== undefined) data.question_text = question_text;
  if (points !== undefined) data.points = parseInt(points);
  if (explanation !== undefined) data.explanation = explanation;
  const question = await prisma.quizQuestion.update({
    where: { id: parseInt(req.params.id) },
    data,
    include: { options: true },
  });
  res.json({ success: true, data: question });
});

exports.deleteQuestion = asyncHandler(async (req, res) => {
  await prisma.quizQuestion.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Question deleted' });
});

// ─── Lecture Questions (اختيار من متعدد لعنصر محتوى نوعه MCQ) ──
// مربوطة بعنصر المحتوى (المحاضرة) نفسو، منفصلة كلياً عن الكويزات

exports.getLectureQuestions = asyncHandler(async (req, res) => {
  const lectureId = parseInt(req.params.lectureId);
  const questions = await prisma.lectureQuestion.findMany({
    where: { lecture_id: lectureId },
    orderBy: { order_num: 'asc' },
    include: { options: true },
  });
  res.json({ success: true, data: questions });
});

exports.addLectureQuestion = asyncHandler(async (req, res) => {
  const { question_text, question_type, explanation, points, order_num, options } = req.body;
  const lectureId = parseInt(req.params.lectureId);

  const question = await prisma.lectureQuestion.create({
    data: {
      lecture_id: lectureId,
      question_text,
      question_type: question_type || 'MCQ',
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

exports.updateLectureQuestion = asyncHandler(async (req, res) => {
  const { question_text, question_type, points, explanation, order_num, options } = req.body;
  const id = parseInt(req.params.id);

  const data = {};
  if (question_text !== undefined) data.question_text = question_text;
  if (question_type !== undefined) data.question_type = question_type;
  if (points !== undefined) data.points = parseInt(points);
  if (explanation !== undefined) data.explanation = explanation;
  if (order_num !== undefined) data.order_num = parseInt(order_num);

  // لو أرسل الأدمن options، نستبدل القديمة بالجديدة كلياً
  if (Array.isArray(options)) {
    data.options = {
      deleteMany: {},
      create: options.map((o) => ({ option_text: o.option_text, is_correct: o.is_correct })),
    };
  }

  const question = await prisma.lectureQuestion.update({
    where: { id },
    data,
    include: { options: true },
  });
  res.json({ success: true, data: question });
});

exports.deleteLectureQuestion = asyncHandler(async (req, res) => {
  await prisma.lectureQuestion.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true, message: 'Lecture question deleted' });
});
