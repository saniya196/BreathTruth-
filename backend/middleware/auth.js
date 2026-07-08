// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production. Refusing to start with an insecure default.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set — using an insecure development-only fallback. Set JWT_SECRET in backend/.env.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-only-secret-do-not-use-in-production';

exports.protect = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
  }
};