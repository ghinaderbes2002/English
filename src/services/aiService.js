const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    model: 'gemini-1.5-flash',
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
