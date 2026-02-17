require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const sharesRoutes = require('./routes/shares');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { setupCounterResetJobs } = require('./jobs/resetCounters');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Railway proxy for rate limiting and X-Forwarded-For headers
app.set('trust proxy', true);

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Chrome Private Network Access (PNA) - Allow YouTube.com to access localhost
// Required for extensions to make API calls from public websites to localhost
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow YouTube.com and chrome extensions in development
  if (origin && (origin.includes('youtube.com') || origin.startsWith('chrome-extension://'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Anonymous-ID, Authorization');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// CORS configuration (as backup)
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow same-origin requests (admin dashboard)
    if (origin && (origin.includes('railway.app') || origin.includes('localhost'))) {
      return callback(null, true);
    }

    // Allow chrome-extension:// origins
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow YouTube.com (both development and production)
    if (origin && origin.includes('youtube.com')) {
      return callback(null, true);
    }

    // Allow configured origins
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : [];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow localhost in development
    if (process.env.NODE_ENV === 'development' && origin && origin.includes('localhost')) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Anonymous-ID', 'Authorization']
};

app.use(cors(corsOptions));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: 'Too many requests', message: 'Too many requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// More relaxed rate limiting for collaborative mode
// Only limit write operations (POST/PUT/DELETE), not reads (GET)
const writeShareLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 write operations per hour per IP
  message: 'Too many shares created/updated from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => req.method === 'GET' // Don't rate limit GET requests
});

app.use('/api/', generalLimiter);
app.use('/api/shares', writeShareLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve static files (admin dashboard)
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));

// Email verification link handler
const User = require('./models/User');
const { sendWelcomeEmail } = require('./services/email');

app.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send(verifyEmailHTML('error', 'No verification token provided.'));
  }

  try {
    const user = await User.findByVerificationToken(token);

    if (!user) {
      return res.status(400).send(verifyEmailHTML('error', 'This verification link has expired or is invalid. Please request a new one.'));
    }

    await User.verifyEmail(user.id);
    await sendWelcomeEmail(user.email, user.display_name, 0);

    console.log(`[Auth] Email verified via link: ${user.email}`);
    res.send(verifyEmailHTML('success', `Your email <strong>${user.email}</strong> has been verified. You can close this tab and sign in.`));
  } catch (err) {
    console.error('[Auth] Email verification error:', err);
    res.status(500).send(verifyEmailHTML('error', 'Something went wrong. Please try again or contact support.'));
  }
});

function verifyEmailHTML(type, message) {
  const isSuccess = type === 'success';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${isSuccess ? 'Email Verified' : 'Verification Failed'}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: #fff; border-radius: 8px; padding: 2.5rem; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.4rem; margin: 0 0 0.75rem; color: #1a1a1a; }
    p { color: #555; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? '✅' : '❌'}</div>
    <h1>${isSuccess ? 'Email Verified!' : 'Verification Failed'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`YouTube Annotator API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);

  // Setup cron jobs for resetting rate limit counters
  setupCounterResetJobs();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // In production, you might want to exit the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
