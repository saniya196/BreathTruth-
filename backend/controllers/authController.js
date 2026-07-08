const jwt = require('jsonwebtoken');
const User = require('../models/User');

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production. Refusing to start with an insecure default.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-only-secret-do-not-use-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

exports.register = async (req, res) => {
  try {
    const { name, email, password, pincode, locality, city } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(400).json({ message: 'Email already registered' });

    const user = await User.create({
      name: String(name || '').trim(),
      email: normalizedEmail,
      password,
      pincode: String(pincode || '').trim(),
      locality: String(locality || '').trim(),
      city: String(city || '').trim()
    });
    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role,
              pincode: user.pincode, locality: user.locality, city: user.city }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Every account is created via register(), which always passes through
    // the User model's pre('save') hook and gets bcrypt-hashed before it's
    // ever persisted — so comparePassword (bcrypt.compare) is the only
    // valid check here. A previous plaintext-equality fallback branch was
    // removed: it had no legitimate accounts to migrate (no code path in
    // this app ever creates a non-hashed password) and only added
    // unnecessary attack surface.
    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role,
              pincode: user.pincode, locality: user.locality, city: user.city,
              alertThreshold: user.alertThreshold }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.updateSettings = async (req, res) => {
  try {
    const { alertThreshold, alertsEnabled, alertEmail, alertInApp } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { alertThreshold, alertsEnabled, alertEmail, alertInApp },
      { new: true }
    ).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};