const { createObjectCsvStringifier } = require('csv-writer');
const Report = require('../models/Report');
const AqiAggregate = require('../models/AqiAggregate');

exports.exportCSV = async (req, res) => {
  try {
    const { pincode, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Fetch aggregates for the range
    const aggregates = await AqiAggregate.find({
      pincode,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'date', title: 'Date' },
        { id: 'locality', title: 'Locality' },
        { id: 'pincode', title: 'Pincode' },
        { id: 'communityAqi', title: 'Community AQI' },
        { id: 'officialAqi', title: 'Official AQI (CPCB)' },
        { id: 'reportCount', title: 'Number of Reports' },
        { id: 'confidenceScore', title: 'Community Confidence Score' },
        { id: 'anomalyFlagged', title: 'Anomaly Flagged' },
        { id: 'divergenceRatio', title: 'Divergence Ratio (Community/Official)' },
        { id: 'topSource', title: 'Top Pollution Source' }
      ]
    });

    const records = aggregates.map(a => {
      const sources = a.sourcesBreakdown;
      const topSource = sources ? Object.entries(sources).sort((x, y) => y[1] - x[1])[0]?.[0] : 'unknown';
      return {
        date: new Date(a.date).toLocaleDateString('en-IN'),
        locality: a.locality,
        pincode: a.pincode,
        communityAqi: a.communityAqi || '',
        officialAqi: a.officialAqi || '',
        reportCount: a.reportCount,
        confidenceScore: a.confidenceScore,
        anomalyFlagged: a.anomalyFlagged ? 'Yes' : 'No',
        divergenceRatio: a.divergenceRatio ? a.divergenceRatio.toFixed(2) : '',
        topSource: topSource || 'unknown'
      };
    });

    const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="breathtruth-${pincode}-${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).json({ message: 'Error generating CSV', error: err.message });
  }
};
