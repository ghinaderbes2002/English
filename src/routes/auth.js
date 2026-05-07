const router = require('express').Router();
const { register, studentLogin, adminLogin, getMe } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, try again later' },
});

router.post('/student/register', loginLimiter, register);
router.post('/student/login', loginLimiter, studentLogin);
router.post('/admin/login', loginLimiter, adminLogin);
router.get('/me', authenticate, getMe);

module.exports = router;
