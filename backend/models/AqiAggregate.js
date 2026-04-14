const mongoose = require('mongoose');

const aqiAggregateSchema = new mongoose.Schema({
  pincode: { type: String, required: true },
  locality: { type: String, required: true },
  city: { type: String, required: true },
  date: { type: Date, required: true }, // Stored as start of day UTC
  // Community data
  communityAqi: { type: Number }, // Average of all reports
  communityAqiMedian: { type: Number },
  communityAqiMin: { type: Number },
  communityAqiMax: { type: Number },
  reportCount: { type: Number, default: 0 },
  // Confidence score
  confidenceScore: {
    type: String,
    enum: ['low', 'moderate', 'high', 'verified'],
    default: 'low'
  },
  confidenceValue: { type: Number, default: 0 }, // 0-100
  // Official government data
  officialAqi: { type: Number },
  officialStation: { type: String },
  officialDataFetched: { type: Boolean, default: false },
  // Divergence analysis
  divergenceRatio: { type: Number }, // communityAqi / officialAqi
  anomalyFlagged: { type: Boolean, default: false },
  // Pollution sources breakdown
  sourcesBreakdown: {
    traffic: { type: Number, default: 0 },
    construction: { type: Number, default: 0 },
    factory: { type: Number, default: 0 },
    burning: { type: Number, default: 0 },
    dust: { type: Number, default: 0 },
    mixed: { type: Number, default: 0 },
    unknown: { type: Number, default: 0 }
  },
  // Event markers for graph
  events: [{
    name: String,
    type: { type: String, enum: ['festival', 'weather', 'construction', 'other'] }
  }]
}, { timestamps: true });

aqiAggregateSchema.index({ pincode: 1, date: -1 });

module.exports = mongoose.model('AqiAggregate', aqiAggregateSchema);
