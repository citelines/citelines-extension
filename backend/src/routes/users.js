const express = require('express');
const User = require('../models/User');
const Share = require('../models/Share');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');

const router = express.Router();

/**
 * GET /api/users/:userId/profile
 * Get public user profile information
 */
router.get('/:userId/profile', asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Get user info
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'This user does not exist'
    });
  }

  // Get user's shares (videos they've cited)
  const shares = await Share.findByUserId(userId, 100, 0);

  // Group by video and count citations
  const videoStats = shares.reduce((acc, share) => {
    const existing = acc.find(v => v.videoId === share.video_id);
    const citationCount = share.annotations ? share.annotations.length : 0;

    if (existing) {
      existing.citationCount += citationCount;
      existing.shareCount += 1;
    } else {
      acc.push({
        videoId: share.video_id,
        title: share.title,
        citationCount,
        shareCount: 1,
        lastCitedAt: share.updated_at
      });
    }
    return acc;
  }, []);

  // Sort by most recent
  videoStats.sort((a, b) => new Date(b.lastCitedAt) - new Date(a.lastCitedAt));

  // Calculate total stats
  const totalCitations = videoStats.reduce((sum, v) => sum + v.citationCount, 0);
  const totalVideos = videoStats.length;

  res.json({
    userId: user.id,
    displayName: user.display_name,
    authType: user.auth_type,
    accountCreated: user.created_at,
    stats: {
      totalCitations,
      totalVideos,
      citationsPerVideo: totalVideos > 0 ? (totalCitations / totalVideos).toFixed(1) : 0
    },
    videos: videoStats.slice(0, 10), // Return top 10 videos
    // Placeholder for future features
    karma: null, // TODO: Implement voting system
    approvalRate: null // TODO: Implement moderation
  });
}));

/**
 * GET /api/users/by-name/:displayName/profile
 * Get user profile by display name (for easy lookup)
 */
router.get('/by-name/:displayName/profile', asyncHandler(async (req, res) => {
  const { displayName } = req.params;

  // Find user by display name
  const query = `
    SELECT id, display_name, auth_type, created_at, citations_count
    FROM users
    WHERE display_name = $1
    LIMIT 1
  `;

  const result = await db.query(query, [displayName]);
  const user = result.rows[0];

  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'No user found with that display name'
    });
  }

  // Redirect to user ID endpoint
  const userIdPath = `/api/users/${user.id}/profile`;

  // For simplicity, just fetch and return the data
  const shares = await Share.findByUserId(user.id, 100, 0);

  const videoStats = shares.reduce((acc, share) => {
    const existing = acc.find(v => v.videoId === share.video_id);
    const citationCount = share.annotations ? share.annotations.length : 0;

    if (existing) {
      existing.citationCount += citationCount;
      existing.shareCount += 1;
    } else {
      acc.push({
        videoId: share.video_id,
        title: share.title,
        citationCount,
        shareCount: 1,
        lastCitedAt: share.updated_at
      });
    }
    return acc;
  }, []);

  videoStats.sort((a, b) => new Date(b.lastCitedAt) - new Date(a.lastCitedAt));

  const totalCitations = videoStats.reduce((sum, v) => sum + v.citationCount, 0);
  const totalVideos = videoStats.length;

  res.json({
    userId: user.id,
    displayName: user.display_name,
    authType: user.auth_type,
    accountCreated: user.created_at,
    stats: {
      totalCitations,
      totalVideos,
      citationsPerVideo: totalVideos > 0 ? (totalCitations / totalVideos).toFixed(1) : 0
    },
    videos: videoStats.slice(0, 10),
    karma: null,
    approvalRate: null
  });
}));

module.exports = router;
