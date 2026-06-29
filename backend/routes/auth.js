// routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login, getMe, updateSettings } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  handleValidationErrors,
  registerValidationRules,
  loginValidationRules,
  updateSettingsValidationRules
} = require('../middleware/validators');

router.post('/register', registerValidationRules, handleValidationErrors, register);
router.post('/login', loginValidationRules, handleValidationErrors, login);
router.get('/me', protect, getMe);
router.put('/settings', protect, updateSettingsValidationRules, handleValidationErrors, updateSettings);

module.exports = router;