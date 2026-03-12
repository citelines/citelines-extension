# YouTube Annotator - Technical Documentation

A Chrome extension that creates a collaborative annotation layer on YouTube videos. All users with the extension automatically see annotations from all other users.

**Backend**: https://youtube-annotator-production.up.railway.app
**Repository**: https://github.com/abekatz11/youtube-annotator
**Roadmap**: See ROADMAP.md for project status, phases, and next steps

---

## Architecture Overview

### System Design

**Frontend**: Chrome Extension (Manifest V3)
- Content script injected into YouTube pages
- Detects video navigation (YouTube SPA)
- Renders triangle markers on progress bar
- Manages local + cloud storage

**Backend**: Node.js + Express on Railway
- PostgreSQL database
- JWT + Anonymous ID dual authentication
- Rate limiting (5 layers)
- CORS configured for YouTube.com

**Data Flow**:
1. User creates annotation → Saves locally + syncs to backend
2. Loading video → Fetches all shares for video → Renders markers
3. Click marker → Shows popup with text, timestamp, ownership
4. Color-coded: Teal (yours), Grey (others)

---

## Project Structure

```
youtube-annotator/
├── Frontend (Chrome Extension)
│   ├── manifest.json          # Extension manifest
│   ├── content.bundle.js      # Bundled content script (built from src/content/)
│   ├── src/content/           # Content script source modules (esbuild → content.bundle.js)
│   │   ├── main.js            # Orchestrator: init, player detection, SPA navigation
│   │   ├── state.js           # Shared mutable state object
│   │   ├── globals.js         # Thin wrapper exposing window globals (api, authManager, etc.)
│   │   ├── utils.js           # Pure helpers: formatTime, escapeHtml, getVideoId, etc.
│   │   ├── storage.js         # chrome.storage + backend sync
│   │   ├── markers.js         # Timeline marker rendering (triangles, elbow connectors)
│   │   ├── popup.js           # Annotation view popup (click marker)
│   │   ├── createPopup.js     # Annotation create popup (+ button)
│   │   ├── annotationsSidebar.js  # Bibliography sidebar (≡ button)
│   │   ├── accountSidebar.js  # Account/auth sidebar (user icon)
│   │   ├── creatorMode.js     # Creator detection, orange UX mode
│   │   ├── fetchAnnotations.js # Fetch all annotations from backend
│   │   ├── citationFields.js  # Citation type field definitions
│   │   ├── modals.js          # Report, suggest-edit, edit modals
│   │   └── sharing.js         # Share/import functionality
│   ├── content.css            # UI styling
│   ├── api.js                 # Backend API client
│   ├── auth.js                # AuthManager class
│   ├── youtubeAuth.js         # YouTube OAuth helpers
│   ├── loginUI.js             # Login/register modal
│   ├── userProfileUI.js       # User profile modal
│   ├── analytics.js           # Extension usage analytics (batched, fire-and-forget)
│   ├── background.js          # Service worker (OAuth, channel ID, install tracking)
│   └── shareUI.js             # Legacy (unused)
│
└── Backend (Node.js + Express)
    ├── src/
    │   ├── server.js          # Express app
    │   ├── config/
    │   │   ├── database.js    # PostgreSQL connection
    │   │   └── jwt.js         # JWT token handling
    │   ├── middleware/
    │   │   ├── auth.js        # Dual auth (JWT + Anonymous)
    │   │   ├── adminAuth.js   # Admin-only middleware
    │   │   ├── rateLimiter.js # Multi-layer rate limiting
    │   │   └── errorHandler.js
    │   ├── models/
    │   │   ├── User.js        # User operations
    │   │   └── Share.js       # Citation operations
    │   ├── routes/
    │   │   ├── auth.js        # Authentication endpoints
    │   │   ├── shares.js      # Citation CRUD
    │   │   ├── users.js       # User profiles
    │   │   ├── admin.js       # Admin moderation + analytics dashboard
    │   │   └── analytics.js   # Extension usage event ingestion
    │   ├── utils/
    │   │   ├── password.js    # bcrypt hashing
    │   │   ├── tokenGenerator.js
    │   │   └── validator.js
    │   └── jobs/
    │       └── resetCounters.js # Cron jobs
    ├── migrations/            # SQL schema files
    └── railway.json           # Deployment config
```

---

## Database Schema

### Tables

