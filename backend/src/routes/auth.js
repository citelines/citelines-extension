const express = require('express');
const User = require('../models/User');
const { generateAnonymousId } = require('../utils/tokenGenerator');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

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

module.exports = router;
