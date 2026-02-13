# Rate Limiting & DDOS Protection

Comprehensive multi-layer protection against spam, abuse, and DDOS attacks.

## Overview

The YouTube Annotator implements a **5-layer defense strategy** to protect against:
- DDOS attacks (volume-based)
- Spam citations (duplicate content)
- Account abuse (rapid-fire creation)
- Resource exhaustion (lifetime limits)

## Defense Layers

### Layer 1: IP-Based Rate Limiting ✅ (Existing)
**Middleware**: `express-rate-limit` (server.js)

- **General**: 100 requests/minute per IP
- **Writes**: 50 write operations/hour per IP
- **Reads**: Unlimited (GET requests not limited)

**Purpose**: Prevent network-level DDOS attacks

---

### Layer 2: User-Based Rate Limiting 🆕 (New)
**Middleware**: `rateLimitCitations` (middleware/rateLimiter.js)

**Limits**:
- **30 citations/hour** per user
- **100 citations/day** per user
- **10 citations/hour** for new accounts (< 7 days old)

**Purpose**: Prevent individual user spam

---

### Layer 3: Video-Based Limits 🆕 (New)
**Database**: `video_citation_counts` table

**Limits**:
- **20 citations per video** per user

**Purpose**: Prevent spam on individual videos

---

### Layer 4: Behavioral Detection 🆕 (New)
**Logic**: Real-time pattern analysis

**Detection**:
- **Rapid-fire**: 5 citations in 60 seconds → Block + Warning
- **Duplicate text**: Same text 3+ times in 24 hours → Block
- **Suspicious patterns**:
  - Same character repeated 20+ times
  - Very long URLs (50+ chars)
  - Spam keywords (buy, sale, discount, etc.)

**Purpose**: Catch bot-like behavior

---

### Layer 5: Resource Limits 🆕 (New)
**Database**: `user_stats` table

**Limits**:
- **10,000 total citations** per account (lifetime)
- **Minimum text length**: 3 characters
- **Maximum text length**: 2,000 characters

**Purpose**: Prevent resource exhaustion

---

## Database Schema

### New Tables

```sql
-- User statistics
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY,
  total_citations INTEGER,          -- Lifetime count
  citations_today INTEGER,           -- Daily counter
  citations_this_hour INTEGER,       -- Hourly counter
  rapid_fire_count INTEGER,          -- 60-second window counter
  duplicate_text_count INTEGER,      -- Spam detection
  warnings INTEGER,                  -- Abuse warnings
  suspensions INTEGER,               -- Account suspensions
  ...
);

-- Rate limit event log (audit trail)
CREATE TABLE rate_limit_events (
  id UUID PRIMARY KEY,
  user_id UUID,
  event_type VARCHAR(50),            -- 'citation_created', 'citation_blocked'
  limit_type VARCHAR(50),            -- 'hourly', 'rapid_fire', etc.
  limit_value INTEGER,               -- What was the limit?
  current_count INTEGER,             -- How many did they have?
  blocked BOOLEAN,                   -- Was it blocked?
  ...
);

-- Per-video citation tracking
CREATE TABLE video_citation_counts (
  user_id UUID,
  video_id VARCHAR(20),
  citation_count INTEGER,
  ...
  UNIQUE(user_id, video_id)
);
```

### Updated Users Table

```sql
ALTER TABLE users ADD COLUMN citations_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_citation_at TIMESTAMP;
ALTER TABLE users ADD COLUMN is_rate_limited BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN rate_limit_until TIMESTAMP;
```

---

## API Integration

### Routes with Rate Limiting

```javascript
// POST /api/shares - Create citation
router.post('/',
  authenticateAnonymous,     // Auth middleware
  rateLimitCitations,        // Rate limit middleware ← NEW
  asyncHandler(async (req, res) => {
    // ... create share ...

    // Increment count after success
    await incrementCitationCount(userId, videoId);
  })
);

// PUT /api/shares/:token - Update citation
router.put('/:token',
  authenticateAnonymous,
  rateLimitCitations,        // ← NEW
  asyncHandler(async (req, res) => {
    // ... update share ...

    // Only increment if NEW citations added
    if (addedNewCitation) {
      await incrementCitationCount(userId, videoId);
    }
  })
);
```