**users**
```sql
id                      UUID PRIMARY KEY
anonymous_id            VARCHAR(255) UNIQUE
auth_type               VARCHAR(20)          -- 'anonymous' | 'password' | 'youtube' | 'youtube_merged' | 'merged' | 'expired'
email                   VARCHAR(255) UNIQUE
password_hash           VARCHAR(255)
display_name            VARCHAR(100)
email_verified          BOOLEAN DEFAULT false
youtube_channel_id      VARCHAR(30)
youtube_verified        BOOLEAN DEFAULT false
youtube_channel_title   VARCHAR(255)
merged_into             UUID REFERENCES users(id)
merged_at               TIMESTAMP
created_at              TIMESTAMP
expires_at              TIMESTAMP            -- NULL = never expires
is_admin                BOOLEAN DEFAULT false
is_suspended            BOOLEAN DEFAULT false
suspended_until         TIMESTAMP
is_banned               BOOLEAN DEFAULT false
banned_at               TIMESTAMP
ban_reason              TEXT
```

**banned_ips** (IP-based enforcement)
```sql
id                      UUID PRIMARY KEY
ip_address              INET NOT NULL
user_id                 UUID REFERENCES users(id)
banned_by               UUID REFERENCES users(id)
reason                  TEXT
created_at              TIMESTAMPTZ
```

**shares** (citations)
```sql
id                      UUID PRIMARY KEY
share_token             VARCHAR(8) UNIQUE
user_id                 UUID REFERENCES users(id)
video_id                VARCHAR(20)          -- YouTube video ID
title                   VARCHAR(255)
annotations             JSONB                -- Array of annotation objects
is_public               BOOLEAN DEFAULT true
view_count              INTEGER DEFAULT 0
deleted_by_admin        UUID REFERENCES users(id)
deleted_at              TIMESTAMP
deletion_reason         TEXT
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

**admin_actions** (audit log)
```sql
id                      UUID PRIMARY KEY
admin_id                UUID REFERENCES users(id)
action_type             VARCHAR(50)          -- 'suspend_user', 'delete_citation', etc.
target_type             VARCHAR(20)          -- 'user' | 'citation'
target_id               UUID
reason                  TEXT
metadata                JSONB
created_at              TIMESTAMP
```

**analytics_events** (extension usage tracking — no PII)
```sql
id                      SERIAL PRIMARY KEY
event_type              VARCHAR(50)          -- 'extension_installed' | 'video_viewed' | 'citation_clicked'
session_id              VARCHAR(64)          -- Anonymous UUID (from X-Anonymous-ID) or hashed IP
video_id                VARCHAR(20)          -- YouTube video ID (optional)
metadata                JSONB DEFAULT '{}'   -- e.g. { source: 'marker' | 'sidebar' }
created_at              TIMESTAMPTZ
```

**Annotation Object Structure** (in shares.annotations JSONB):
```javascript
{
  timestamp: 123.45,           // Seconds into video
  text: "Citation text",       // User's annotation
  createdAt: "2026-02-13...",  // ISO timestamp
  citationType: "default"      // Type of citation
}
```

---

## API Endpoints

### Authentication

```
POST   /api/auth/register              - Create anonymous user
GET    /api/auth/verify                - Verify anonymous ID
POST   /api/auth/register-email        - Register with email/password
POST   /api/auth/verify-email          - Verify email with token
POST   /api/auth/login                 - Login (returns JWT)
POST   /api/auth/forgot-password       - Request password reset
POST   /api/auth/reset-password        - Reset password with token
GET    /api/auth/expiry-info           - Get account expiry status
```

### YouTube Auth & Account Merge

```
POST   /api/auth/youtube                  - Login/register via YouTube OAuth
POST   /api/auth/youtube/connect          - Link YouTube channel to existing account
POST   /api/auth/merge                    - Merge YouTube account into email account
```

### Analytics (No Auth Required)

```
POST   /api/analytics/events              - Ingest extension usage events (batch up to 50)
```

### Citations (Shares)

```
POST   /api/shares                     - Create citation
GET    /api/shares/:token              - Get citation by token
GET    /api/shares/video/:videoId      - Get all citations for video
PUT    /api/shares/:token              - Update citation (owner only)
DELETE /api/shares/:token              - Delete citation (owner only)
```

### Users

```
GET    /api/users/:userId/profile      - Get user profile (stats, recent videos)
```

### Admin Moderation (Requires JWT Auth + is_admin=true)

```
DELETE /api/admin/citations/:token          - Soft delete citation
POST   /api/admin/citations/:token/restore  - Restore deleted citation
POST   /api/admin/users/:userId/suspend     - Suspend user (temp)
POST   /api/admin/users/:userId/unsuspend   - Lift suspension
POST   /api/admin/users/:userId/ban         - Ban user (permanent suspension + soft-delete citations + IP ban)
POST   /api/admin/users/:userId/unban       - Unban user (restore citations + remove IP bans)
GET    /api/admin/users                     - List users with moderation status
GET    /api/admin/citations                 - List citations (including deleted)
GET    /api/admin/actions                   - View audit log
GET    /api/admin/analytics                  - Extension usage analytics (totals + time series)
```

---

## Authentication System

### Dual Authentication

The backend supports TWO authentication methods:

**1. Anonymous ID** (for anonymous users)
- 128-bit random base64url string
- Stored in `chrome.storage.local`
- Sent via `X-Anonymous-ID` header
- No password required

**2. JWT Token** (for registered users)
- Email + password authentication
- 30-day expiry (configurable)
- Sent via `Authorization: Bearer <token>` header
- Can be revoked

**Middleware Priority**:
```javascript
// auth.js checks in order:
1. Authorization: Bearer <JWT>  → req.user = user from JWT
2. X-Anonymous-ID: <id>        → req.user = user from anonymous_id
3. None                        → 401 error
```

### Storage Separation (Incognito Mode)

```javascript
// Regular mode:   anonymousId
// Incognito mode: anonymousId_incognito

