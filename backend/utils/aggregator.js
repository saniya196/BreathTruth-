const Report = require('../models/Report');
const AqiAggregate = require('../models/AqiAggregate');

// Confidence scoring logic:
// Low: < 3 reports or high variance
// Moderate: 3-9 reports, moderate variance
// High: 10-19 reports, low variance
// Verified: 20+ reports, low variance

function calculateVariance(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

function getConfidenceLabel(reportCount, variance) {
  if (reportCount < 3) return { label: 'low', value: Math.min(reportCount * 10, 25) };
  if (reportCount < 10) {
    const baseScore = 30 + (reportCount * 5);
    const variancePenalty = Math.min(variance / 100, 20);
    return { label: variance > 2000 ? 'low' : 'moderate', value: Math.round(baseScore - variancePenalty) };
  }
  if (reportCount < 20) {
    const baseScore = 65 + ((reportCount - 10) * 2);
    return { label: variance > 1500 ? 'moderate' : 'high', value: Math.min(baseScore, 85) };
  }
  return { label: variance > 2000 ? 'high' : 'verified', value: Math.min(90 + Math.floor(reportCount / 10), 100) };
}

exports.recalculateAggregate = async (pincode, locality, city, date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const reports = await Report.find({
    pincode,
    timestamp: { $gte: startOfDay, $lte: endOfDay }
  });

  if (reports.length === 0) return null;

  const aqiValues = reports.map(r => r.aqiEstimate).filter(Boolean);
  const avg = Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length);
  const sorted = [...aqiValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const variance = calculateVariance(aqiValues);
  const { label, value } = getConfidenceLabel(reports.length, variance);

  // Sources breakdown
  const sourcesBreakdown = {};
  reports.forEach(r => {
    if (r.pollutionSource) {
      sourcesBreakdown[r.pollutionSource] = (sourcesBreakdown[r.pollutionSource] || 0) + 1;
    }
  });

  const aggregateData = {
    pincode, locality, city,
    date: startOfDay,
    communityAqi: avg,
    communityAqiMedian: median,
    communityAqiMin: Math.min(...aqiValues),
    communityAqiMax: Math.max(...aqiValues),
    reportCount: reports.length,
    confidenceScore: label,
    confidenceValue: value,
    sourcesBreakdown
  };

  return AqiAggregate.findOneAndUpdate(
    { pincode, date: startOfDay },
    aggregateData,
    { upsert: true, new: true }
  );
};

exports.updateConfidenceScores = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const aggregates = await AqiAggregate.find({ date: { $gte: today } });

  for (const agg of aggregates) {
    await exports.recalculateAggregate(agg.pincode, agg.locality, agg.city, agg.date);
  }

  // Check for anomalies and update divergence ratio
  const allToday = await AqiAggregate.find({ date: { $gte: today } });
  for (const agg of allToday) {
    if (agg.communityAqi && agg.officialAqi) {
      const ratio = agg.communityAqi / agg.officialAqi;
      const anomalyFlagged = ratio >= 2.0;
      await AqiAggregate.findByIdAndUpdate(agg._id, { divergenceRatio: ratio, anomalyFlagged });
    }
  }
};
