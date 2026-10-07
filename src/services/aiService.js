const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

let genAI = null;

const getClient = () => {
  if (genAI) return genAI;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY غير معرّف في .env');
  genAI = new GoogleGenerativeAI(key);
  return genAI;
};

/**
 * يطرح سؤالاً للذكاء الاصطناعي عن محاضرة معينة
 * @param {{ title: string, content?: string|null }} lecture
 * @param {string} question سؤال الطالب
 * @returns {Promise<string>} نص الإجابة
 */
exports.askAboutLecture = async (lecture, question) => {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    systemInstruction: buildSystemPrompt(lecture),
  });

  const result = await model.generateContent(question);
  const text = result?.response?.text?.();
  if (!text) throw new Error('لم نحصل على إجابة من الـ AI');
  return text.trim();
};

const buildSystemPrompt = (lecture) => {
  const lines = [
    'أنت مدرّس مساعد للطلاب الجامعيين.',
    `العنوان: ${lecture.title}`,
  ];

  if (lecture.content && lecture.content.trim()) {
    lines.push('محتوى المحاضرة:', lecture.content.trim());
  } else {
    lines.push('(لا يوجد نص متاح للمحاضرة، أجب بناءً على عنوانها وخبرتك العامة)');
  }

  lines.push(
    '',
    'القواعد:',
    '- أجب بنفس لغة سؤال الطالب (عربية أو إنجليزية)',
    '- اجعل إجابتك واضحة ومختصرة (3 إلى 6 أسطر)',
    '- إن كان السؤال خارج موضوع المحاضرة، أعد توجيه الطالب بأدب',
    '- لا تجب بمعلومات قد تكون غير صحيحة، اعترف بعدم المعرفة بدلاً من التخمين',
  );

  return lines.join('\n');
};

const QUESTIONS_SCHEMA = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      question_text: { type: SchemaType.STRING },
      question_type: { type: SchemaType.STRING, format: 'enum', enum: ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'] },
      explanation: { type: SchemaType.STRING, nullable: true },
      // FILE = الجواب محدد بالملف، AI = المودل هو يلي حدده (بدها مراجعة)
      answer_source: { type: SchemaType.STRING, format: 'enum', enum: ['FILE', 'AI'] },
      options: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            option_text: { type: SchemaType.STRING },
            is_correct: { type: SchemaType.BOOLEAN },
          },
          required: ['option_text', 'is_correct'],
        },
      },
    },
    required: ['question_text', 'question_type', 'answer_source', 'options'],
  },
};

const EXTRACT_QUESTIONS_PROMPT = [
  'استخرج كل الأسئلة الموجودة في الملفات المرفقة بالترتيب الذي وردت به.',
  '',
  'القواعد:',
  '- انسخ نص السؤال والخيارات كما هي حرفياً وبنفس لغتها، بدون ترقيم السؤال وبدون حروف الخيارات (A, B, ...)',
  '- question_type: MCQ للاختيار من متعدد، TRUE_FALSE لأسئلة صح/خطأ (خياران فقط)، SHORT_ANSWER للأسئلة المقالية (options فارغة)',
  '- لكل سؤال MCQ أو TRUE_FALSE يجب أن يكون خيار واحد فقط is_correct = true',
  '- إن كان الجواب الصحيح محدداً في الملف (تظليل، دائرة، علامة، سلّم إجابات) استخدمه واجعل answer_source = FILE',
  '- إن لم يكن محدداً، حدد الجواب الصحيح بنفسك واجعل answer_source = AI',
  '- explanation: شرح الجواب إن وُجد في الملف، وإلا null',
  '- إن لم تجد أي أسئلة أعد مصفوفة فارغة',
].join('\n');

/**
 * يستخرج الأسئلة والأجوبة من صور / ملفات PDF
 * @param {{ buffer: Buffer, mimetype: string }[]} files
 * @returns {Promise<object[]>} الأسئلة بصيغة جاهزة للمراجعة ثم الحفظ
 */
exports.extractQuestionsFromFiles = async (files) => {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: QUESTIONS_SCHEMA,
      temperature: 0,
    },
  });

  const parts = files.map((f) => ({
    inlineData: { mimeType: f.mimetype, data: f.buffer.toString('base64') },
  }));

  const result = await model.generateContent([...parts, EXTRACT_QUESTIONS_PROMPT]);
  const text = result?.response?.text?.();
  if (!text) throw new Error('لم نحصل على إجابة من الـ AI');

  const questions = JSON.parse(text);
  return questions.map((q, i) => ({
    question_text: q.question_text,
    question_type: q.question_type,
    explanation: q.explanation || null,
    answer_source: q.answer_source,
    points: 1,
    order_num: i + 1,
    options: q.question_type === 'SHORT_ANSWER' ? [] : q.options || [],
  }));
};
