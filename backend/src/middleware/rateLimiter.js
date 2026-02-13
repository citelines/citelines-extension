/**
 * Multi-layer rate limiting middleware for DDOS protection
 *
 * Layers:
 * 1. IP-based (existing express-rate-limit)
 * 2. User-based (citations per hour/day)
 * 3. Video-based (prevent spam on single videos)
 * 4. Behavioral (detect suspicious patterns)
 * 5. Resource limits (max total citations)
 */

const db = require('../config/database');

// Configuration
const LIMITS = {
  // User-based limits
  CITATIONS_PER_HOUR: 180,           // Max 180 citations per hour per user
  CITATIONS_PER_DAY: 1000,           // Max 1000 citations per day per user
  CITATIONS_PER_VIDEO: 100,          // Max 100 citations per video per user

  // Behavioral limits
  RAPID_FIRE_WINDOW: 60,            // 60 seconds
  RAPID_FIRE_COUNT: 45,              // Max 45 citations in 60 seconds

  // Spam detection
  DUPLICATE_TEXT_THRESHOLD: 3,      // Same text 3+ times = spam
  MIN_TEXT_LENGTH: 3,               // Minimum annotation length
  MAX_TEXT_LENGTH: 2000,            // Maximum annotation length

  // Account limits
  MAX_LIFETIME_CITATIONS: 10000,    // 10k citations max per account
};

// Time windows in milliseconds
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const SEVEN_DAYS = 7 * ONE_DAY;

/**
 * Log rate limit event for monitoring
 */
async function logRateLimitEvent(userId, eventType, context = {}) {
  try {
    const query = `
      INSERT INTO rate_limit_events
        (user_id, event_type, video_id, ip_address, user_agent, limit_type, limit_value, current_count, blocked)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(query, [
      userId,
      eventType,
      context.videoId || null,
      context.ipAddress || null,
      context.userAgent || null,
      context.limitType || null,
      context.limitValue || null,
      context.currentCount || null,
      context.blocked || false
    ]);
  } catch (error) {
    console.error('[Rate Limiter] Error logging event:', error);
    // Don't throw - logging failures shouldn't break the request
  }
}

/**
 * Check if user is currently rate limited
 */
async function checkUserRateLimit(userId) {
  const query = `
    SELECT is_rate_limited, rate_limit_until
    FROM users
    WHERE id = $1
  `;

  const result = await db.query(query, [userId]);

  if (result.rows.length === 0) {
    return { limited: false };
  }

  const user = result.rows[0];

  if (user.is_rate_limited && user.rate_limit_until) {
    if (new Date(user.rate_limit_until) > new Date()) {
      return {
        limited: true,
        until: user.rate_limit_until,
        reason: 'Account temporarily suspended for excessive activity'
      };
    } else {
      // Expired - clear the limit
      await db.query(
        'UPDATE users SET is_rate_limited = false, rate_limit_until = NULL WHERE id = $1',
        [userId]
      );
    }
  }

  return { limited: false };
}

/**
 * Get or create user stats
 */
async function getUserStats(userId) {
  const query = `
    INSERT INTO user_stats (user_id)
    VALUES ($1)
    ON CONFLICT (user_id) DO UPDATE SET user_id = $1
    RETURNING *
  `;

  const result = await db.query(query, [userId]);
  return result.rows[0];
}

/**
 * Check hourly citation limit
 */
async function checkHourlyLimit(userId, stats) {
  const hoursSinceReset = (Date.now() - new Date(stats.last_rapid_fire_reset).getTime()) / ONE_HOUR;

  if (hoursSinceReset >= 1) {
    // Reset the counter
    await db.query(
      'UPDATE user_stats SET citations_this_hour = 0, last_rapid_fire_reset = NOW() WHERE user_id = $1',
      [userId]
    );
    return { allowed: true, count: 0 };
  }

  // Get user account age
  const userQuery = await db.query(
    'SELECT account_created_at FROM users WHERE id = $1',
    [userId]
  );
  const accountAge = Date.now() - new Date(userQuery.rows[0]?.account_created_at || Date.now()).getTime();

  // Stricter limits for new accounts (< 7 days old)
  const limit = accountAge < SEVEN_DAYS
    ? LIMITS.NEW_ACCOUNT_CITATIONS_PER_HOUR
    : LIMITS.CITATIONS_PER_HOUR;

  if (stats.citations_this_hour >= limit) {
    return {
      allowed: false,
      count: stats.citations_this_hour,
      limit: limit,
      reason: `You've reached your hourly limit of ${limit} citations. Please try again later.`
    };
  }

  return { allowed: true, count: stats.citations_this_hour, limit };
}

/**
 * Check daily citation limit
 */
