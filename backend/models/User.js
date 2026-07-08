const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'admin', 'government'], default: 'user' },
  pincode: { type: String, required: true },
  locality: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, default: 'Telangana' },
  alertThreshold: { type: Number, default: 200 }, // AQI threshold for notifications
  alertsEnabled: { type: Boolean, default: true },
  alertEmail: { type: Boolean, default: true },
  alertInApp: { type: Boolean, default: true },
  reportsCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  resetOtpHash: { type: String, select: false },
  resetOtpExpiry: { type: Date, select: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
