// routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login, getMe, updateSettings, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  handleValidationErrors,
  registerValidationRules,
  loginValidationRules,
  updateSettingsValidationRules,
  forgotPasswordValidationRules,
  verifyOtpValidationRules,
  resetPasswordValidationRules
} = require('../middleware/validators');

router.post('/register', registerValidationRules, handleValidationErrors, register);
router.post('/login', loginValidationRules, handleValidationErrors, login);
router.get('/me', protect, getMe);
router.put('/settings', protect, updateSettingsValidationRules, handleValidationErrors, updateSettings);
router.post('/forgot-password', forgotPasswordValidationRules, handleValidationErrors, forgotPassword);
router.post('/verify-otp', verifyOtpValidationRules, handleValidationErrors, verifyResetOtp);
router.post('/reset-password', resetPasswordValidationRules, handleValidationErrors, resetPassword);

module.exports = router;