// This prevents ID sharing between contexts
```

---

## Frontend Architecture

### Content Script Lifecycle

Source in `src/content/`, bundled to `content.bundle.js` via esbuild.

```javascript
// 1. Page Load (main.js)
- waitForPlayer() → Wait for <video> element
- initialize() → Create UI elements, init auth + API in parallel
- fetchAllAnnotations() (fetchAnnotations.js) → Get all citations for video
- renderMarkers() (markers.js) → Create triangle markers on progress bar

// 2. User Creates Annotation (createPopup.js → storage.js)
- Show input popup at current timestamp
- Save locally (chrome.storage.local)
- Sync to backend (POST /api/shares or PUT /api/shares/:token)
- Re-fetch all annotations (to get isOwner flags)
- Re-render markers

// 3. Navigation to New Video (main.js handleNavigation)
- Detect URL change via MutationObserver
- Clean up DOM (remove markers, buttons, sidebar)
- Disconnect observers
- Repeat lifecycle for new video

// 4. Click Marker (popup.js)
- Show popup with annotation text, timestamp, ownership
- Badge: "YOU - ~2026-XXXXXX" (teal) or "~2026-XXXXXX" (grey)
- Click badge → Open user profile modal
```

### Key Functions

**src/content/ (bundled to content.bundle.js)**:
- `main.js`: `initialize()`, `waitForPlayer()`, `handleNavigation()` — orchestrator
- `fetchAnnotations.js`: `fetchAllAnnotations()` — get all citations for video, flatten into array
- `markers.js`: `renderMarkers()`, `createMarkersContainer()` — triangle markers on progress bar
- `popup.js`: `showAnnotationPopup()` — display citation text and metadata
- `storage.js`: `syncAnnotationsToBackend()` — create/update share on backend
- `state.js`: shared mutable state object imported by all modules
- Build: `npm run build` (esbuild, IIFE format)

**api.js**:
- `initialize()` - Get/create anonymous ID
- `createShare()` - POST /api/shares
- `getShareByToken()` - GET /api/shares/:token
- `getSharesForVideo()` - GET /api/shares/video/:videoId

**userProfileUI.js**:
- `show()` - Display profile modal
- `loadProfileData()` - Fetch from /api/users/:userId/profile
- `renderProfile()` - Show stats, recent videos, join date

---

## Deployment (Railway)

### Environment Variables

```bash
DATABASE_URL              # PostgreSQL connection string (auto-set)
JWT_SECRET                # Secret for signing JWT tokens
NODE_ENV=production       # Production mode
PORT=3000                 # Server port (auto-set by Railway)
```

### Deployment Process

```bash
# Auto-deploys on push to main branch
git push origin master

# Check deployment status
railway logs --tail 50

# Run migrations manually
railway shell
psql $DATABASE_URL -f migrations/006_add_admin_moderation.sql
```

### Database Connection

**SECURITY**: Never commit actual database credentials. Use environment variables.

**Access**:
```bash
# Via Railway CLI (recommended)
railway shell
psql $DATABASE_URL

# Direct connection (if needed)
# Get DATABASE_URL from Railway dashboard → Variables
psql "$DATABASE_URL"
```

---

## Admin Moderation System

### Security Model

**⚠️ IMPORTANT**: Admin endpoints require JWT authentication, NOT anonymous ID.

**Why Anonymous Auth is Unsafe for Admins**:
- No password → Anyone with ID has full admin powers
- If ID leaks → Permanent compromise (can't revoke)
- Browser storage vulnerable
- No audit trail of actual person

**Required for Admin Access**:
1. Register with email/password
2. Verify email
3. Login to get JWT token
4. Set `is_admin = true` in database
5. Use `Authorization: Bearer <token>` header

**Setup Process**:

```bash
# 1. Register account via API
curl -X POST https://youtube-annotator-production.up.railway.app/api/auth/register-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123",
    "displayName": "Admin Name"
  }'

