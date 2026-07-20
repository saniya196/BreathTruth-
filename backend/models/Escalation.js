const mongoose = require('mongoose');

const escalationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pincode: { type: String, required: true, index: true },
  locality: { type: String, required: true },
  description: { type: String, maxlength: 1000 },
  status: {
    type: String,
    enum: ['submitted', 'acknowledged', 'resolved'],
    default: 'submitted'
  }
}, { timestamps: true });

escalationSchema.index({ pincode: 1, createdAt: -1 });

module.exports = mongoose.model('Escalation', escalationSchema);
