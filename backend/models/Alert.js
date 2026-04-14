const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pincode: { type: String, required: true },
  locality: { type: String, required: true },
  type: { type: String, enum: ['threshold_breach', 'anomaly', 'institution_risk'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  aqiAtAlert: { type: Number },
  threshold: { type: Number },
  read: { type: Boolean, default: false },
  emailSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

alertSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
