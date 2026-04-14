const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

dotenv.config();

const app = express();

// CRA proxy and some hosting layers add X-Forwarded-For; trust first proxy hop.
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/aqi', require('./routes/aqi'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/map', require('./routes/map'));
app.use('/api/export', require('./routes/export'));
app.use('/api/civic', require('./routes/civic'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// MongoDB connection (fallback allows local dev startup without a .env file)
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/breathtruth';
mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Scheduled job: update community confidence scores every hour
cron.schedule('0 * * * *', async () => {
  try {
    const { updateConfidenceScores } = require('./utils/aggregator');
    await updateConfidenceScores();
    console.log('🔄 Confidence scores updated');
  } catch (err) {
    console.error('❌ Confidence score cron failed:', err.message);
  }
});

// Scheduled job: send AQI threshold alerts every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  try {
    const { sendThresholdAlerts } = require('./utils/alertService');
    await sendThresholdAlerts();
  } catch (err) {
    console.error('❌ Alert cron failed:', err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 BreathTruth server running on port ${PORT}`));
