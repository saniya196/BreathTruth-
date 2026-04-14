const axios = require('axios');
const AqiAggregate = require('../models/AqiAggregate');

// Fetch official AQI from CPCB API
exports.getOfficialAqi = async (req, res) => {
  try {
    const { city } = req.query;
    // Real CPCB API call
    const response = await axios.get(process.env.CPCB_API_URL, {
      params: {
        'api-key': process.env.CPCB_API_KEY,
        format: 'json',
        filters: `[city=${city}]`,
        limit: 10
      }
    });
    const records = response.data?.records || [];
    res.json({ stations: records });
  } catch (err) {
    // Fallback: return mock data if CPCB API unavailable
    console.warn('CPCB API unavailable, using mock data');
    res.json({
      stations: getMockCpcbData(req.query.city),
      isMock: true
    });
  }
};

exports.getComparison = async (req, res) => {
  try {
    const { pincode } = req.params;
    const { days = 7 } = req.query;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const aggregates = await AqiAggregate.find({ pincode, date: { $gte: since } })
      .sort({ date: 1 });

    const comparison = aggregates.map(a => ({
      date: a.date,
      communityAqi: a.communityAqi,
      officialAqi: a.officialAqi,
      divergenceRatio: a.divergenceRatio,
      anomalyFlagged: a.anomalyFlagged,
      confidenceScore: a.confidenceScore,
      reportCount: a.reportCount
    }));

    // Calculate overall divergence stats
    const withBoth = comparison.filter(c => c.communityAqi && c.officialAqi);
    const avgDivergence = withBoth.length > 0
      ? withBoth.reduce((sum, c) => sum + (c.divergenceRatio || 1), 0) / withBoth.length
      : null;

    res.json({ comparison, avgDivergence, daysWithAnomaly: withBoth.filter(c => c.anomalyFlagged).length });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching comparison', error: err.message });
  }
};

exports.getCurrentAqi = async (req, res) => {
  try {
    const { pincode } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aggregate = await AqiAggregate.findOne({ pincode, date: { $gte: today } });
    const latest = aggregate || await AqiAggregate.findOne({ pincode }).sort({ date: -1 });

    if (!latest) return res.json({ aqi: null, category: 'unknown', advisory: getAdvisory(null) });

    const aqi = latest.communityAqi || latest.officialAqi;
    res.json({
      aqi,
      communityAqi: latest.communityAqi,
      officialAqi: latest.officialAqi,
      category: getCategory(aqi),
      advisory: getAdvisory(aqi),
      confidenceScore: latest.confidenceScore,
      anomalyFlagged: latest.anomalyFlagged,
      divergenceRatio: latest.divergenceRatio
    });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
};

// India CPCB AQI categories
function getCategory(aqi) {
  if (!aqi) return 'unknown';
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'satisfactory';
  if (aqi <= 200) return 'moderate';
  if (aqi <= 300) return 'poor';
  if (aqi <= 400) return 'very_poor';
  return 'severe';
}

function getAdvisory(aqi) {
  if (!aqi) return { text: 'No data available for your area yet.', precautions: [] };
  if (aqi <= 50) return {
    text: 'Air quality is Good. Enjoy outdoor activities.',
    precautions: []
  };
  if (aqi <= 100) return {
    text: 'Air quality is Satisfactory. Sensitive individuals should limit prolonged outdoor exertion.',
    precautions: ['Sensitive groups should take short breaks during outdoor activities']
  };
  if (aqi <= 200) return {
    text: 'Air quality is Moderate. People with respiratory/heart conditions should reduce outdoor exertion.',
    precautions: ['Reduce strenuous outdoor activity', 'Children should limit outdoor play']
  };
  if (aqi <= 300) return {
    text: 'Air quality is Poor. Avoid outdoor exercise. Wear N95 mask if stepping out.',
    precautions: ['Wear N95 mask outdoors', 'Keep windows closed', 'Avoid outdoor exercise', 'Elderly and children should stay indoors']
  };
  if (aqi <= 400) return {
    text: 'Air quality is Very Poor. Avoid all outdoor activities. N95 mandatory.',
    precautions: ['Stay indoors', 'Wear N95 if you must go out', 'Use air purifier indoors', 'Schools should cancel outdoor activities']
  };
  return {
    text: 'Air quality is Severe — health emergency conditions. Stay indoors.',
    precautions: ['Do NOT go outdoors', 'Seal windows and doors', 'Use air purifier on max', 'Seek medical attention if breathing difficulty']
  };
}

function getMockCpcbData(city) {
  return [
    { station: `${city || 'Hyderabad'} Central`, aqi: 142, pollutant: 'PM2.5', lastUpdated: new Date() },
    { station: `${city || 'Hyderabad'} North`, aqi: 128, pollutant: 'PM10', lastUpdated: new Date() }
  ];
}

module.exports.getCategory = getCategory;
module.exports.getAdvisory = getAdvisory;
