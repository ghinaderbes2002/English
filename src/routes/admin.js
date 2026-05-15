const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const userCtrl = require('../controllers/adminUserController');
const contentCtrl = require('../controllers/adminContentController');
const lectureQuizCtrl = require('../controllers/adminLectureQuizController');
const upload = require('../middleware/upload');
const { uploadLecture } = require('../middleware/upload');

router.use(authenticate, requireAdmin);

// Students
router.get('/students', userCtrl.getStudents);
router.get('/students/pending', userCtrl.getPendingStudents);
router.post('/students/activate', userCtrl.activateStudent);
router.post('/students', userCtrl.createStudent);
router.get('/students/:id', userCtrl.getStudent);
router.patch('/students/:id', userCtrl.updateStudent);
router.delete('/students/:id', userCtrl.deleteStudent);
router.post('/students/:id/grant-subjects', userCtrl.grantSubjects);
router.delete('/students/:id/subjects/:subjectId', userCtrl.revokeSubject);

// Departments
router.get('/departments', contentCtrl.getDepartments);
router.post('/departments', contentCtrl.createDepartment);
router.patch('/departments/:id', contentCtrl.updateDepartment);
router.delete('/departments/:id', contentCtrl.deleteDepartment);

// Years
router.get('/departments/:departmentId/years', contentCtrl.getYears);
router.get('/years', contentCtrl.getYears);
router.post('/years', contentCtrl.createYear);
router.patch('/years/:id', contentCtrl.updateYear);
router.delete('/years/:id', contentCtrl.deleteYear);

// Semesters
router.get('/years/:yearId/semesters', contentCtrl.getSemesters);
router.get('/semesters', contentCtrl.getSemesters);
router.post('/semesters', contentCtrl.createSemester);
router.patch('/semesters/:id', contentCtrl.updateSemester);
router.delete('/semesters/:id', contentCtrl.deleteSemester);

// Subjects
router.get('/subjects', contentCtrl.getSubjects);
router.post('/subjects', upload.single('cover_image'), contentCtrl.createSubject);
router.patch('/subjects/:id', upload.single('cover_image'), contentCtrl.updateSubject);
router.delete('/subjects/:id', contentCtrl.deleteSubject);

// Lectures
router.get('/subjects/:subjectId/lectures', lectureQuizCtrl.getLecturesBySubject);
router.get('/lectures/:id', lectureQuizCtrl.getLecture);
router.post('/lectures', uploadLecture, lectureQuizCtrl.createLecture);
router.patch('/lectures/:id', uploadLecture, lectureQuizCtrl.updateLecture);
router.delete('/lectures/:id', lectureQuizCtrl.deleteLecture);

// Maintenance
router.post('/maintenance/reextract-texts', lectureQuizCtrl.reextractTexts);

// Quizzes
router.get('/lectures/:lectureId/quizzes', lectureQuizCtrl.getQuizzesByLecture);
router.get('/quizzes/:id', lectureQuizCtrl.getQuiz);
router.post('/quizzes', lectureQuizCtrl.createQuiz);
router.patch('/quizzes/:id', lectureQuizCtrl.updateQuiz);
router.delete('/quizzes/:id', lectureQuizCtrl.deleteQuiz);
router.post('/quizzes/:quizId/questions', lectureQuizCtrl.addQuestion);
router.patch('/questions/:id', lectureQuizCtrl.updateQuestion);
router.delete('/questions/:id', lectureQuizCtrl.deleteQuestion);

module.exports = router;
