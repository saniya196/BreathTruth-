const PDFDocument = require('pdfkit');
const AqiAggregate = require('../models/AqiAggregate');
const Report = require('../models/Report');
const Escalation = require('../models/Escalation');

const COMPLAINT_WINDOW_DAYS = 7;
const MIN_UNIQUE_REPORTERS = 11; // "more than 10" distinct accounts

exports.generateComplaintPDF = async (req, res) => {
  try {
    const { pincode } = req.params;
    const user = req.user;

    // Gather 7-day data
    const since = new Date(Date.now() - COMPLAINT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const aggregates = await AqiAggregate.find({ pincode, date: { $gte: since } }).sort({ date: 1 });
    const totalReports = aggregates.reduce((s, a) => s + a.reportCount, 0);

    const uniqueReporterIds = await Report.distinct('user', {
      pincode,
      timestamp: { $gte: since }
    });
    const uniqueReporterCount = uniqueReporterIds.length;

    if (aggregates.length === 0) {
      return res.status(404).json({ message: 'No data available for this pincode' });
    }

    if (uniqueReporterCount < MIN_UNIQUE_REPORTERS) {
      return res.status(400).json({
        message: `Complaint letter requires reports from at least ${MIN_UNIQUE_REPORTERS} different accounts in the last ${COMPLAINT_WINDOW_DAYS} days.`,
        minUniqueReporters: MIN_UNIQUE_REPORTERS,
        uniqueReporterCount,
        windowDays: COMPLAINT_WINDOW_DAYS
      });
    }

    const avgCommunityAqi = Math.round(aggregates.reduce((s, a) => s + (a.communityAqi || 0), 0) / aggregates.length);
    const avgOfficialAqi = aggregates[0]?.officialAqi
      ? Math.round(aggregates.reduce((s, a) => s + (a.officialAqi || 0), 0) / aggregates.length) : null;
    const locality = aggregates[0]?.locality || user.locality;

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="breathtruth-complaint-${pincode}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('CITIZEN AIR QUALITY COMPLAINT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text('Submitted via BreathTruth Community Platform', { align: 'center' });
    doc.moveDown();

    // Date and reference
    doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`);
    doc.text(`Reference No: BT-${pincode}-${Date.now().toString().slice(-6)}`);
    doc.moveDown();

    // Addressee
    doc.fontSize(12).font('Helvetica-Bold').text('To,');
    doc.font('Helvetica').text('The Commissioner,');
    doc.text('Greater Hyderabad Municipal Corporation (GHMC) /');
    doc.text('Telangana State Pollution Control Board (TSPCB)');
    doc.text('Hyderabad, Telangana');
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Subject: Persistent High Air Pollution Levels in ' + locality + ' — Urgent Action Required');
    doc.moveDown();

    // Body
    doc.font('Helvetica').fontSize(11);
    doc.text(`Sir/Madam,\n\nWe, the residents of ${locality} (Pincode: ${pincode}), through the BreathTruth community monitoring platform, wish to formally bring to your attention the alarming air pollution levels recorded in our locality over the past 7 days.`);
    doc.moveDown();

    // Data table
    doc.font('Helvetica-Bold').text('Community-Reported Air Quality Data (Last 7 Days):');
    doc.moveDown(0.5);
    doc.font('Helvetica');

    aggregates.forEach(a => {
      const dateStr = new Date(a.date).toLocaleDateString('en-IN');
      const communityStr = a.communityAqi ? `${a.communityAqi} AQI` : 'No data';
      const officialStr = a.officialAqi ? `${a.officialAqi} AQI` : 'N/A';
      doc.text(`  ${dateStr}: Community AQI: ${communityStr} | Official AQI: ${officialStr} | Reports: ${a.reportCount} | Confidence: ${a.confidenceScore}`);
    });

    doc.moveDown();
    doc.font('Helvetica-Bold').text('Summary Statistics:');
    doc.font('Helvetica');
    doc.text(`• Average Community-Reported AQI: ${avgCommunityAqi}`);
    if (avgOfficialAqi) doc.text(`• Average Official AQI: ${avgOfficialAqi}`);
    if (avgOfficialAqi && avgCommunityAqi) {
      const ratio = (avgCommunityAqi / avgOfficialAqi).toFixed(1);
      doc.text(`• Community data shows ${ratio}x higher pollution than official stations`);
    }
    doc.text(`• Total citizen reports submitted: ${totalReports}`);
    doc.text(`• Unique reporting accounts (last ${COMPLAINT_WINDOW_DAYS} days): ${uniqueReporterCount}`);
    doc.moveDown();

    doc.text('We request the following urgent actions:');
    doc.text('1. Installation of air quality monitoring equipment in our locality');
    doc.text('2. Investigation into identified pollution sources (construction sites, industrial units)');
    doc.text('3. Enforcement action against violators under Air (Prevention and Control of Pollution) Act, 1981');
    doc.text('4. Public disclosure of monitoring results and remediation plan');
    doc.moveDown();

    doc.text('Submitted by:');
    doc.text(`Name: ${user.name}`);
    doc.text(`Email: ${user.email}`);
    doc.text(`Locality: ${user.locality}, ${user.pincode}`);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown();
    doc.text('This complaint is backed by community-sourced data collected through BreathTruth (breathtruth.in)');

    doc.end();
  } catch (err) {
    res.status(500).json({ message: 'Error generating PDF', error: err.message });
  }
};

exports.escalateArea = async (req, res) => {
  try {
    const { pincode, description } = req.body;
    if (!pincode) {
      return res.status(400).json({ message: 'pincode is required' });
    }
    const escalation = await Escalation.create({
      user: req.user._id,
      pincode,
      locality: req.user.locality,
      description
    });
    res.status(201).json({
      message: 'Escalation logged. Download the PDF to send to authorities.',
      escalation
    });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
};

// List escalations for a pincode — lets users/admins actually see what's been filed.
exports.getEscalations = async (req, res) => {
  try {
    const { pincode } = req.params;
    const escalations = await Escalation.find({ pincode })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ escalations });
  } catch (err) {
    res.status(500).json({ message: 'Error', error: err.message });
  }
};
