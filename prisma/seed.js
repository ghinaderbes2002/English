require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء الـ Seed...\n');

  // ─── Admin ───────────────────────────────────────────────────────────────────

  const hashedPassword = await bcrypt.hash(process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345', 10);

  const admin = await prisma.user.upsert({
    where: { access_code: 'ADMIN001' },
    update: {},
    create: {
      full_name: 'المدير العام',
      access_code: 'ADMIN001',
      password: hashedPassword,
      role: 'ADMIN',
      is_active: true,
      is_pending: false,
    },
  });
  console.log(`✅ Admin: ${admin.access_code}`);

  // ─── Academic Years + Semesters ──────────────────────────────────────────────

  // ─── Departments ─────────────────────────────────────────────────
  const deptsData = [
    { name: 'قسم اللغة الإنجليزية', description: 'English Language Department', order_num: 1 },
    { name: 'قسم الرياضيات', description: 'Mathematics Department', order_num: 2 },
  ];

  const depts = [];
  for (const d of deptsData) {
    const existing = await prisma.department.findFirst({ where: { name: d.name } });
    const dept = existing || await prisma.department.create({ data: d });
    depts.push(dept);
  }
  console.log(`✅ ${depts.length} أقسام`);

  // ─── Academic Years ───────────────────────────────────────────────
  const yearsData = [
    { name: 'السنة الأولى', order_num: 1, department_id: depts[0].id },
    { name: 'السنة الثانية', order_num: 2, department_id: depts[0].id },
    { name: 'السنة الثالثة', order_num: 3, department_id: depts[0].id },
  ];

  const years = [];
  for (const y of yearsData) {
    const existing = await prisma.academicYear.findFirst({
      where: { name: y.name, department_id: y.department_id },
    });
    const year = existing || await prisma.academicYear.create({ data: y });
    years.push(year);
  }

  const allSemesters = [];
  for (const year of years) {
    for (const sem of [
      { name: 'الفصل الأول', order_num: 1 },
      { name: 'الفصل الثاني', order_num: 2 },
    ]) {
      const existing = await prisma.semester.findFirst({
        where: { year_id: year.id, order_num: sem.order_num },
      });
      const semester = existing || await prisma.semester.create({
        data: { year_id: year.id, ...sem },
      });
      allSemesters.push(semester);
    }
  }
  console.log(`✅ ${years.length} سنوات + ${allSemesters.length} فصول`);

  // ─── Subjects ────────────────────────────────────────────────────────────────
  // السنة الأولى - الفصل الأول (allSemesters[0])
  // السنة الأولى - الفصل الثاني (allSemesters[1])
  // السنة الثانية - الفصل الأول (allSemesters[2])
  // ...

  const subjectsData = [
    // السنة الأولى - الفصل الأول
    { semester_id: allSemesters[0].id, name: 'English Grammar - Basics', description: 'قواعد اللغة الإنجليزية الأساسية', order: 1 },
    { semester_id: allSemesters[0].id, name: 'Reading & Comprehension', description: 'القراءة والفهم', order: 2 },
    // السنة الأولى - الفصل الثاني
    { semester_id: allSemesters[1].id, name: 'Vocabulary Building', description: 'بناء المفردات', order: 1 },
    { semester_id: allSemesters[1].id, name: 'Writing Skills', description: 'مهارات الكتابة', order: 2 },
    // السنة الثانية - الفصل الأول
    { semester_id: allSemesters[2].id, name: 'Advanced Grammar', description: 'القواعد المتقدمة', order: 1 },
    { semester_id: allSemesters[2].id, name: 'Conversation & Speaking', description: 'المحادثة والتحدث', order: 2 },
    // السنة الثانية - الفصل الثاني
    { semester_id: allSemesters[3].id, name: 'Business English', description: 'الإنجليزية للأعمال', order: 1 },
    // السنة الثالثة - الفصل الأول
    { semester_id: allSemesters[4].id, name: 'Academic Writing', description: 'الكتابة الأكاديمية', order: 1 },
    { semester_id: allSemesters[4].id, name: 'IELTS Preparation', description: 'التحضير لامتحان IELTS', order: 2 },
  ];

  const subjects = [];
  for (const s of subjectsData) {
    const { order, ...data } = s;
    const subject = await prisma.subject.create({ data });
    subjects.push(subject);
  }
  console.log(`✅ ${subjects.length} مواد`);

  // ─── Lectures ────────────────────────────────────────────────────────────────

  const grammarSubject = subjects[0]; // Grammar - Basics
  const readingSubject = subjects[1]; // Reading

  const lecturesData = [
    {
      subject_id: grammarSubject.id,
      title: 'Lesson 1 - Parts of Speech',
      content_type: 'TEXT',
      order_num: 1,
      text_content: `Parts of speech are the building blocks of English grammar.

**Nouns**: A noun is a word that names a person, place, thing, or idea.
Examples: teacher, school, book, happiness

**Verbs**: A verb expresses action or a state of being.
Examples: run, jump, is, are, seem

**Adjectives**: An adjective modifies a noun or pronoun.
Examples: big, blue, fast, happy

**Adverbs**: An adverb modifies a verb, adjective, or another adverb.
Examples: quickly, very, well, almost

**Pronouns**: A pronoun takes the place of a noun.
Examples: he, she, it, they, we`,
    },
    {
      subject_id: grammarSubject.id,
      title: 'Lesson 2 - Tenses Overview',
      content_type: 'TEXT',
      order_num: 2,
      text_content: `English has three main tenses: Past, Present, and Future.

**Simple Present**: Used for habits and facts.
- I study English every day.
- The sun rises in the east.

**Simple Past**: Used for completed actions.
- She visited Paris last year.
- They watched the movie yesterday.

**Simple Future**: Used for future plans.
- I will travel next month.
- He is going to start a new job.

**Present Continuous**: Used for actions happening now.
- I am studying right now.
- They are playing football.`,
    },
    {
      subject_id: grammarSubject.id,
      title: 'Lesson 3 - Articles (a, an, the)',
      content_type: 'TEXT',
      order_num: 3,
      text_content: `Articles are used before nouns to define them.

**Indefinite Articles (a / an)**:
- Use "a" before consonant sounds: a book, a car, a university
- Use "an" before vowel sounds: an apple, an hour, an elephant

**Definite Article (the)**:
- Use "the" when both speaker and listener know what is being referred to.
- The sun is hot. (there is only one sun)
- Please close the door. (a specific door)

**No Article**:
- Used with plural nouns in general: Dogs are loyal animals.
- Used with abstract nouns: Love is powerful.`,
    },
    {
      subject_id: readingSubject.id,
      title: 'Reading 1 - The Importance of Education',
      content_type: 'TEXT',
      order_num: 1,
      text_content: `Read the following passage and answer the questions.

Education is one of the most powerful tools for changing the world. It gives people the knowledge and skills they need to improve their lives and the lives of others. Through education, individuals can break the cycle of poverty and create better opportunities for themselves and their families.

In today's rapidly changing world, education has become more important than ever. The job market requires workers who can think critically, solve problems, and adapt to new situations. These are all skills that a good education can provide.

Furthermore, education is not just about getting a job. It helps people understand the world around them, make informed decisions, and participate actively in society. An educated population is essential for a healthy democracy.

**Vocabulary:**
- Powerful: having great power or strength
- Cycle: a series of events that are regularly repeated
- Adapt: to change in order to deal with new situations`,
    },
  ];

  const lectures = [];
  for (const l of lecturesData) {
    const lecture = await prisma.lecture.create({ data: l });
    lectures.push(lecture);
  }
  console.log(`✅ ${lectures.length} محاضرات`);

  // ─── Quizzes + Questions + Options ───────────────────────────────────────────

  const quiz1 = await prisma.quiz.create({
    data: {
      lecture_id: lectures[0].id, // Parts of Speech
      title: 'Quiz - Parts of Speech',
      description: 'اختبر فهمك لأقسام الكلام في اللغة الإنجليزية',
      questions: {
        create: [
          {
            question_text: 'Which of the following is a NOUN?',
            question_type: 'MCQ',
            explanation: 'A noun names a person, place, thing, or idea. "Happiness" is an abstract noun.',
            points: 1,
            order_num: 1,
            options: {
              create: [
                { option_text: 'Run', is_correct: false },
                { option_text: 'Happiness', is_correct: true },
                { option_text: 'Quickly', is_correct: false },
                { option_text: 'Beautiful', is_correct: false },
              ],
            },
          },
          {
            question_text: 'Which word is a VERB in this sentence: "She runs every morning."',
            question_type: 'MCQ',
            explanation: 'Verbs express actions. "Runs" is the action in this sentence.',
            points: 1,
            order_num: 2,
            options: {
              create: [
                { option_text: 'She', is_correct: false },
                { option_text: 'Runs', is_correct: true },
                { option_text: 'Every', is_correct: false },
                { option_text: 'Morning', is_correct: false },
              ],
            },
          },
          {
            question_text: 'An adjective modifies a noun or pronoun.',
            question_type: 'TRUE_FALSE',
            explanation: 'Correct! Adjectives describe or modify nouns and pronouns (e.g., big house, happy child).',
            points: 1,
            order_num: 3,
            options: {
              create: [
                { option_text: 'True', is_correct: true },
                { option_text: 'False', is_correct: false },
              ],
            },
          },
          {
            question_text: '"Quickly" is an example of which part of speech?',
            question_type: 'MCQ',
            explanation: 'Adverbs modify verbs, adjectives, or other adverbs. Words ending in "-ly" are usually adverbs.',
            points: 1,
            order_num: 4,
            options: {
              create: [
                { option_text: 'Noun', is_correct: false },
                { option_text: 'Verb', is_correct: false },
                { option_text: 'Adjective', is_correct: false },
                { option_text: 'Adverb', is_correct: true },
              ],
            },
          },
          {
            question_text: 'Give an example of a pronoun and explain why it is used.',
            question_type: 'SHORT_ANSWER',
            explanation: 'Pronouns replace nouns to avoid repetition. Examples: he, she, they, it, we.',
            points: 2,
            order_num: 5,
            options: { create: [] },
          },
        ],
      },
    },
  });

  const quiz2 = await prisma.quiz.create({
    data: {
      lecture_id: lectures[1].id, // Tenses
      title: 'Quiz - English Tenses',
      description: 'اختبر معرفتك بأزمنة اللغة الإنجليزية',
      questions: {
        create: [
          {
            question_text: 'Which sentence is in the Simple Past tense?',
            question_type: 'MCQ',
            explanation: '"Visited" is the past form of "visit", making this a Simple Past sentence.',
            points: 1,
            order_num: 1,
            options: {
              create: [
                { option_text: 'I visit Paris every year.', is_correct: false },
                { option_text: 'She visited Paris last year.', is_correct: true },
                { option_text: 'They will visit Paris soon.', is_correct: false },
                { option_text: 'He is visiting Paris now.', is_correct: false },
              ],
            },
          },
          {
            question_text: 'The Present Continuous tense is used for actions happening right now.',
            question_type: 'TRUE_FALSE',
            explanation: 'Correct! Present Continuous (am/is/are + verb-ing) describes actions in progress at the moment of speaking.',
            points: 1,
            order_num: 2,
            options: {
              create: [
                { option_text: 'True', is_correct: true },
                { option_text: 'False', is_correct: false },
              ],
            },
          },
          {
            question_text: 'Complete the sentence: "The sun _____ in the east." (Simple Present)',
            question_type: 'MCQ',
            explanation: 'Simple Present is used for facts and habits. "Rises" is the correct form for third person singular.',
            points: 1,
            order_num: 3,
            options: {
              create: [
                { option_text: 'rise', is_correct: false },
                { option_text: 'rises', is_correct: true },
                { option_text: 'rose', is_correct: false },
                { option_text: 'will rise', is_correct: false },
              ],
            },
          },
        ],
      },
    },
  });

  const quiz3 = await prisma.quiz.create({
    data: {
      lecture_id: lectures[2].id, // Articles
      title: 'Quiz - Articles (a, an, the)',
      description: 'اختبر استخدامك لأدوات التعريف والتنكير',
      questions: {
        create: [
          {
            question_text: 'Choose the correct article: "She is _____ engineer."',
            question_type: 'MCQ',
            explanation: '"An" is used before vowel sounds. "Engineer" starts with a vowel sound (e).',
            points: 1,
            order_num: 1,
            options: {
              create: [
                { option_text: 'a', is_correct: false },
                { option_text: 'an', is_correct: true },
                { option_text: 'the', is_correct: false },
                { option_text: 'no article', is_correct: false },
              ],
            },
          },
          {
            question_text: 'We use "a" before words that start with a vowel sound.',
            question_type: 'TRUE_FALSE',
            explanation: 'False! We use "an" before vowel sounds, and "a" before consonant sounds.',
            points: 1,
            order_num: 2,
            options: {
              create: [
                { option_text: 'True', is_correct: false },
                { option_text: 'False', is_correct: true },
              ],
            },
          },
          {
            question_text: 'Fill in the blank: "Please close _____ door." Which article is correct?',
            question_type: 'MCQ',
            explanation: '"The" is used when referring to a specific thing that both speaker and listener know about.',
            points: 1,
            order_num: 3,
            options: {
              create: [
                { option_text: 'a', is_correct: false },
                { option_text: 'an', is_correct: false },
                { option_text: 'the', is_correct: true },
                { option_text: 'no article', is_correct: false },
              ],
            },
          },
          {
            question_text: 'Write a sentence using "a", "an", and "the" correctly.',
            question_type: 'SHORT_ANSWER',
            explanation: 'Example: "I saw an elephant at the zoo. It was a huge animal."',
            points: 3,
            order_num: 4,
            options: { create: [] },
          },
        ],
      },
    },
  });

  console.log(`✅ 3 كويزات مع أسئلة`);

  // ─── Students ────────────────────────────────────────────────────────────────

  const studentPassword = await bcrypt.hash('student123', 10);
  const studentsData = [
    { full_name: 'أحمد محمد علي', university_id: '2023001' },
    { full_name: 'سارة خالد',     university_id: '2023002' },
    { full_name: 'محمود حسن',     university_id: '2023003' },
  ];

  const students = [];
  for (const s of studentsData) {
    const student = await prisma.user.upsert({
      where: { university_id: s.university_id },
      update: {},
      create: { ...s, password: studentPassword, role: 'STUDENT', is_active: true, is_pending: false },
    });
    students.push(student);
  }
  console.log(`✅ ${students.length} طلاب`);

  // ─── Subject Access ───────────────────────────────────────────────────────────

  // أحمد: يشوف Grammar + Reading (سنة أولى فصل أول)
  await prisma.userSubjectAccess.createMany({
    skipDuplicates: true,
    data: [
      { user_id: students[0].id, subject_id: subjects[0].id }, // Grammar
      { user_id: students[0].id, subject_id: subjects[1].id }, // Reading
      { user_id: students[0].id, subject_id: subjects[2].id }, // Vocabulary
    ],
  });

  // سارة: يشوف Grammar فقط
  await prisma.userSubjectAccess.createMany({
    skipDuplicates: true,
    data: [
      { user_id: students[1].id, subject_id: subjects[0].id }, // Grammar
    ],
  });

  // محمود: يشوف كل شي في السنة الأولى
  await prisma.userSubjectAccess.createMany({
    skipDuplicates: true,
    data: [
      { user_id: students[2].id, subject_id: subjects[0].id },
      { user_id: students[2].id, subject_id: subjects[1].id },
      { user_id: students[2].id, subject_id: subjects[2].id },
      { user_id: students[2].id, subject_id: subjects[3].id },
    ],
  });

  console.log(`✅ صلاحيات الطلاب`);

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed اكتمل بنجاح!

👤 Admin Login:
   Code:     ADMIN001
   Password: ${process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@12345'}

👨‍🎓 طلاب للاختبار (الباسوورد للجميع: student123):
   2023001 (أحمد)  → Grammar + Reading + Vocabulary
   2023002 (سارة)  → Grammar فقط
   2023003 (محمود) → 4 مواد (سنة أولى كاملة)

📚 المحتوى:
   3 سنوات × 2 فصل = 6 فصول
   ${subjects.length} مواد
   ${lectures.length} محاضرات
   3 كويزات مع أسئلة MCQ + True/False + Short Answer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((e) => { console.error('❌ Seed فشل:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
