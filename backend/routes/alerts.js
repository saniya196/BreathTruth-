const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getAlerts, markAlertRead } = require('../utils/alertService');

router.get('/', protect, async (req, res) => {
  try {
    const alerts = await getAlerts(req.user._id);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching alerts', error: err.message });
  }
});

router.put('/:id/read', protect, async (req, res) => {
  try {
    const alert = await markAlertRead(req.params.id, req.user._id);
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
});

module.exports = router;
