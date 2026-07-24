const Report = require('../models/Report');
const AqiAggregate = require('../models/AqiAggregate');
const { fetchOfficialAqiWithFallback } = require('./officialAqi');
const { nominatimGet } = require('./nominatim');
const { getIO } = require('./socketManager');

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

// --- Geocoding for the map heatmap ------------------------------------
// Coordinates only need to be resolved once per pincode, then reused on
// every later aggregate for that same pincode. This in-memory cache avoids
// re-geocoding (and re-throttling against Nominatim) on every report
// submission for an already-known area.
const pincodeCoordsCache = new Map();

async function geocodePincode(pincode, locality, city) {
  const cacheKey = String(pincode || '').trim();
  if (!cacheKey) return null;
  if (pincodeCoordsCache.has(cacheKey)) return pincodeCoordsCache.get(cacheKey);

  const queries = [
    `${pincode} ${locality || ''} ${city || ''} India`.trim(),
    `${locality || ''} ${city || ''} India`.trim(),
    `${pincode} India`.trim()
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const { data } = await nominatimGet('https://nominatim.openstreetmap.org/search', {
        params: { format: 'jsonv2', q: query, limit: 1, countrycodes: 'in' },
        headers: { 'User-Agent': 'BreathTruth/1.0 (community-aqi-map)' },
        timeout: 12000
      });

      if (Array.isArray(data) && data.length > 0) {
        const coords = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        pincodeCoordsCache.set(cacheKey, coords);
        return coords;
      }
    } catch (err) {
      console.debug('geocodePincode query failed:', query, err.message || err);
      // Try next query variant.
    }
  }

  // Cache the miss too, briefly in-process, so a bad/unresolvable pincode
  // doesn't trigger a fresh geocode attempt (and rate-limit risk) on every
  // single report submitted for it within this server's lifetime.
  pincodeCoordsCache.set(cacheKey, null);
  return null;
}
// -----------------------------------------------------------------------

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
  const official = await fetchOfficialAqiWithFallback({ pincode, locality, city });

  // Reuse existing coordinates for this pincode if we've already geocoded
  // it (either earlier today or on a previous aggregate), otherwise
  // geocode it now so the map/heatmap has something to plot.
  let coords = pincodeCoordsCache.get(String(pincode).trim());
  if (coords === undefined) {
    const existing = await AqiAggregate.findOne({ pincode, lat: { $ne: null } }).select('lat lng');
    if (existing?.lat != null && existing?.lng != null) {
      coords = { lat: existing.lat, lng: existing.lng };
      pincodeCoordsCache.set(String(pincode).trim(), coords);
    } else {
      coords = await geocodePincode(pincode, locality, city);
    }
  }

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
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    communityAqi: avg,
    communityAqiMedian: median,
    communityAqiMin: Math.min(...aqiValues),
    communityAqiMax: Math.max(...aqiValues),
    reportCount: reports.length,
    confidenceScore: label,
    confidenceValue: value,
    sourcesBreakdown,
    officialAqi: official?.aqi || null,
    officialStation: official?.station || null,
    officialDataFetched: Boolean(official?.aqi)
  };

  if (aggregateData.communityAqi && aggregateData.officialAqi) {
    aggregateData.divergenceRatio = aggregateData.communityAqi / aggregateData.officialAqi;
    aggregateData.anomalyFlagged = aggregateData.divergenceRatio >= 2.0;
  }

  const updated = await AqiAggregate.findOneAndUpdate(
    { pincode, date: startOfDay },
    aggregateData,
    { upsert: true, new: true }
  );

  try {
    getIO().to(String(pincode)).emit('aqi:update', {
      pincode,
      communityAqi: updated.communityAqi,
      officialAqi: updated.officialAqi,
      confidenceScore: updated.confidenceScore,
      anomalyFlagged: updated.anomalyFlagged,
      reportCount: updated.reportCount
    });
  } catch (e) {
    // Socket layer not initialized (e.g. running a standalone script) — non-fatal.
  }

  return updated;
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