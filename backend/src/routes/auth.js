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
const { authenticateUser } = require('../middleware/auth');

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

  // Check if display name already exists (case-insensitive)
  const existingByName = await User.findByDisplayName(displayName.trim());
  if (existingByName) {
    return res.status(400).json({
      error: 'Display name already taken',
      message: 'That display name is already in use. Please choose a different one.'
    });
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
      authType: user.auth_type,
      youtubeChannelId: user.youtube_channel_id || null,
      youtubeVerified: user.youtube_verified || false,
      youtubeChannelTitle: user.youtube_channel_title || null,
      isBanned: user.is_banned || false
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

// ==================== YOUTUBE OAUTH AUTHENTICATION ====================

/**
 * Fetch YouTube channel info using a Google access token
 * @param {string} accessToken
 * @returns {Promise<{id, title}|null>}
 */
async function fetchYouTubeChannel(accessToken) {
  const resp = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return null;
  const data = await resp.json();
  const channel = data.items && data.items[0];
  if (!channel) return null;
  return { id: channel.id, title: channel.snippet?.title || null };
}

/**
 * POST /api/auth/youtube
 * Login or register via YouTube channel OAuth.
 * No auth required — this is the entry point.
 *
 * Body: { accessToken, displayName?, anonymousId? }
 */
router.post('/youtube', asyncHandler(async (req, res) => {
  const { accessToken, displayName, anonymousId } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken required' });
  }

  // Verify channel with YouTube API
  const channel = await fetchYouTubeChannel(accessToken);
  if (!channel) {
    return res.status(400).json({
      error: 'No YouTube channel found',
      message: 'No YouTube channel is associated with this Google account.'
    });
  }

  const { id: channelId, title: channelTitle } = channel;

  // Check for existing account linked to this channel
  const existingUser = await User.findByYouTubeChannelId(channelId);
  if (existingUser) {
    const token = generateJWT(existingUser);
    console.log(`[Auth] YouTube login: ${existingUser.display_name} (${channelId})`);
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: existingUser.id,
        email: existingUser.email || null,
        displayName: existingUser.display_name,
        citationsCount: existingUser.citations_count || 0,
        authType: existingUser.auth_type,
        youtubeChannelId: existingUser.youtube_channel_id,
        youtubeVerified: existingUser.youtube_verified,
        youtubeChannelTitle: existingUser.youtube_channel_title,
        isBanned: existingUser.is_banned || false
      }
    });
  }

  // No existing account — need a display name for new account
  const rawName = displayName ? displayName.trim() : (channelTitle ? channelTitle.trim() : null);

  // Validate proposed display name
  let resolvedName = null;
  if (rawName && rawName.length >= 2 && rawName.length <= 50) {
    const taken = await User.findByDisplayName(rawName);
    if (!taken) {
      resolvedName = rawName;
    }
  }

  // If we still don't have a valid name, ask the client to provide one
  if (!resolvedName) {
    return res.status(200).json({
      needsDisplayName: true,
      channelId,
      channelTitle,
      suggestedName: channelTitle ? channelTitle.trim().substring(0, 50) : ''
    });
  }

  // Create or upgrade account
  let user;
  if (anonymousId) {
    const anonymousUser = await User.findByAnonymousId(anonymousId);
    if (anonymousUser) {
      user = await User.upgradeAnonymousToYouTube(anonymousId, {
        channelId,
        channelTitle,
        displayName: resolvedName
      });
      console.log(`[Auth] Upgraded anonymous to YouTube: ${resolvedName} (${channelId})`);
    }
  }

  if (!user) {
    user = await User.createWithYouTube({ channelId, channelTitle, displayName: resolvedName });
    console.log(`[Auth] New YouTube account: ${resolvedName} (${channelId})`);
  }

  const token = generateJWT(user);

  res.status(201).json({
    message: 'Account created',
    token,
    user: {
      id: user.id,
      email: user.email || null,
      displayName: user.display_name,
      citationsCount: user.citations_count || 0,
      authType: user.auth_type,
      youtubeChannelId: user.youtube_channel_id,
      youtubeVerified: user.youtube_verified,
      youtubeChannelTitle: user.youtube_channel_title,
      isBanned: false
    }
  });
}));

/**
 * POST /api/auth/youtube/connect
 * Connect a YouTube channel to an existing logged-in account.
 * Requires JWT auth.
 *
 * If a separate youtube-type account already exists for this channel,
 * returns { needsMerge: true } so the client can prompt the user.
 *
 * Body: { accessToken }
 */
