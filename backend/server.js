require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const http = require('http');
const { init: initSocket } = require('./utils/socketManager');
const { createAllowedOrigins, isAllowedOrigin } = require('./utils/cors');

require('dotenv').config();

const app = express();

// CRA proxy and some hosting layers add X-Forwarded-For; trust first proxy hop.
app.set('trust proxy', 1);

const allowedOrigins = createAllowedOrigins(process.env.CLIENT_URL);

// Placed here (after isAllowedOrigin is defined, before routes) so both
// Express CORS and Socket.io CORS share the exact same origin check.

// Middleware
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && !isAllowedOrigin(origin, allowedOrigins)) {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  next();
});
app.use(cors({
  origin(origin, callback) {
    // Allow non-browser requests and same-origin calls.
    return callback(null, isAllowedOrigin(origin, allowedOrigins));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rate limiting -----------------------------------------------------
// General limiter: applies to all /api/ traffic as a baseline guard.
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', generalLimiter);

// Stricter limiter for auth endpoints specifically. The general 100/15min
// limit is too loose to meaningfully slow down a brute-force login attempt
// on its own, so auth routes get a much tighter ceiling on top of it.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please try again in a few minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Separate limiter for report submission, to prevent a single user/IP from
// flooding the community AQI aggregate with repeated submissions.
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reports submitted. Please slow down and try again shortly.' }
});
app.use('/api/reports', reportLimiter);
// -----------------------------------------------------------------------

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

// Debug: report CLIENT_URL / CORS config for troubleshooting.
// Gated to non-production so this doesn't leak config details on the live deployment.
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/cors', (req, res) => {
    res.json({
      clientUrl: process.env.CLIENT_URL || null,
      allowedOrigins,
      corsOriginConfigured: !!process.env.CLIENT_URL
    });
  });
}

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

const server = http.createServer(app);
initSocket(server, origin => isAllowedOrigin(origin, allowedOrigins));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 BreathTruth server running on port ${PORT}`));