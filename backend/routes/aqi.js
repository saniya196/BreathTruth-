const express = require('express');
const router = express.Router();
const { getOfficialAqi, getComparison, getCurrentAqi } = require('../controllers/aqiController');
const { protect } = require('../middleware/auth');

router.get('/official', getOfficialAqi);
router.get('/current/:pincode', getCurrentAqi);
router.get('/comparison/:pincode', protect, getComparison);

module.exports = router;
