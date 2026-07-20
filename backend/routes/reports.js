const express = require('express');
const router = express.Router();
const { submitReport, getAreaReports, getWeeklyTrend, getAreaSummary, deleteReport } = require('../controllers/reportsController');
const { protect } = require('../middleware/auth');
const { reportValidationRules, handleValidationErrors } = require('../middleware/validators');

router.post('/', protect, reportValidationRules, handleValidationErrors, submitReport);
router.get('/', protect, getAreaReports);
router.get('/trend/:pincode', protect, getWeeklyTrend);
router.get('/summary/:pincode', getAreaSummary); // Public
router.delete('/:id', protect, deleteReport);

module.exports = router;