### New Admin Endpoint

```
GET /api/shares/admin/rate-limit/:userId
```

**Returns**:
```json
{
  "user": {
    "id": "uuid",
    "citations_count": 42,
    "is_rate_limited": false,
    "total_citations": 42,
    "citations_today": 12,
    "citations_this_hour": 3,
    "warnings": 0
  },
  "recentEvents": [
    {
      "event_type": "citation_created",
      "blocked": false,
      "created_at": "..."
    },
    ...
  ]
}
```

---

## Error Responses

### Rate Limit Exceeded (429)

```json
{
  "error": "Rate limit exceeded",
  "reason": "You've reached your hourly limit of 30 citations. Please try again later.",
  "limit": 30,
  "current": 30,
  "limitType": "hourly"
}
```

### Duplicate Content (429)

```json
{
  "error": "Duplicate content detected",
  "reason": "You've posted similar text too many times. Please create unique citations."
}
```

### Suspended Account (429)

```json
{
  "error": "Rate limit exceeded",
  "reason": "Account temporarily suspended for excessive activity",
  "retryAfter": "2026-02-12T18:00:00Z"
}
```

### Invalid Content (400)

```json
{
  "error": "Invalid citation content",
  "reason": "Citation must be at least 3 characters long."
}
```

---

## Automated Jobs

**Cron jobs** run automatically to reset counters:

### Hourly Reset
**Schedule**: Every hour at :00
**Action**: Reset `citations_this_hour` and `rapid_fire_count`

### Daily Reset
**Schedule**: Every day at midnight UTC
**Action**: Reset `citations_today`

### Cleanup Old Events
**Schedule**: Daily at 1:00 AM UTC
**Action**: Delete rate limit events older than 30 days

### Unlock Expired Rate Limits
**Schedule**: Every 15 minutes
**Action**: Unlock users whose `rate_limit_until` has passed

---

## Configuration

### Adjust Limits

Edit `backend/src/middleware/rateLimiter.js`:

```javascript
const LIMITS = {
  CITATIONS_PER_HOUR: 30,              // ← Change this
  CITATIONS_PER_DAY: 100,              // ← Change this
  CITATIONS_PER_VIDEO: 20,             // ← Change this
  RAPID_FIRE_COUNT: 5,                 // ← Change this
  DUPLICATE_TEXT_THRESHOLD: 3,         // ← Change this
  MAX_LIFETIME_CITATIONS: 10000,       // ← Change this
  NEW_ACCOUNT_CITATIONS_PER_HOUR: 10,  // ← Change this
};
```

### Disable Rate Limiting (Not Recommended)

```javascript
// Remove middleware from routes
router.post('/',
  authenticateAnonymous,
  // rateLimitCitations,  ← Comment out
  asyncHandler(async (req, res) => {
    // ...
  })
);
```

---

## Monitoring

### Check User Stats

```bash
# Get stats for a specific user
curl https://your-api.com/api/shares/admin/rate-limit/{userId}
```

### Query Database Directly

```sql
-- Find users with most citations
SELECT u.id, u.anonymous_id, s.total_citations, s.citations_today
FROM users u
JOIN user_stats s ON u.id = s.user_id
ORDER BY s.total_citations DESC
LIMIT 20;

-- Find blocked events in last hour
SELECT user_id, event_type, limit_type, current_count, limit_value
FROM rate_limit_events
WHERE blocked = true
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Find users hitting rapid-fire limit
SELECT user_id, rapid_fire_count, last_rapid_fire_reset
FROM user_stats
WHERE rapid_fire_count >= 5;
```

---

## Manual Interventions

### Suspend a User

```sql
UPDATE users
SET is_rate_limited = true,
    rate_limit_until = NOW() + INTERVAL '24 hours'
WHERE id = 'user-uuid';
```

### Unsuspend a User

```sql
UPDATE users
SET is_rate_limited = false,
    rate_limit_until = NULL
WHERE id = 'user-uuid';
```

### Reset User Counters

```sql
UPDATE user_stats
SET citations_today = 0,
    citations_this_hour = 0,
    rapid_fire_count = 0
WHERE user_id = 'user-uuid';
```

### Clear Warnings

```sql
UPDATE user_stats
SET warnings = 0,
    last_warning_at = NULL
WHERE user_id = 'user-uuid';
```

