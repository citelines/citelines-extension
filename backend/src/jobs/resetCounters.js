/**
 * Scheduled jobs for resetting rate limit counters and expiring accounts
 *
 * This file sets up cron jobs to:
 * 1. Reset hourly citation counters every hour
 * 2. Reset daily citation counters every day at midnight
 * 3. Expire old temporary accounts (90-day soft expiry)
 *
 * Usage:
 * - Import and call setupCounterResetJobs() in your server.js
 * - Jobs run automatically on schedule
 */

const cron = require('node-cron');
const db = require('../config/database');

/**
 * Reset hourly counters
 * Runs every hour at :00
 */
async function resetHourlyCounters() {
  try {
    console.log('[Cron] Resetting hourly citation counters...');

    const result = await db.query('SELECT reset_hourly_counters()');

    console.log('[Cron] Hourly counters reset successfully');
  } catch (error) {
    console.error('[Cron] Error resetting hourly counters:', error);
  }
}

/**
 * Reset daily counters
 * Runs every day at midnight (00:00)
 */
async function resetDailyCounters() {
  try {
    console.log('[Cron] Resetting daily citation counters...');

    const result = await db.query('SELECT reset_daily_counters()');

    console.log('[Cron] Daily counters reset successfully');
  } catch (error) {
    console.error('[Cron] Error resetting daily counters:', error);
  }
}

/**
 * Clean up old rate limit events
 * Runs daily at 1:00 AM
 * Keeps last 30 days of events
 */
async function cleanupRateLimitEvents() {
  try {
    console.log('[Cron] Cleaning up old rate limit events...');

    const result = await db.query(`
      DELETE FROM rate_limit_events
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    console.log(`[Cron] Cleaned up ${result.rowCount} old rate limit events`);
  } catch (error) {
    console.error('[Cron] Error cleaning up rate limit events:', error);
  }
}

/**
 * Unblock rate-limited users whose suspension has expired
 * Runs every 15 minutes
 */
async function unlockExpiredRateLimits() {
  try {
    const result = await db.query(`
      UPDATE users
      SET is_rate_limited = false,
          rate_limit_until = NULL
      WHERE is_rate_limited = true
        AND rate_limit_until IS NOT NULL
        AND rate_limit_until < NOW()
    `);

    if (result.rowCount > 0) {
      console.log(`[Cron] Unlocked ${result.rowCount} rate-limited users`);
    }
  } catch (error) {
    console.error('[Cron] Error unlocking rate limits:', error);
  }
}

/**
 * Expire old temporary accounts (90-day soft expiry)
 * Runs daily at 2:00 AM UTC
 *
 * Soft expiry: Citations remain visible with old pseudonym,
 * but user loses access/ownership. User gets new account on next visit.
 */
async function expireOldAccounts() {
  try {
    console.log('[Cron] Checking for expired temporary accounts...');

    const result = await db.query(`
      SELECT expire_old_accounts() as expired_count
    `);

    const expiredCount = result.rows[0]?.expired_count || 0;

    if (expiredCount > 0) {
      console.log(`[Cron] ✓ Expired ${expiredCount} temporary accounts (90-day soft expiry)`);
    } else {
      console.log('[Cron] No expired accounts found');
    }
  } catch (error) {
    console.error('[Cron] Error expiring old accounts:', error);
  }
}

/**
 * Set up all scheduled jobs
 */
function setupCounterResetJobs() {
  console.log('[Cron] Setting up counter reset jobs...');

  // Reset hourly counters - every hour at :00
  cron.schedule('0 * * * *', resetHourlyCounters, {
    name: 'reset-hourly-counters',
    timezone: 'UTC'
  });
  console.log('[Cron] ✓ Hourly counter reset job scheduled (0 * * * *)');

  // Reset daily counters - every day at midnight UTC
  cron.schedule('0 0 * * *', resetDailyCounters, {
    name: 'reset-daily-counters',
    timezone: 'UTC'
  });
  console.log('[Cron] ✓ Daily counter reset job scheduled (0 0 * * *)');

  // Clean up old events - every day at 1:00 AM UTC
  cron.schedule('0 1 * * *', cleanupRateLimitEvents, {
    name: 'cleanup-rate-limit-events',
    timezone: 'UTC'
  });
  console.log('[Cron] ✓ Event cleanup job scheduled (0 1 * * *)');

  // Unlock expired rate limits - every 15 minutes
  cron.schedule('*/15 * * * *', unlockExpiredRateLimits, {
    name: 'unlock-expired-rate-limits',
    timezone: 'UTC'
  });
  console.log('[Cron] ✓ Rate limit unlock job scheduled (*/15 * * * *)');

  // Expire old temporary accounts - every day at 2:00 AM UTC
  cron.schedule('0 2 * * *', expireOldAccounts, {
    name: 'expire-old-accounts',
    timezone: 'UTC'
  });
  console.log('[Cron] ✓ Account expiry job scheduled (0 2 * * *)');

  console.log('[Cron] All jobs scheduled successfully');
}

/**
 * Manual trigger functions for testing
 */
const jobs = {
  resetHourly: resetHourlyCounters,
  resetDaily: resetDailyCounters,
  cleanup: cleanupRateLimitEvents,
  unlock: unlockExpiredRateLimits,
  expireAccounts: expireOldAccounts
};

module.exports = {
  setupCounterResetJobs,
  jobs
};
