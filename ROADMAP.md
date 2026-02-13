# YouTube Annotator - Roadmap

## Project Status

**Deployment**: ✅ Live on Railway
**Backend URL**: `https://youtube-annotator-production.up.railway.app`
**Database**: PostgreSQL on Railway
**Current Phase**: Phase 3A Complete (Admin Backend)

---

## Completed Phases

### Phase 1: Core Annotation System ✅
- Collaborative annotation sharing
- Triangle markers with ownership colors
- Real-time sync to Railway backend
- Smooth YouTube SPA navigation
- Incognito mode support
- User profile modals

### Phase 2.1: Rate Limiting & DDOS Protection ✅
- Multi-layer rate limiting (5 layers)
- Citation accounting and tracking
- Behavioral monitoring (rapid-fire detection)
- Audit logging of rate limit events
- Cron jobs for counter resets

### Phase 2.2: Temporary Accounts (90-Day Expiry) ✅
- Random pseudonyms (~2026-XXXXXX format)
- 90-day soft expiry for anonymous accounts
- Registration upgrade path (preserves citations)
- Expiry warnings at 10 days

### Phase 2.3: Email/Password Authentication ✅
- JWT token-based authentication
- Email verification flow (dev mode: console logging)
- Password reset functionality
- Dual auth support (JWT + Anonymous ID)
- Account registration with citation preservation

### Phase 2.4: User Profiles ✅
- Clickable user badges showing stats
- Profile modal with citations, videos, join date
- Color-coded profiles (teal = yours, grey = others)
- "Contributor since" date display
- Backend API: `/api/users/:userId/profile`

### Phase 3A: Admin Moderation Backend ✅
- Admin roles (`is_admin` flag)
- User suspension (temporary, with expiry)
- User blocking (permanent)
- Citation soft delete (reversible)
- Audit logging (`admin_actions` table)
- Auto-unsuspend when suspension expires
- **Admin authentication NOT enabled** (security - waiting for JWT-only setup)

---

## Current Phase: Phase 3A Security Setup

### ⚠️ Admin Authentication Required

**Status**: Backend complete, admin access disabled for security

**Issue**: Admin endpoints currently use anonymous ID authentication, which is insecure for high-privilege operations.

**Solution**: Require JWT authentication for admin access

**Options**:
1. **JWT Authentication (Recommended)** - Register with email/password, use JWT tokens
2. **IP Whitelist** - Restrict admin endpoints to specific IPs
3. **Session Timeout** - Require re-auth every hour

See CLAUDE.md Phase 3A section for detailed setup instructions.

**Next Steps**:
- [ ] Register admin account with email/password
- [ ] Update `adminAuth.js` to require JWT (reject anonymous)
- [ ] Test admin endpoints with JWT token
- [ ] Optionally add IP whitelist

---

## Next Phase: Phase 3B

### Admin Web Dashboard

**Goal**: GUI for admin moderation (no CLI/curl required)

**Features**:
- Simple HTML/CSS/JS admin page
- Login with admin credentials
- Tabs: Users | Citations | Audit Log
- Tables with search/filter
- Action buttons (suspend, block, delete, restore)
- Modal forms for reasons/durations

**Implementation**:
- Serve from `backend/public/admin.html`
- Vanilla JS + fetch API (no framework needed)
- JWT authentication required
- ~3-4 hours of work

---

## Future Phases

### Phase 3C: Community Moderation
- User blocking (hide specific users' citations)
- Report system (flag spam/harassment/misinformation)
- Report reasons dropdown
- User-level filtering (toggle show/hide others)

### Phase 4: Quality Control & Voting
- Upvote/downvote system
- Karma scores for users
- Trust levels (auto-calculated from karma)
- Sort citations by score
- Filter low-quality citations
- Shadow-ban repeat offenders

### Phase 5: YouTube Creator Features
- Google OAuth for channel verification
- Creator-only moderation on their videos
- Analytics for video owners
- Verified creator badges

### Phase 6: Advanced Features
- Edit annotations (version history)
- Reply threads (nested comments)
- Full-text search (PostgreSQL full-text)
- Trending annotations
- Multi-browser support (Firefox, Safari)
- Cross-device sync for registered users
- Email notifications for replies/mentions

---

## Recent Fixes & Improvements

### User Profile Modal Feature (Session 2026-02-13)
- Clickable badges showing user stats
- Profile information: citations, videos, join date, recent activity
- "YOU - pseudonym" format for own profile
- Color-coded: teal border/stats for yours, grey for others
- Backend: `/api/users/:userId/profile` endpoint
- Files: `userProfileUI.js`, `backend/src/routes/users.js`

### Display Names in Annotations
- Show creator pseudonyms on all annotations
- Backend JOINs users table to fetch `creator_display_name`
- Badges show "YOU - ~2026-XXXXXX" or "~2026-XXXXXX"

### Extension Navigation Fixes
- Fixed UI not loading when navigating between videos
- Proper `waitForPlayer()` call on navigation
- Clean DOM element removal on video change

### Ad Detection & Marker Rendering
- Detect YouTube ads by standard durations (6s, 15s, 30s, 60s)
- Retry marker rendering after ads complete
- Multiple event listeners (durationchange, loadedmetadata, canplay)

### Sidebar Persistence Bug Fix
- Explicitly remove DOM elements on navigation
- Fixed sidebar from previous video appearing on new video

### Major UX/UI Improvements
- Triangle markers (instead of circles)
- Color scheme: teal + outline for "mine", grey for "others"
- Bibliography icon changed to ≡ character
- Consistent ownership colors across all UI elements

---

## Recent Commits

1. `9984285` - Add admin testing helper script
2. `fc15ff2` - Fix User model to include admin/moderation fields
3. `b76a874` - Implement admin moderation system (Phase 3A backend)
4. `a91867a` - Add placeholder message to Sign In modal
5. `11b0538` - Use grey colors for other users' profile modals
6. `bb47179` - Apply grey color to other users' display names in profile
7. `4d9099e` - Update user profile modal with improved formatting
8. `62967c6` - Fix profile modal to show user's pseudonym
9. `ab88d9d` - Polish user profile modal based on feedback
10. `5ef8990` - Add user profile modal - click badges to view stats

---

## Known Issues

**None currently** - All major issues resolved

**Admin Security**:
- ⚠️ Admin endpoints exist but are disabled (no users have admin status)
- Must set up JWT authentication before enabling admin access
- See CLAUDE.md for security analysis and setup options

---

## Database Maintenance

**Connection String**:
```
postgresql://postgres:***REMOVED***@gondola.proxy.rlwy.net:46483/railway
```

**Common Operations**:
```bash
# Check admin status
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users WHERE is_admin = true;"

# List recent users
psql "$DATABASE_URL" -c "SELECT display_name, auth_type, created_at FROM users ORDER BY created_at DESC LIMIT 10;"

# View audit log
psql "$DATABASE_URL" -c "SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 20;"
```

**Clear Test Data**:
```bash
cd backend
node clear-data.js
```

---

## Quick Links

- **Repository**: https://github.com/abekatz11/youtube-annotator
- **Backend Health**: https://youtube-annotator-production.up.railway.app/api/health
- **Railway Dashboard**: railway.app

---

**Last Updated**: 2026-02-13
**Status**: Phase 3A backend complete, admin auth setup pending
**Next**: Enable JWT-only admin authentication → Build admin web dashboard