---

## Testing

### Test Rate Limiting

```bash
# Install dependencies
cd backend
npm install

# Run migration
npm run migrate

# Start server
npm start

# Test rapid-fire detection (should block after 5 in 60 seconds)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/shares \
    -H "Content-Type: application/json" \
    -H "X-Anonymous-ID: your-test-id" \
    -d '{
      "videoId": "dQw4w9WgXcQ",
      "title": "Test",
      "annotations": [{"text": "Test citation '$i'", "timestamp": 10}]
    }'
  sleep 5
done
```

### Manual Counter Reset (Testing)

```javascript
// In Node REPL or script
const { jobs } = require('./src/jobs/resetCounters');

// Reset hourly counters
await jobs.resetHourly();

// Reset daily counters
await jobs.resetDaily();

// Clean up old events
await jobs.cleanup();

// Unlock expired rate limits
await jobs.unlock();
```

---

## Migration

### Apply Migration

```bash
cd backend
npm run migrate
```

Or manually:

```bash
psql $DATABASE_URL < migrations/003_add_user_stats_and_limits.sql
```

### Verify Tables Created

```sql
\dt  -- List tables
SELECT * FROM user_stats LIMIT 5;
SELECT * FROM rate_limit_events LIMIT 5;
SELECT * FROM video_citation_counts LIMIT 5;
```

---

## Performance Considerations

### Indexes

All critical queries have indexes:
- `user_stats(user_id)` - Primary key
- `rate_limit_events(user_id)` - Lookup by user
- `rate_limit_events(created_at)` - Time-based queries
- `video_citation_counts(user_id, video_id)` - Per-video lookups

### Async Operations

Citation counting is **non-blocking**:
```javascript
// Don't wait for count increment
incrementCitationCount(userId, videoId).catch(err => {
  console.error('Count failed:', err);
  // Request succeeds anyway
});
```

### Database Functions

Counting logic uses PostgreSQL functions for atomicity:
```sql
SELECT increment_citation_count($user_id, $video_id);
```

---

## Security Best Practices

1. **Never expose internal IDs** in error messages
2. **Log all blocked events** for abuse pattern analysis
3. **Use database transactions** for counter updates
4. **Validate content** before counting (prevent counting invalid citations)
5. **Rate limit the admin endpoint** (add auth when ready)

---

## Future Enhancements

### Phase 2.2: Voting & Karma
- Track downvotes as abuse signal
- Lower limits for users with negative karma
- Auto-suspend accounts with karma < -50

### Phase 3: Osprey Integration
- Stream events to Osprey for ML-based detection
- Detect coordinated attacks (multiple users, same content)
- Cross-platform abuse tracking

### Advanced Features
- IP reputation scoring (Cloudflare, etc.)
- Device fingerprinting (prevent multi-account abuse)
- CAPTCHA for suspicious activity
- Email verification for higher limits
- Community moderation (trusted users review flags)

---

## Troubleshooting

### Counters Not Resetting

```bash
# Check cron jobs are running
# Should see logs: "[Cron] Resetting hourly citation counters..."
tail -f logs/server.log | grep Cron

# Manually trigger reset
node -e "require('./src/jobs/resetCounters').jobs.resetHourly()"
```

### Users Stuck in Rate Limit

```sql
-- Find stuck users
SELECT id, anonymous_id, rate_limit_until
FROM users
WHERE is_rate_limited = true
  AND rate_limit_until < NOW();

-- Unlock them
UPDATE users
SET is_rate_limited = false, rate_limit_until = NULL
WHERE is_rate_limited = true AND rate_limit_until < NOW();
```

### High Database Load

If `rate_limit_events` table grows too large:

```sql
-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('rate_limit_events'));

-- Reduce retention period (currently 30 days)
DELETE FROM rate_limit_events
WHERE created_at < NOW() - INTERVAL '7 days';  -- Keep only 7 days
```

---

## Summary

✅ **5 layers of protection** against spam and abuse
✅ **Automatic counter resets** via cron jobs
✅ **Comprehensive audit logging** of all events
✅ **Configurable limits** for different use cases
✅ **Non-blocking performance** (async counting)
✅ **Admin tools** for monitoring and intervention

**Status**: Ready for deployment 🚀
