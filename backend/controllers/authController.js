const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

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

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Always return the same response whether or not the user exists —
    // prevents leaking which emails are registered.
    if (!user) {
      return res.json({ message: 'If that email is registered, an OTP has been sent.' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    user.resetOtpHash = otpHash;
    user.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save({ validateBeforeSave: false });

    await transporter.sendMail({
      from: `BreathTruth <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Your BreathTruth password reset code',
      html: `
        <h2>Password Reset</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 4px;">${otp}</h1>
        <p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      `
    });

    res.json({ message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('+resetOtpHash +resetOtpExpiry');

    if (!user || !user.resetOtpHash || !user.resetOtpExpiry) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    if (user.resetOtpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired, please request a new one' });
    }

    const otpHash = crypto.createHash('sha256').update(String(otp || '')).digest('hex');
    if (otpHash !== user.resetOtpHash) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Issue a short-lived reset token so the next step (actual password change)
    // can't be called without having proven OTP ownership first.
    const resetToken = jwt.sign({ id: user._id, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '10m' });
    res.json({ resetToken });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Reset session expired, please start over' });
    }
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid reset session' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).json({ message: 'Invalid reset session' });

    user.password = newPassword; // pre('save') hook hashes this
    user.resetOtpHash = undefined;
    user.resetOtpExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};