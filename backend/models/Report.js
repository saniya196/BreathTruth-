const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pincode: { type: String, required: true, index: true },
  locality: { type: String, required: true },
  city: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  aqiEstimate: {
    type: Number,
    required: true,
    min: 0,
    max: 500
  },
  // Symptoms-based reporting (if user doesn't have a sensor)
  symptoms: [{
    type: String,
    enum: ['eye_irritation', 'throat_irritation', 'coughing', 'difficulty_breathing',
           'headache', 'smell_pollution', 'visibility_reduced', 'none']
  }],
  // AQI derived from symptoms (if no direct measurement)
  symptomsAqi: { type: Number },
  pollutionSource: {
    type: String,
    enum: ['traffic', 'construction', 'factory', 'burning', 'dust', 'mixed', 'unknown'],
    required: true
  },
  description: { type: String, maxlength: 500 },
  imageUrl: { type: String }, // Optional photo evidence
  timestamp: { type: Date, default: Date.now },
  // Confidence tracking
  isVerified: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
  flagReason: { type: String }
}, { timestamps: true });

// Index for efficient querying by pincode + date
reportSchema.index({ pincode: 1, timestamp: -1 });
reportSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
