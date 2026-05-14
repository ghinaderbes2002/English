const router = require('express').Router();
const { authenticate, requireStudent } = require('../middleware/auth');
const student = require('../controllers/studentController');
const quiz = require('../controllers/quizController');
const chat = require('../controllers/chatController');

router.use(authenticate, requireStudent);

// التنقل الهرمي
router.get('/departments', student.getDepartments);
router.get('/departments/:departmentId/years', student.getYears);
router.get('/years/:yearId/semesters', student.getSemesters);
router.get('/semesters/:semesterId/subjects', student.getSubjects);

// المادة
router.get('/subjects/:subjectId/lectures', student.getLectures);
router.get('/subjects/:subjectId/quizzes', student.getSubjectQuizzes);

// المحاضرة والكويز
router.get('/lectures/:lectureId', student.getLecture);

// شات AI للمحاضرة
router.get('/chat/usage', chat.getDailyUsage);
router.get('/lectures/:lectureId/chat/usage', chat.getUsage);
router.post('/lectures/:lectureId/chat', chat.askQuestion);
router.get('/quizzes/:quizId', quiz.getQuiz);
router.post('/quizzes/:quizId/submit', quiz.submitQuiz);

// محاولاتي
router.get('/my-attempts', student.getMyAttempts);

module.exports = router;
