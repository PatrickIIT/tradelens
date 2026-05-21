// backend/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./routes/auth.js');
const certificateRoutes = require('./routes/certificates.js');
const documentRoutes    = require('./routes/documents.js');
const verifyRoutes      = require('./routes/verify.js');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Request Logger ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ─── Body Parser ──────────────────────────────────────────────────────────────
// 10mb limit matches the document upload cap enforced in routes/documents.js
app.use(express.json({ limit: '10mb' }));

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
// 100 requests per 15 minutes — suitable for MVP pilot (5 traders, Sprint S4)
const globalLimiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            100,
  standardHeaders: true,
  legacyHeaders:  false,
  message: {
    success: false,
    message: 'Too many requests. Please try again in 15 minutes.',
  },
});
app.use(globalLimiter);

// ─── Auth Route Rate Limiter ──────────────────────────────────────────────────
// Stricter limit on login and register to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Too many auth attempts. Please try again in 15 minutes.',
  },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
// Pinged every 3 days by GitHub Actions keep-alive workflow to prevent
// Supabase free tier from pausing (see .github/workflows/keep-alive.yml)
app.get('/health', (req, res) => {
  res.status(200).json({
    success:   true,
    status:    'ok',
    service:   'TradeLens API',
    corridor:  'Tanzania–Zambia',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/documents',    documentRoutes);
app.use('/api/verify',       verifyRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Catches any error passed via next(err) from routes or middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path} →`, err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ TradeLens API running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`   Corridor    : Tanzania (TZ) ↔ Zambia (ZM)`);
});

module.exports = app; // exported for Jest integration tests
