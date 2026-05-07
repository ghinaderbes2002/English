const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (user.expires_at && user.expires_at < new Date()) {
      return res.status(403).json({ success: false, message: 'Subscription expired' });
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (req.user?.role !== 'STUDENT') {
    return res.status(403).json({ success: false, message: 'Student access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireStudent };
