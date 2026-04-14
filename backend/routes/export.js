// routes/export.js
const express = require('express');
const router = express.Router();
const { exportCSV } = require('../controllers/exportController');
const { protect } = require('../middleware/auth');
router.get('/csv', protect, exportCSV);
module.exports = router;