# 2. Get verification URL from Railway logs
railway logs --tail 50 | grep "Verification URL"

# 3. Visit URL in browser to verify email

# 4. Login to get JWT
curl -X POST https://youtube-annotator-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "SecurePassword123"}' \
  | jq '.token'

# 5. Set admin flag
psql "$DATABASE_URL" -c "UPDATE users SET is_admin = true WHERE email = 'admin@example.com';"

# 6. Use JWT for admin actions
curl https://youtube-annotator-production.up.railway.app/api/admin/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Admin Actions

**Suspend User** (temporary, with duration):
```bash
curl -X POST https://youtube-annotator-production.up.railway.app/api/admin/users/USER_ID/suspend \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"duration": 7, "reason": "Spam"}'
```

**Ban User** (permanent suspension + soft-delete citations + IP ban):
```bash
curl -X POST https://youtube-annotator-production.up.railway.app/api/admin/users/USER_ID/ban \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Harassment"}'
```

**Delete Citation** (soft delete, reversible):
```bash
curl -X DELETE https://youtube-annotator-production.up.railway.app/api/admin/citations/TOKEN \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Inappropriate content"}'
```

**View Audit Log**:
```bash
curl https://youtube-annotator-production.up.railway.app/api/admin/actions \
  -H "Authorization: Bearer $JWT"
```

---

## Development Guide

### Local Development

```bash
# Start backend
cd backend
npm install
npm run dev

# Load extension
1. Chrome → Extensions → Developer mode
2. Load unpacked → Select youtube-annotator folder
3. Go to YouTube video
```

### Testing

**Test Collaborative Mode**:
1. Load extension in regular window
2. Load extension in incognito window
3. Create annotation in one window
4. Should appear in both windows with correct colors

### Debugging

**Frontend**:
- Console logs: `[YT Annotator]` prefix
- Network tab: Check `X-Anonymous-ID` or `Authorization` headers
- Check `chrome.storage.local`: DevTools → Application → Storage

**Backend**:
```bash
# View Railway logs
railway logs --tail 50

# Check database directly
railway run psql $DATABASE_URL -c "SELECT * FROM users ORDER BY created_at DESC LIMIT 5;"
```

---

## Common Operations

### Check Admin Status

```bash
railway run psql $DATABASE_URL -c "SELECT display_name, email, is_admin FROM users WHERE is_admin = true;"
```

### View Recent Citations

```bash
railway run psql $DATABASE_URL -c "SELECT share_token, video_id, user_id, created_at FROM shares ORDER BY created_at DESC LIMIT 10;"
```

### Manual Migration

```bash
railway shell
psql $DATABASE_URL -f migrations/006_add_admin_moderation.sql
```

---

## Key Technical Decisions

### Why JSONB for Annotations?
- Flexible schema (can add fields without migration)
- Native PostgreSQL indexing and querying
- Easy to update array of annotations per video

### Why Dual Authentication?
- Preserve anonymous access (low barrier to entry)
- Add optional registration (account preservation, cross-device sync)
- JWT for admins (secure, revocable, industry standard)

### Why Soft Delete for Citations?
- Allow admin to reverse mistakes
- Preserve audit trail
- User data remains for investigation

### Why Separate Storage Keys for Incognito?
- Chrome's `chrome.storage.local` is shared by default
- Prevents ID collision between contexts
- Each context treated as separate user

---

## Security Considerations

### Current Security Measures
- ✅ HTTPS only (Railway provides SSL)
- ✅ CORS restricted to YouTube.com
- ✅ bcrypt password hashing (12 rounds)
- ✅ JWT tokens with expiry (30 days)
- ✅ Rate limiting (5 layers)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (HTML escaping)
- ✅ Audit logging (admin actions)

### Known Limitations
- ⚠️ Anonymous ID security relies on browser storage security
- ⚠️ Email verification in dev mode (logs to console, not sent)
- ⚠️ No 2FA yet (planned for Phase 4)
- ⚠️ No session revocation UI (must use database)

### Best Practices
- Never commit `.env` files
- Never log passwords or tokens
- Always use parameterized SQL queries
- Always escape user-generated content
- Rotate JWT_SECRET periodically
- Monitor audit logs for suspicious activity

---

**For project status, roadmap, and next steps**: See ROADMAP.md
