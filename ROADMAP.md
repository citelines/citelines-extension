# YouTube Annotator - Roadmap

## Project Status

**Deployment**: ✅ Live on Railway
**Backend URL**: `https://youtube-annotator-production.up.railway.app`
**Database**: PostgreSQL on Railway
**Current Phase**: Phase 3B Complete (Admin Dashboard)

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
- JWT-only authentication for admin endpoints

### Phase 3B: Admin Web Dashboard ✅
- Login page with JWT authentication
- Four tabs: Users | Citations | Analytics | Audit Log
- **Users Tab**:
  - Sort and filter on Auth Type, Status, Joined columns
  - User Details modal with identifiers, citations list, admin action history
  - Action buttons (View, Suspend, Block/Unblock)
- **Citations Tab**:
  - Sort and filter on Creator, Status, Created columns
  - Renamed columns: "Citation Content", "Video Timestamp"
  - Removed "Share Size" column
  - Bulk delete with selection
- **Analytics Tab**:
  - User count cards (Total, Temporary, Verified, Unverified)
  - User interventions (Suspended, Blocked)
  - Citation status (Active, Deleted)
  - Color-coded stat cards
- **Audit Log Tab**:
  - View all admin actions with search
- **Filter UI**:
  - Google Sheets-style dropdowns
  - Sort A→Z / Z→A options
  - Select All / Clear All buttons
  - Fixed positioning (no clipping issues)
- **User Details Modal**:
  - Comprehensive user view with identifiers, account status
  - Full citations list with video IDs
  - Admin action history
  - Multiple close options (X button, overlay click, ESC key)
- Vanilla JS + fetch API, no framework

---

## Next Improvements

### Admin Dashboard Enhancements
- **Citation Type Column**: Display citation type (Basic Note, YouTube Video, Movie, Article, etc.) in Citations tab to provide context for "Citation Content" - matches front-end UI types
- **Citation Status Column**: Add "Citation Status" column showing lifecycle state (Proposed, Rejected, Approved, User-Deleted) - prepares for moderation workflow
- **Date Range Filters**: Implement date range filtering for Joined and Created columns (currently placeholders)
- **Export Functionality**: Export user/citation data to CSV
- **Advanced Search**: Full-text search across all fields

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

### Admin Dashboard Implementation (Session 2026-02-13 PM)
- Built complete admin web dashboard (`/admin.html`)
- Implemented JWT authentication with login page
- Created four-tab interface (Users, Citations, Analytics, Audit Log)
- **Filter Dropdown System**:
  - Initially had clipping issues with short tables
  - Fixed with `position: fixed` and dynamic positioning
  - Added smart placement (above/below based on available space)
  - Moved dropdown creation to document.body (eliminated parent container constraints)
- **Column Configuration**:
  - Made filters optional per column
  - Added "Select All" / "Clear All" buttons
  - Sort-only columns for Display Name, Email, Annotations, Title, Content, Timestamp
  - Filter+Sort columns for Auth Type, Status, Creator, Joined, Created
- **User Details Modal**:
  - Comprehensive view with identifiers, account status, citations, admin actions
  - Added new admin endpoint: `GET /api/admin/users/:userId`
  - Multiple close methods (X button, overlay, ESC key, button)
- **UI Polish**:
  - Analytics cards with color-coded borders (Temporary=grey, Verified=green, Unverified=yellow)
  - Removed "Share Size" column from Citations tab
  - Renamed columns for clarity ("Citation Content", "Video Timestamp")
- Files: `backend/public/admin.html`, `backend/public/admin.js`, `backend/src/routes/admin.js`

### User Profile Modal Feature (Session 2026-02-13 AM)
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

### Today's Admin Dashboard Session (2026-02-13 PM)
1. `a0ab989` - Add X button, overlay click, and ESC key to close user details modal
2. `893c97b` - Add detailed User Details modal with identifiers, citations, and admin action history
3. `a2e2ffa` - Add Select All and Clear All buttons to filter dropdowns
4. `4e9a781` - Update analytics card border colors: Temporary=grey, Unverified=yellow
5. `79973bd` - Update Citations tab columns: add/remove filters, rename columns, remove Share Size
6. `1849f61` - Update column filtering: limit filters to Auth Type, Status, Joined only
7. `d29deb3` - Improve filter dropdown positioning - attach to column header
8. `9afcb4d` - Fix filter dropdown clipping issue
9. `b607b75` - Fix admin dashboard filtering and sorting bugs
10. `04ae387` - Implement Google Sheets-style column filters

### Earlier Admin Dashboard Work (2026-02-13 AM)
11. `f7a9a10` - Add filters and sortable columns to Users and Citations tabs
12. `fb0f3da` - Add Analytics tab and simplify count displays
13. `c0b0106` - Add dynamic user count display to Users tab
14. `7a51598` - Add dynamic annotation count display to Citations tab
15. `22d3358` - Reconcile annotation counts across Users and Citations tabs

---

## Known Issues

**None currently** - All major issues resolved

**Admin Security**:
- ⚠️ Admin endpoints exist but are disabled (no users have admin status)
- Must set up JWT authentication before enabling admin access
- See CLAUDE.md for security analysis and setup options

---

## Database Maintenance

**⚠️ SECURITY**: Never commit database credentials. Get `DATABASE_URL` from Railway dashboard.

**Common Operations**:
```bash
# Check admin status
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE is_admin = true;"

# List recent users
railway run psql $DATABASE_URL -c "SELECT display_name, auth_type, created_at FROM users ORDER BY created_at DESC LIMIT 10;"

# View audit log
railway run psql $DATABASE_URL -c "SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 20;"
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

**Last Updated**: 2026-02-13 (PM)
**Status**: Phase 3B complete - Admin dashboard fully functional
**Next**: Citation type display, date range filters, community moderation features