router.post('/youtube/connect', authenticateUser, asyncHandler(async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken required' });
  }

  const channel = await fetchYouTubeChannel(accessToken);
  if (!channel) {
    return res.status(400).json({
      error: 'No YouTube channel found',
      message: 'No YouTube channel is associated with this Google account.'
    });
  }

  const { id: channelId, title: channelTitle } = channel;

  // Check if a separate youtube-auth account exists for this channel
  const secondaryAccount = await User.findYouTubeAccountByChannelId(channelId, req.user.id);
  if (secondaryAccount) {
    console.log(`[Auth] Merge needed: ${req.user.display_name} ← ${secondaryAccount.display_name} (${channelId})`);
    return res.json({
      needsMerge: true,
      secondaryDisplayName: secondaryAccount.display_name,
      secondaryShareCount: secondaryAccount.citations_count || 0,
      channelId,
      channelTitle
    });
  }

  const updated = await User.setYouTubeChannel(req.user.id, channelId, channelTitle);

  console.log(`[Auth] YouTube channel connected: ${req.user.display_name} → ${channelId}`);

  res.json({
    channelId: updated.youtube_channel_id,
    channelTitle: updated.youtube_channel_title,
    youtubeVerified: updated.youtube_verified
  });
}));

/**
 * POST /api/auth/merge
 * Merge a secondary YouTube account into the current (primary) account.
 * Requires JWT auth (primary account).
 *
 * Body: { accessToken } — Google OAuth token proving YouTube channel ownership
 */
router.post('/merge', authenticateUser, asyncHandler(async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken required' });
  }

  // Primary account must not be anonymous
  if (req.user.auth_type === 'anonymous') {
    return res.status(400).json({
      error: 'Cannot merge into anonymous account',
      message: 'Please create a full account before merging.'
    });
  }

  // Verify channel ownership via YouTube API
  const channel = await fetchYouTubeChannel(accessToken);
  if (!channel) {
    return res.status(400).json({
      error: 'No YouTube channel found',
      message: 'No YouTube channel is associated with this Google account.'
    });
  }

  const { id: channelId, title: channelTitle } = channel;

  // Find the secondary youtube-auth account for this channel
  const secondary = await User.findYouTubeAccountByChannelId(channelId, req.user.id);
  if (!secondary) {
    return res.status(404).json({
      error: 'No account to merge',
      message: 'No separate YouTube account found for this channel.'
    });
  }

  // Guard: no self-merge
  if (secondary.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot merge account into itself' });
  }

  // Guard: no merging banned/suspended accounts
  if (secondary.is_banned || secondary.is_suspended) {
    return res.status(400).json({
      error: 'Cannot merge a suspended account',
      message: 'The YouTube account is suspended and cannot be merged.'
    });
  }

  // Guard: no merging already-merged accounts
  if (secondary.auth_type === 'merged') {
    return res.status(400).json({
      error: 'Account already merged',
      message: 'This YouTube account has already been merged into another account.'
    });
  }

  // Perform the merge
  const updatedPrimary = await User.mergeAccounts(req.user.id, secondary.id);

  // Ensure YouTube channel is set on primary (mergeAccounts handles this,
  // but also set it explicitly if the primary didn't have it before)
  if (!updatedPrimary.youtube_channel_id) {
    await User.setYouTubeChannel(req.user.id, channelId, channelTitle);
    updatedPrimary.youtube_channel_id = channelId;
    updatedPrimary.youtube_channel_title = channelTitle;
    updatedPrimary.youtube_verified = true;
  }

  // Generate new JWT with updated user info
  const token = generateJWT(updatedPrimary);

  console.log(`[Auth] Account merged: ${secondary.display_name} → ${updatedPrimary.display_name} (${channelId})`);

  res.json({
    message: 'Accounts merged successfully',
    token,
    user: {
      id: updatedPrimary.id,
      email: updatedPrimary.email || null,
      displayName: updatedPrimary.display_name,
      citationsCount: updatedPrimary.citations_count || 0,
      authType: updatedPrimary.auth_type,
      youtubeChannelId: updatedPrimary.youtube_channel_id,
      youtubeVerified: updatedPrimary.youtube_verified || true,
      youtubeChannelTitle: updatedPrimary.youtube_channel_title,
      isBanned: updatedPrimary.is_banned || false
    }
  });
}));

module.exports = router;
