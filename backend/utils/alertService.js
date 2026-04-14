const nodemailer = require('nodemailer');
const User = require('../models/User');
const Alert = require('../models/Alert');
const AqiAggregate = require('../models/AqiAggregate');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

exports.sendThresholdAlerts = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const latestAggregates = await AqiAggregate.find({ date: { $gte: today } });
  const usersWithAlerts = await User.find({ alertsEnabled: true });

  for (const user of usersWithAlerts) {
    const agg = latestAggregates.find(a => a.pincode === user.pincode);
    if (!agg) continue;

    const currentAqi = agg.communityAqi || agg.officialAqi;
    if (!currentAqi || currentAqi <= user.alertThreshold) continue;

    // Check if we already sent an alert for this user+pincode today
    const existingAlert = await Alert.findOne({
      user: user._id,
      pincode: user.pincode,
      type: 'threshold_breach',
      createdAt: { $gte: today }
    });
    if (existingAlert) continue;

    const { getCategory } = require('../controllers/aqiController');
    const category = getCategory(currentAqi);
    const title = `⚠️ AQI Alert: ${user.locality}`;
    const message = `Current AQI in ${user.locality} has reached ${currentAqi} (${category.replace('_', ' ').toUpperCase()}), exceeding your threshold of ${user.alertThreshold}.`;

    // Save in-app alert
    await Alert.create({
      user: user._id,
      pincode: user.pincode,
      locality: user.locality,
      type: 'threshold_breach',
      title,
      message,
      aqiAtAlert: currentAqi,
      threshold: user.alertThreshold
    });

    // Send email if enabled
    if (user.alertEmail) {
      try {
        await transporter.sendMail({
          from: `BreathTruth <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: title,
          html: `
            <h2>Air Quality Alert — ${user.locality}</h2>
            <p>${message}</p>
            <p><strong>What to do:</strong></p>
            <ul>
              <li>Wear N95 mask if stepping out</li>
              <li>Keep windows and doors closed</li>
              <li>Avoid outdoor exercise</li>
              <li>Children and elderly should stay indoors</li>
            </ul>
            <p>Visit <a href="https://breathtruth.in">BreathTruth</a> for real-time updates.</p>
          `
        });
        await Alert.findOneAndUpdate(
          { user: user._id, pincode: user.pincode, type: 'threshold_breach', createdAt: { $gte: today } },
          { emailSent: true }
        );
      } catch (emailErr) {
        console.error('Email send failed:', emailErr.message);
      }
    }
  }
};

exports.getAlerts = async (userId) => {
  return Alert.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
};

exports.markAlertRead = async (alertId, userId) => {
  return Alert.findOneAndUpdate({ _id: alertId, user: userId }, { read: true }, { new: true });
};