async function checkDailyLimit(userId, stats) {
  const daysSinceReset = (Date.now() - new Date(stats.citations_last_reset).getTime()) / ONE_DAY;

  if (daysSinceReset >= 1) {
    // Reset the counter
    await db.query(
      'UPDATE user_stats SET citations_today = 0, citations_last_reset = NOW() WHERE user_id = $1',
      [userId]
    );
    return { allowed: true, count: 0 };
  }

  if (stats.citations_today >= LIMITS.CITATIONS_PER_DAY) {
    return {
      allowed: false,
      count: stats.citations_today,
      limit: LIMITS.CITATIONS_PER_DAY,
      reason: `You've reached your daily limit of ${LIMITS.CITATIONS_PER_DAY} citations. Please try again tomorrow.`
    };
  }

  return { allowed: true, count: stats.citations_today, limit: LIMITS.CITATIONS_PER_DAY };
}

/**
 * Check per-video citation limit
 */
async function checkVideoLimit(userId, videoId) {
  const query = `
    SELECT citation_count
    FROM video_citation_counts
    WHERE user_id = $1 AND video_id = $2
  `;

  const result = await db.query(query, [userId, videoId]);
  const count = result.rows[0]?.citation_count || 0;

  if (count >= LIMITS.CITATIONS_PER_VIDEO) {
    return {
      allowed: false,
      count: count,
      limit: LIMITS.CITATIONS_PER_VIDEO,
      reason: `You've reached the limit of ${LIMITS.CITATIONS_PER_VIDEO} citations for this video.`
    };
  }

  return { allowed: true, count, limit: LIMITS.CITATIONS_PER_VIDEO };
}

/**
 * Check rapid-fire behavior (5 citations in 60 seconds)
 */
async function checkRapidFire(userId, stats) {
  const secondsSinceReset = (Date.now() - new Date(stats.last_rapid_fire_reset).getTime()) / 1000;

  if (secondsSinceReset >= LIMITS.RAPID_FIRE_WINDOW) {
    // Reset the counter
    await db.query(
      'UPDATE user_stats SET rapid_fire_count = 0, last_rapid_fire_reset = NOW() WHERE user_id = $1',
      [userId]
    );
    return { allowed: true, count: 0 };
  }

  if (stats.rapid_fire_count >= LIMITS.RAPID_FIRE_COUNT) {
    // Suspicious behavior - log and warn
    await db.query(
      'UPDATE user_stats SET warnings = warnings + 1, last_warning_at = NOW() WHERE user_id = $1',
      [userId]
    );

    return {
      allowed: false,
      count: stats.rapid_fire_count,
      limit: LIMITS.RAPID_FIRE_COUNT,
      reason: 'Slow down! You\'re creating citations too quickly. Please wait a minute.'
    };
  }

  return { allowed: true, count: stats.rapid_fire_count, limit: LIMITS.RAPID_FIRE_COUNT };
}

/**
 * Check lifetime citation limit
 */
async function checkLifetimeLimit(stats) {
  if (stats.total_citations >= LIMITS.MAX_LIFETIME_CITATIONS) {
    return {
      allowed: false,
      count: stats.total_citations,
      limit: LIMITS.MAX_LIFETIME_CITATIONS,
      reason: 'You\'ve reached the maximum lifetime citation limit. Please contact support.'
    };
  }

  return { allowed: true, count: stats.total_citations, limit: LIMITS.MAX_LIFETIME_CITATIONS };
}

/**
 * Validate citation content for spam patterns
 */
function validateCitationContent(text) {
  // Check length
  if (!text || text.trim().length < LIMITS.MIN_TEXT_LENGTH) {
    return {
      valid: false,
      reason: `Citation must be at least ${LIMITS.MIN_TEXT_LENGTH} characters long.`
    };
  }

  if (text.length > LIMITS.MAX_TEXT_LENGTH) {
    return {
      valid: false,
      reason: `Citation must be less than ${LIMITS.MAX_TEXT_LENGTH} characters.`
    };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(.)\1{20,}/,                    // Same character repeated 20+ times
    /https?:\/\/[^\s]{50,}/,         // Very long URLs (potential spam)
    /(buy|sale|discount|click here|viagra|cialis)/gi // Common spam keywords
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return {
        valid: false,
        reason: 'Citation contains suspicious content. Please revise.'
      };
    }
  }

  return { valid: true };
}

/**
 * Check for duplicate text spam
 */
async function checkDuplicateText(userId, text) {
  // Get recent citations with same text
  const query = `
    SELECT COUNT(*) as count
    FROM shares s
    JOIN users u ON s.user_id = u.id
    WHERE u.id = $1
    AND s.annotations::text ILIKE $2
    AND s.created_at > NOW() - INTERVAL '24 hours'
  `;

  const result = await db.query(query, [userId, `%${text}%`]);
  const count = parseInt(result.rows[0]?.count || 0);

  if (count >= LIMITS.DUPLICATE_TEXT_THRESHOLD) {
    return {
      allowed: false,
      count: count,
      reason: 'You\'ve posted similar text too many times. Please create unique citations.'
    };
  }

  return { allowed: true, count };
}

