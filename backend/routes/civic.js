const express = require('express');
const router = express.Router();
const { generateComplaintPDF, escalateArea, getEscalations } = require('../controllers/civicController');
const { protect } = require('../middleware/auth');

router.get('/complaint-pdf/:pincode', protect, generateComplaintPDF);
router.post('/escalate', protect, escalateArea);
router.get('/escalations/:pincode', protect, getEscalations);

module.exports = router;
