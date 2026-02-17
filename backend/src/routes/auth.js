const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { generateAnonymousId } = require('../utils/tokenGenerator');
const { asyncHandler } = require('../middleware/errorHandler');
const { verifyPassword, generateToken } = require('../utils/password');
const { generateToken: generateJWT } = require('../config/jwt');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../services/email');
const validator = require('validator');
const { getExpiryInfo } = require('../middleware/checkExpiry');

const router = express.Router();

// Login rate limiting - prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST'  // Only limit POST requests
});

/**
 * POST /api/auth/register
 * Register a new anonymous user
 */
router.post('/register', asyncHandler(async (req, res) => {
  // Generate new anonymous ID
  const anonymousId = generateAnonymousId();

  // Check if it already exists (extremely unlikely but handle it)
  const exists = await User.exists(anonymousId);
  if (exists) {
    // Retry once
    const newAnonymousId = generateAnonymousId();
    const user = await User.create(newAnonymousId);
    return res.status(201).json({
      anonymousId: user.anonymous_id,
      userId: user.id,
      createdAt: user.created_at
    });
  }

  // Create user
  const user = await User.create(anonymousId);

  res.status(201).json({
    anonymousId: user.anonymous_id,
    userId: user.id,
    createdAt: user.created_at
  });
}));

/**
 * GET /api/auth/verify
 * Verify anonymous ID is valid (debugging endpoint)
 */
router.get('/verify', asyncHandler(async (req, res) => {
  const anonymousId = req.headers['x-anonymous-id'];

  if (!anonymousId) {
    return res.status(400).json({
      error: 'Missing X-Anonymous-ID header'
    });
  }

  const user = await User.findByAnonymousId(anonymousId);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      valid: false
    });
  }

  res.json({
    valid: true,
    userId: user.id,
    authType: user.auth_type,
    createdAt: user.created_at
  });
}));

// ==================== EMAIL/PASSWORD AUTHENTICATION ====================

/**
 * POST /api/auth/register-email
 * Register with email and password (or upgrade anonymous account)
 */
router.post('/register-email', asyncHandler(async (req, res) => {
  const { email, password, displayName, anonymousId } = req.body;

  // Validate email
  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Validate display name
  if (!displayName || displayName.trim().length < 2) {
    return res.status(400).json({ error: 'Display name must be at least 2 characters' });
  }

  if (displayName.length > 50) {
    return res.status(400).json({ error: 'Display name must be less than 50 characters' });
  }

  // Check if email already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    // Don't reveal email exists for security
    return res.status(400).json({
      error: 'Registration failed',
      message: 'This email may already be registered. Try logging in or resetting your password.'
    });
  }

  let user;

  // If anonymousId provided: upgrade existing anonymous account
  if (anonymousId) {
    const anonymousUser = await User.findByAnonymousId(anonymousId);

    if (!anonymousUser) {
      // Stale anonymousId — create a fresh registered account
      console.log(`[Auth] Anonymous account not found for ${anonymousId}, creating new registered user: ${email}`);
      user = await User.createWithPassword({ email, password, displayName });
    } else {
      user = await User.upgradeAnonymousToRegistered(anonymousId, {
        email,
        password,
        displayName
      });
      console.log(`[Auth] Upgraded anonymous account to registered: ${email} (${user.citations_count || 0} citations preserved)`);
    }
  }
  // Otherwise: create new registered account
  else {
    user = await User.createWithPassword({
      email,
      password,
      displayName
    });

    console.log(`[Auth] New registered user created: ${email}`);
  }

  // Send verification email
  await sendVerificationEmail(
    email,
    user.email_verification_token,
    displayName
  );

  res.status(201).json({
    message: 'Account created! Check your email to verify.',
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
    citationsPreserved: user.citations_count || 0
  });
}));

/**
 * POST /api/auth/verify-email
 * Verify email address with token
 */
router.post('/verify-email', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token required' });
  }

  const user = await User.findByVerificationToken(token);

  if (!user) {
    return res.status(400).json({
      error: 'Invalid or expired verification token',
      message: 'This verification link has expired or is invalid. Please request a new one.'
    });
  }

  // Verify email
  await User.verifyEmail(user.id);

  // Send welcome email
  await sendWelcomeEmail(user.email, user.display_name, 0);

  console.log(`[Auth] Email verified: ${user.email}`);

  res.json({
    message: 'Email verified successfully! You can now sign in.',
    email: user.email
  });
}));

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Find user by email
  const user = await User.findByEmail(email);

  if (!user || !user.password_hash) {
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Invalid email or password'
    });
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    return res.status(401).json({
      error: 'Invalid credentials',
      message: 'Invalid email or password'
    });
  }

  // Check if email verified
  if (!user.email_verified) {
    return res.status(403).json({
      error: 'Email not verified',
      message: 'Please verify your email before signing in. Check your inbox for the verification link.'
    });
  }

  // Generate JWT token
  const token = generateJWT(user);

  console.log(`[Auth] User logged in: ${user.email}`);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      citationsCount: user.citations_count || 0,
      authType: user.auth_type
    }
  });
}));

/**
 * POST /api/auth/forgot-password
 * Request password reset link
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const user = await User.findByEmail(email);

  // Don't reveal if user exists (security best practice)
  if (!user) {
    return res.json({
      message: 'If that email is registered, you will receive a password reset link.'
    });
  }

  // Generate reset token
  const resetToken = generateToken();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await User.setPasswordResetToken(user.id, resetToken, resetExpires);

  // Send reset email
  await sendPasswordResetEmail(user.email, resetToken, user.display_name);

  console.log(`[Auth] Password reset requested: ${user.email}`);

  res.json({
    message: 'If that email is registered, you will receive a password reset link.'
  });
}));

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password required' });
  }

  const user = await User.findByPasswordResetToken(token);

  if (!user) {
    return res.status(400).json({
      error: 'Invalid or expired reset token',
      message: 'This password reset link has expired or is invalid. Please request a new one.'
    });
  }

  // Update password (hashing happens in User.updatePassword)
  await User.updatePassword(user.id, newPassword);

  console.log(`[Auth] Password reset successful: ${user.email}`);

  res.json({
    message: 'Password reset successfully! You can now sign in with your new password.'
  });
}));

/**
 * GET /api/auth/expiry-info
 * Get account expiry information
 */
router.get('/expiry-info', getExpiryInfo);

module.exports = router;
