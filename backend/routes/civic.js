const express = require('express');
const router = express.Router();
const { generateComplaintPDF, escalateArea } = require('../controllers/civicController');
const { protect } = require('../middleware/auth');

router.get('/complaint-pdf/:pincode', protect, generateComplaintPDF);
router.post('/escalate', protect, escalateArea);

module.exports = router;
