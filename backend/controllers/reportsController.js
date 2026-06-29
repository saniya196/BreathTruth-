const Report = require('../models/Report');
const AqiAggregate = require('../models/AqiAggregate');
const { recalculateAggregate } = require('../utils/aggregator');
const { fetchOfficialAqiWithFallback } = require('../utils/officialAqi');

const COMPLAINT_WINDOW_DAYS = 7;
const MIN_UNIQUE_REPORTERS = 11; // "more than 10" distinct accounts

exports.submitReport = async (req, res) => {
  try {
    const { aqiEstimate, symptoms, pollutionSource, description, coordinates } = req.body;

    const pincode = req.user.pincode;
    const locality = req.user.locality;
    const city = req.user.city;

    // Symptom-to-AQI mapping if no direct measurement
    let finalAqi = aqiEstimate;
    if (!aqiEstimate && symptoms && symptoms.length > 0) {
      finalAqi = mapSymptomsToAqi(symptoms);
    }

    const report = await Report.create({
      user: req.user._id,
      pincode, locality, city, coordinates,
      aqiEstimate: finalAqi,
      symptoms: symptoms || [],
      pollutionSource: pollutionSource || 'unknown',
      description
    });

    // Update user report count
    await require('../models/User').findByIdAndUpdate(req.user._id, { $inc: { reportsCount: 1 } });

    // Trigger aggregate recalculation for this pincode+day
    await recalculateAggregate(pincode, locality, city, new Date());

    res.status(201).json({ message: 'Report submitted successfully', report });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting report', error: err.message });
  }
};

// Map reported symptoms to approximate AQI range
function mapSymptomsToAqi(symptoms) {
  const weights = {
    eye_irritation: 100, throat_irritation: 120, coughing: 150,
    difficulty_breathing: 200, headache: 130, smell_pollution: 100,
    visibility_reduced: 180, none: 50
  };
  const scores = symptoms.map(s => weights[s] || 100);
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

exports.getAreaReports = async (req, res) => {
  try {
    const { pincode, days = 7 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const reports = await Report.find({ pincode, timestamp: { $gte: since } })
      .populate('user', 'name')
      .sort({ timestamp: -1 })
      .limit(100);
    res.json({ reports, count: reports.length });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reports', error: err.message });
  }
};

exports.getWeeklyTrend = async (req, res) => {
  try {
    const { pincode } = req.params;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const aggregates = await AqiAggregate.find({ pincode, date: { $gte: since } })
      .sort({ date: 1 });

    // Backfill missing official AQI values so trend graph can always render government series.
    for (const agg of aggregates) {
      if (!agg.officialAqi && agg.city) {
        const official = await fetchOfficialAqiWithFallback({
          city: agg.city,
          pincode: agg.pincode,
          locality: agg.locality
        });
        if (official?.aqi) {
          agg.officialAqi = official.aqi;
          agg.officialStation = official.station;
          agg.officialDataFetched = true;
          if (agg.communityAqi) {
            agg.divergenceRatio = agg.communityAqi / official.aqi;
            agg.anomalyFlagged = agg.divergenceRatio >= 2.0;
          }
          await agg.save();
        }
      }
    }

    res.json({ trend: aggregates });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching trend', error: err.message });
  }
};

exports.getAreaSummary = async (req, res) => {
  try {
    const { pincode } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aggregate = await AqiAggregate.findOne({ pincode, date: { $gte: today } });

    // If no aggregate today, fall back to the most recent one within the last
    // 7 days only — matching the same window used by getWeeklyTrend, so the
    // Civic Action and Trends pages stay consistent instead of one showing
    // stale data (sometimes weeks old) that the other has already excluded.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const latest = aggregate || await AqiAggregate.findOne({
      pincode,
      date: { $gte: sevenDaysAgo }
    }).sort({ date: -1 });

    const since = new Date(Date.now() - COMPLAINT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const [recentReportCount, uniqueReporterIds] = await Promise.all([
      Report.countDocuments({ pincode, timestamp: { $gte: since } }),
      Report.distinct('user', { pincode, timestamp: { $gte: since } })
    ]);

    const uniqueReporterCount = uniqueReporterIds.length;
    const civicEligibility = {
      canGenerateComplaint: uniqueReporterCount >= MIN_UNIQUE_REPORTERS,
      minUniqueReporters: MIN_UNIQUE_REPORTERS,
      uniqueReporterCount,
      recentReportCount,
      windowDays: COMPLAINT_WINDOW_DAYS
    };

    res.json({ summary: latest, civicEligibility });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching summary', error: err.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    if (report.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await report.deleteOne();
    res.json({ message: 'Report deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting report', error: err.message });
  }
};