/**
 * Main rate limiting middleware
 */
async function rateLimitCitations(req, res, next) {
  try {
    const userId = req.user?.id;
    const videoId = req.body?.videoId;
    const annotationText = req.body?.annotations?.[0]?.text;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Check if user is currently suspended
    const rateCheck = await checkUserRateLimit(userId);
    if (rateCheck.limited) {
      await logRateLimitEvent(userId, 'citation_blocked', {
        videoId,
        ipAddress,
        userAgent,
        limitType: 'suspended',
        blocked: true
      });

      return res.status(429).json({
        error: 'Rate limit exceeded',
        reason: rateCheck.reason,
        retryAfter: rateCheck.until
      });
    }

    // Get user stats
    const stats = await getUserStats(userId);

    // Run all checks
    const checks = [
      { name: 'hourly', check: () => checkHourlyLimit(userId, stats) },
      { name: 'daily', check: () => checkDailyLimit(userId, stats) },
      { name: 'rapid_fire', check: () => checkRapidFire(userId, stats) },
      { name: 'lifetime', check: () => checkLifetimeLimit(stats) }
    ];

    // Add video check if videoId provided
    if (videoId) {
      checks.push({ name: 'video', check: () => checkVideoLimit(userId, videoId) });
    }

    // Add content validation if text provided
    if (annotationText) {
      const contentCheck = validateCitationContent(annotationText);
      if (!contentCheck.valid) {
        return res.status(400).json({
          error: 'Invalid citation content',
          reason: contentCheck.reason
        });
      }

      const duplicateCheck = await checkDuplicateText(userId, annotationText);
      if (!duplicateCheck.allowed) {
        await logRateLimitEvent(userId, 'citation_blocked', {
          videoId,
          ipAddress,
          userAgent,
          limitType: 'duplicate_text',
          currentCount: duplicateCheck.count,
          blocked: true
        });

        return res.status(429).json({
          error: 'Duplicate content detected',
          reason: duplicateCheck.reason
        });
      }
    }

    // Run all checks
    for (const { name, check } of checks) {
      const result = await check();

      if (!result.allowed) {
        await logRateLimitEvent(userId, 'citation_blocked', {
          videoId,
          ipAddress,
          userAgent,
          limitType: name,
          limitValue: result.limit,
          currentCount: result.count,
          blocked: true
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          reason: result.reason,
          limit: result.limit,
          current: result.count,
          limitType: name
        });
      }
    }

    // All checks passed - increment rapid fire counter
    await db.query(
      'UPDATE user_stats SET rapid_fire_count = rapid_fire_count + 1 WHERE user_id = $1',
      [userId]
    );

    // Log successful event
    await logRateLimitEvent(userId, 'citation_created', {
      videoId,
      ipAddress,
      userAgent,
      blocked: false
    });

    // Attach stats to request for later use
    req.userStats = stats;

    next();
  } catch (error) {
    console.error('[Rate Limiter] Error:', error);
    // On error, allow the request but log it
    next();
  }
}

/**
 * Increment citation count after successful creation
 * Call this AFTER the citation is saved to the database
 */
async function incrementCitationCount(userId, videoId) {
  try {
    await db.query('SELECT increment_citation_count($1, $2)', [userId, videoId]);
  } catch (error) {
    console.error('[Rate Limiter] Error incrementing count:', error);
    // Don't throw - counting failures shouldn't break the response
  }
}

/**
 * Admin endpoint to view rate limit stats
 */
async function getRateLimitStats(req, res) {
  try {
    const { userId } = req.params;

    const statsQuery = `
      SELECT
        u.id,
        u.anonymous_id,
        u.citations_count,
        u.last_citation_at,
        u.is_rate_limited,
        u.rate_limit_until,
        s.total_citations,
        s.citations_today,
        s.citations_this_hour,
        s.rapid_fire_count,
        s.warnings,
        s.suspensions
      FROM users u
      LEFT JOIN user_stats s ON u.id = s.user_id
      WHERE u.id = $1
    `;

    const eventsQuery = `
      SELECT *
      FROM rate_limit_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const [statsResult, eventsResult] = await Promise.all([
      db.query(statsQuery, [userId]),
      db.query(eventsQuery, [userId])
    ]);

    res.json({
      user: statsResult.rows[0] || null,
      recentEvents: eventsResult.rows
    });
  } catch (error) {
    console.error('[Rate Limiter] Error getting stats:', error);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
}

module.exports = {
  rateLimitCitations,
  incrementCitationCount,
  getRateLimitStats,
  checkUserRateLimit,
  LIMITS
};
