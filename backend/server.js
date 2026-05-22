const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

require('dotenv').config();

const app = express();

// CRA proxy and some hosting layers add X-Forwarded-For; trust first proxy hop.
app.set('trust proxy', 1);

const normalizeOrigin = (origin) => String(origin || '').trim().replace(/\/+$/, '');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(origin => normalizeOrigin(origin))
  .filter(Boolean);

// Middleware
app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests and same-origin calls.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true
}));
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

// Debug: report CLIENT_URL / CORS config for troubleshooting
app.get('/api/debug/cors', (req, res) => {
  res.json({
    clientUrl: process.env.CLIENT_URL || null,
    allowedOrigins,
    corsOriginConfigured: !!process.env.CLIENT_URL
  });
});
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
