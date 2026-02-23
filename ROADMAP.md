# YouTube Annotator - Roadmap

## Project Status

**Deployment**: ✅ Live on Railway
**Backend URL**: `https://youtube-annotator-production.up.railway.app`
**Database**: PostgreSQL on Railway
**Current Phase**: Phase 3D (Creator Verification) — Core flow complete, account merge done

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
- **⏳ Pending**: Real email sending requires custom domain + email service (SendGrid/AWS SES)
  - Currently in dev mode: verification URLs logged to Railway console
  - Waiting for domain configuration before enabling real email delivery

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
  - Extension Activity: Total Installs, Video Views (30d), Citation Clicks (30d) with daily time series table and inline bar charts
  - User count cards (Total, Anonymous, Password-Unverified, Password-Verified, YouTube, YouTube+Email)
  - User interventions (Suspended, Blocked)
  - Citation status (Active, Deleted)
  - Color-coded stat cards (grey=anonymous/unverified, green=verified, orange=YouTube, yellow=suspended, red=blocked)
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

### Extension Analytics Tracking ✅
- Self-hosted analytics system (no third-party dependencies)
- **Privacy**: No PII collected — only anonymous session IDs and video IDs
- **Events tracked**:
  - `extension_installed` — on fresh install (via `chrome.runtime.onInstalled` → storage flag → content script)
  - `video_viewed` — each time a YouTube video page loads with the extension active
  - `citation_clicked` — when a user clicks a progress bar marker (`source: 'marker'`) or sidebar citation (`source: 'sidebar'`)
- **Backend**: `POST /api/analytics/events` (batch up to 50, no auth required, rate limited 30/min)
- **Backend**: `GET /api/admin/analytics?days=30&period=daily` (admin-only, returns totals + pivoted time series)
- **Extension**: `AnalyticsTracker` class in `analytics.js` — batches events, 10s flush interval, fire-and-forget, flushes on `visibilitychange`
- **Admin dashboard**: Extension Activity section with summary cards + daily time series table with inline bar charts
- **DB**: `analytics_events` table (migration 012)
- Files: `analytics.js`, `backend/src/routes/analytics.js`, `backend/migrations/012_create_analytics_events.sql`

---

## Next Improvements

### Phase 3D: YouTube Creator Verification 🔧 IN PROGRESS

**Completed**:
- ✅ DB migration: `youtube_channel_id`, `youtube_verified`, `youtube_channel_title` on users table
- ✅ Backend: `POST /api/auth/youtube` — login/register via YouTube OAuth
- ✅ Backend: `POST /api/auth/youtube/connect` — link channel to existing account
- ✅ Backend: shares return `creatorYoutubeChannelId` in responses
- ✅ Extension: OAuth flow via `chrome.identity.getAuthToken` + background service worker
- ✅ Extension: "Continue with YouTube" button on login/register
- ✅ Extension: Account sidebar shows YouTube channel status + "Verify as YouTube Creator" button
- ✅ Extension: Dual-row marker layout — creator markers ▼ above bar (orange), viewer markers ▲ below bar (teal/grey)
- ✅ Extension: `isCreatorCitation` is a pure absolute property (channel ID match only, viewer-independent)
- ✅ OAuth login tested and working (fixed `redirect_uri_mismatch` by switching to `getAuthToken`)
- ✅ Creator detection working (fixed isolated world issue via `background.js` + `world: 'MAIN'` + `"scripting"` permission)
- ✅ Orange markers confirmed rendering correctly for creator citations
- ✅ Creator filter tab added to sidebar bibliography (All / Mine / Others / Creator)
- ✅ Elbow connector colors match marker colors (orange / teal / grey)
- ✅ Performance: N+1 requests → 1 request (full annotations included in video response, parallelized with channel ID fetch)
- ✅ Double-submission bug fixed (save button disabled on click, re-enabled only on error)
- ✅ Stale local storage bug fixed (clears local annotations on account switch if no owned share found)
- ✅ DB unique constraint on `youtube_channel_id` removed (migration 009) — OAuth proof of ownership is sufficient
- ✅ Anonymous ID cleared on YouTube login: post-logout sessions get a fresh account with no `youtube_channel_id`, preventing new citations from incorrectly appearing orange
- ✅ Badge consistency: creator citations always show orange badge ("Creator" / "Creator (YOU)") across markers, popups, and sidebar
- ✅ Sign-out resets `userShareId` to prevent stale share token being used in new anonymous session
- ✅ ESC key closes bibliography sidebar (or account sidebar)
- ✅ T4, T5, T7, T8 from testing plan verified
- ✅ Sidebar timestamp font color matches marker color (orange/teal/grey)
- ✅ Creator mode UI: buttons and creation flow switch from teal to orange accent when logged-in creator is on their own video
- ✅ Delete button works on owned creator citations (orange markers) — same behavior as owned teal markers
- ✅ Sidebar title renamed from "Annotations" to "Citations"
- ✅ YouTube auth hint text on login page: explains creator citation feature
- ✅ Creator mode extends to sidebar borders, headers, account avatar, and sign-out button (all orange when on own video)
- ✅ Channel ID detection fixed for SPA navigation: `movie_player.getVideoData()` as primary (replaces stale `ytInitialData`)
- ✅ Creator mode applied immediately on page load: channel ID fetched in parallel with auth/API init to reduce teal→orange flash

**Remaining Work**:
- T1: Display name picker (first-time YouTube login for brand-new users)
- T3: Connect YouTube for existing email account (needs fresh retest after DB fix)
- T6: Dual-row UI detail verification (visual overlap, z-index, popup badges)
- Account merge: two separate Citelines accounts (YouTube-auth + email) need a merge path — see Account Merge (Phase 3E) below

**Subsequent (Phase 4A)**:
- User-proposed citations that creators can approve/reject
- `citation_status` field: Proposed → Approved/Rejected
- Creator moderation queue in sidebar

---

### Account Merge (Phase 3E) ✅

**Completed**:
- ✅ DB migration 010: `merged_into`, `merged_at` columns + `'merged'` auth type
- ✅ DB migration 011: `'youtube_merged'` auth type for merged accounts that have YouTube linked
- ✅ `User.mergeAccounts()`: transfers shares, copies YouTube info, sets `auth_type = 'youtube_merged'` on primary, deactivates secondary
- ✅ `POST /api/auth/merge`: JWT-authenticated merge endpoint with guards
- ✅ Auto-detect at `/api/auth/youtube/connect`: returns `needsMerge` if separate YouTube account exists
- ✅ Extension merge UI: confirmation dialog with share count
- ✅ Auth middleware: merged accounts return 401 (forces re-login to primary)
- ✅ Admin dashboard: `youtube_merged` shown as "YouTube + Email" with orange badge
- ✅ Extension profile: `youtube_merged` displays as "Registered"
- ✅ Total Users in admin analytics excludes deactivated merged accounts

---

### Legal & Publishing Prerequisites
- **Terms of Service**: Write TOS for Citelines covering user-generated content, acceptable use, account termination, and disclaimer of liability
- **Privacy Policy**: Write Privacy Policy covering what data is collected (annotations, YouTube channel ID, email), how it's used, retention policy, and user rights — required by Chrome Web Store, YouTube OAuth consent screen, and GDPR/CCPA compliance
- **Hosting**: Publish both documents at a public URL (e.g. `citelines.org/terms` and `citelines.org/privacy`) before submitting to Chrome Web Store or going to YouTube API production mode
- **Google OAuth Consent Screen**: Link privacy policy URL in Google Cloud Console → OAuth consent screen (currently in "Testing" mode — publishing requires verified policy URL)
- **Chrome Web Store listing**: Both URLs required in the store developer dashboard before public listing

---

### Admin Dashboard Enhancements
- **UI Tweak**: The values in the Title column of the Citations tab all have "... - Annotation" as part of their name; don't do that.
- **UI Tweak**: Various places in the Admin dashboard say "Annotation" - change these to say "Citation"
- **UI Tweak**: Enable esc key and "click away" ability to close the modals for Delete, Restore (Citations Tab) and Suspend, Block (Users Tab) to behave the same as the View popup.
- **Citation Type Column**: Display citation type (Basic Note, YouTube Video, Movie, Article, etc.) in Citations tab to provide context for "Citation Content" - matches front-end UI types
- **Citation Status Column**: Add "Citation Status" column showing lifecycle state (Proposed, Rejected, Approved, User-Deleted) - prepares for moderation workflow
- **Date Range Filters**: Implement date range filtering for Joined and Created columns (currently placeholders)
- **Export Functionality**: Export user/citation data to CSV
- **Action Reasons**: rather than free-form for "Delete" and "Restore" reasons, make it a dropdown menu for data validation.
---

## Phase 3D Testing Plan

### T1: YouTube Login (new user)
- [ ] Open account sidebar → login screen visible
- [ ] Click "Continue with YouTube"
- [ ] Google account picker appears (no redirect_uri_mismatch error)
- [ ] First-time user: prompted for display name (suggested from channel title)
- [ ] After choosing name: logged in, sidebar shows account info
- [ ] Account sidebar shows "Connect YouTube Channel" button (login-via-YouTube should auto-connect — verify it shows channel name instead)

### T2: YouTube Login (returning user)
- [ ] Click "Continue with YouTube"
- [ ] No account picker (token cached) or picker appears and auto-selects
- [ ] Logged in immediately with existing account
- [ ] Markers update colors correctly (teal = mine, grey = others)

### T3: Connect YouTube Channel (existing email account)
- [ ] Log in with email/password
- [ ] Account sidebar shows "Connect YouTube Channel" button
- [ ] Click button → OAuth flow → channel connected
- [ ] Sidebar now shows "✓ YouTube: [channel name]"
- [ ] Re-fetch annotations → creator citations update (if any)

### T4: Creator citations — own video ✅
- [x] Log in via YouTube (or connect channel to account)
- [x] Navigate to one of your own YouTube videos
- [x] Create a citation
- [x] After save + re-fetch: citation appears in **orange** creator row (you are the verified creator)
- [x] Popup shows "Creator (YOU) - [name]" badge in orange
- [x] Sidebar shows "Creator (YOU) - [name]" badge in orange
- [x] Log out → new anonymous citation on same video appears **teal** (no verified creator identity in anonymous session)

### T5: Creator citations — viewer perspective ✅
- [x] As a different user (or logged out), go to a video by a YouTube-verified Citelines user
- [x] Their citations appear in the **orange** row (confirmed working in incognito too)
- [x] Non-creator citations remain in viewer row
- [ ] Both rows independently clickable

### T6: Dual-row UI
- [ ] When creator citations exist: two distinct marker rows visible
- [ ] Orange row is above the teal/grey row
- [ ] Creator popup shows "Creator" badge
- [ ] Viewer popup shows normal badge
- [ ] No visual overlap or z-index issues

### T7: Sign out ✅
- [x] Sign out from account sidebar
- [x] Markers revert to grey (no owned annotations)
- [x] Login button reverts to 👤 icon
- [x] Creator markers remain orange (still visible as viewer)

### T8: Navigation between videos ✅
- [x] Create citation on video A (own channel) → teal marker (it's yours)
- [x] Navigate to video B (not your channel) → no orange markers
- [x] Navigate back to video A → teal/orange marker reappears
- [x] No stale markers from previous video

---

## Future Phases

### Phase 4A: Creator Tools (Creator Mode Enhancements)

When a verified creator is viewing their own video (orange UX), they should have additional tools beyond the standard citation flow.

**Quick-Add Mode**:
- Keyboard-driven citation entry for creators who know their own video's source timestamps
- Input fields for timestamp + note/full citation, submit with Enter or Cmd+Enter
- No mouse navigation to the progress bar required — optimized for bulk citation entry
- Could live in the sidebar or as a dedicated panel

**Review Others' Citations**:
- Creator can see all viewer-contributed citations on their video
- Action options (exact functionality TBD — present all in early mock):
  - **Remove**: Creator directly removes a citation from their video
  - **Edit**: Creator can correct/improve a viewer's citation
  - **Flag for removal**: Softer option — flags for admin review rather than immediate removal
- Need to decide on permission model: should creators have full delete power, or just flagging?

**Give Props**:
- Creator can endorse/highlight viewer citations they approve of or especially appreciate
- Visual indicator on "propped" citations (badge, highlight, or special icon)
- Could tie into karma/trust system (Phase 4 Quality Control)
- Incentivizes high-quality contributions from viewers

### Export Citations as CSV

**Dashboard Export** (citelines.org):
- "Download as CSV" button on the user's dashboard
- Exports all of the user's citations across all videos
- Columns: video title, video URL, timestamp, citation type, citation content, date added

**Sidebar Export** (extension):
- "Download as CSV" button in the bibliography sidebar while watching a video
- Exports all visible citations for the current video (respects active filter tab: All/Mine/Others/Creator)
- Columns: timestamp, citation type, citation content, contributor, date added

### User Dashboard Enhancements (citelines.org)

Improve the logged-in user dashboard at citelines.org with richer browsing and search capabilities.

- Sort citations by date added, video title, timestamp, or citation type
- Filter citations by video, citation type, or date range
- Group citations by video (expandable/collapsible video sections)
- Search across all citations (full-text search on citation content)
- Search by video title or video ID
- Pagination or infinite scroll for users with many citations

### Account Deletion

Allow users to fully delete their Citelines account and associated data.

- User-initiated deletion flow (from extension account sidebar or citelines.org dashboard)
- Deletes or anonymizes: user record, shares/citations, YouTube channel link
- Confirmation step with clear explanation of what will be removed
- Required for compliance with data protection expectations (GDPR, etc.)

### Citation Trees (Infrastructure)

The ability to add a citation to a citation — nesting sources to deeper, more original references where applicable.

**Concept**: A viewer cites a secondary source in a video. Another user (or the same user) can attach a deeper citation to that citation, pointing to the primary/original source. This creates a tree of references rather than a flat list.

**Use cases**:
- Video cites a news article → user adds citation to the original study the article references
- Creator cites a claim → viewer adds the peer-reviewed source behind that claim
- Layered fact-checking: surface source → deeper source → original data

**Design considerations**:
- Data model: `parent_citation_id` foreign key on annotations, nullable (top-level = null)
- UI: expand/collapse nested citations in popup and sidebar
- Depth limit? (e.g., max 3 levels to avoid rabbit holes)
- How to display on progress bar — nested citations share the parent's timestamp marker, or get their own?
- Moderation complexity increases with nesting

---

### Phase 3C: Community Moderation
- User blocking (hide specific users' citations)
- Report system (flag spam/harassment/misinformation)
- Report reasons dropdown
- User-level filtering (toggle show/hide others)

### Phase 4: Quality Control & Voting
- Validate citations against existing citations / 3rd party database of citations
- Upvote/downvote system
- Karma scores for users
- Trust levels (auto-calculated from karma)
- Sort citations by score
- Shadow-ban repeat offenders

### Phase 5: YouTube Creator Features
- Pulled forward into Phase 3D (see above)
- Creator-only moderation on their videos
- Analytics for video owners

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

### Ad Detection & Marker Rendering (Revised 2026-02-22)
- Original approach (2026-02-13): heuristic based on video duration matching standard ad lengths (6/15/30/60s) — caused false positives and missed non-standard ads
- New approach: detect ads via YouTube's `.ad-showing` class on `.html5-video-player`
- MutationObserver watches for class removal, then re-renders markers after 300ms settle delay
- Observer cleaned up on SPA navigation to avoid leaks
- Fixes: markers not appearing when YouTube force-disables ad-blocker and pre-roll ads play

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

### Session 2026-02-22
1. Added `youtube_merged` auth type — preserves YouTube identity after account merge (migration 011)
2. `mergeAccounts()` sets `auth_type = 'youtube_merged'` when copying YouTube info to primary
3. Admin dashboard: "YouTube + Email" label, badge, and analytics card for `youtube_merged`
4. Extension profile: `youtube_merged` displays as "Registered"
5. Admin analytics: exclude merged accounts from Total Users count
6. Admin analytics: renamed "Total Citations" → "Total Lifetime Citations"
7. Admin analytics: green badges for Password-Verified/YouTube/YouTube+Email, grey for Anonymous/Unverified
8. Admin analytics: added "Extension Installs" placeholder section, then replaced with real Extension Activity
9. Self-hosted analytics system: `analytics_events` table (migration 012), ingestion endpoint, admin endpoint
10. Extension analytics: `AnalyticsTracker` class with batching, `video_viewed`/`citation_clicked`/`extension_installed` events
11. `background.js`: `chrome.runtime.onInstalled` listener for install tracking
12. Admin dashboard color scheme: teal for citation clicks, grey for unverified, orange (#ffaa3e) for YouTube accounts, yellow for suspended
13. Added Account Deletion to ROADMAP.md as future feature

### Session 2026-02-19
1. Fixed `redirect_uri_mismatch` OAuth error: switched `background.js` from `launchWebAuthFlow` to `chrome.identity.getAuthToken`
2. Phase 3D: YouTube creator verification + dual-row marker UI (backend + frontend)
3. Auth sidebar, persistent login, parallel auth init, marker color refresh on login/logout
4. Fixed creator detection: content scripts run in isolated JS world — added `"scripting"` permission and `GET_CHANNEL_ID` background handler using `executeScript({ world: 'MAIN' })`
5. Fixed double-submission: save button disabled on click, re-enabled only on non-fatal error
6. Fixed stale local storage on account switch: clear `annotations[videoId]` if no owned share found
7. Fixed N+1 requests: full annotations now included in `GET /api/shares/video/:videoId` response, parallelized with channel ID fetch
8. Added "Creator" filter tab to sidebar bibliography (All / Mine / Others / Creator)
9. Flipped marker directions: viewer markers ▲ below progress bar, creator markers ▼ above
10. Fixed elbow connector colors to match marker color (orange / teal / grey)
11. Fixed DB unique constraint blocking YouTube channel connect (migration 009: `DROP INDEX users_youtube_channel_id_unique`)
12. Changed button copy: "Connect YouTube Channel" → "Verify as YouTube Creator"
13. Fixed badge consistency: `isCreatorCitation` takes priority in all badge/popup/sidebar logic; "Creator (YOU)" shown in orange when also own
14. Sign-out now resets `userShareId` to prevent stale share token being used in new anonymous session
15. Fixed root cause of anonymous citations appearing orange: `anonymousId` in storage pointed to upgraded YouTube-auth account (with `youtube_channel_id` set); now cleared on YouTube login and on `setYouTubeChannel` so post-logout sessions use a fresh account
16. `isCreatorCitation` reverted to pure absolute channel-ID comparison (viewer-independent — orange is a property of the annotation, not the viewer)
17. ESC key now closes the bibliography sidebar (or account sidebar)
18. Sidebar timestamp font color matches marker color (orange/teal/grey)
19. Creator mode UI: buttons + creation flow switch to orange accent when creator is on own video
20. Delete button on owned creator citations (orange markers) now works correctly
21. Sidebar title renamed "Annotations" → "Citations"
22. YouTube auth hint text added to login/register page
23. Creator mode extended to sidebar borders, headers, account avatar, sign-out button
24. Fixed stale channel ID on SPA navigation: switched to `movie_player.getVideoData()` as primary detection method
25. Channel ID fetch parallelized with auth/API init to reduce teal→orange flash on page load
26. Citation popup z-index raised above sidebar (10003 > 10001)
27. Admin dashboard: 4 auth type categories (Anonymous, Password-Unverified, Password-Verified, YouTube) in Analytics + Users tabs
28. Fixed admin users endpoint missing `email_verified` field in SQL SELECT

### Session 2026-02-13 PM
1. `d6d230d` - Fix ad detection false positives causing missing markers on first load
2. `3ccf641` - Add debug logging to renderMarkers to diagnose first-load marker issue
3. `2ea0cf8` - Add Citation Type and Citation Status columns to future improvements
4. `a85c10c` - Update roadmap: Phase 3B complete, document admin dashboard implementation
5. `a0ab989` - Add X button, overlay click, and ESC key to close user details modal
6. `893c97b` - Add detailed User Details modal with identifiers, citations, and admin action history
7. `a2e2ffa` - Add Select All and Clear All buttons to filter dropdowns
8. `4e9a781` - Update analytics card border colors: Temporary=grey, Unverified=yellow
9. `79973bd` - Update Citations tab columns: add/remove filters, rename columns, remove Share Size
10. `1849f61` - Update column filtering: limit filters to Auth Type, Status, Joined only
11. `d29deb3` - Improve filter dropdown positioning - attach to column header
12. `9afcb4d` - Fix filter dropdown clipping issue
13. `b607b75` - Fix admin dashboard filtering and sorting bugs
14. `04ae387` - Implement Google Sheets-style column filters

### Earlier Admin Dashboard Work (2026-02-13 AM)
15. `f7a9a10` - Add filters and sortable columns to Users and Citations tabs
16. `fb0f3da` - Add Analytics tab and simplify count displays
17. `c0b0106` - Add dynamic user count display to Users tab
18. `7a51598` - Add dynamic annotation count display to Citations tab
19. `22d3358` - Reconcile annotation counts across Users and Citations tabs

---

## Known Issues

### ~~BUG: Citation creation fails after login (without page refresh)~~ — FIXED ✅
**Root cause**: Stale `userShareId` pointing to anonymous share token after login → 403 on update.
**Fix**: Reset `userShareId = null` at top of `fetchAllAnnotations` (commit `6d7f69e`).

### UX: Duplicate creator accounts cause confusing sidebar filters — LOW PRIORITY
**Repro**: User has two accounts (email + YouTube-auth) both with the same YouTube channel linked. On their own video: "Mine" shows citations from the current login only (1), "Creator" shows citations from both accounts (2). Same citation appears in both filters if it's own + creator.
**Root cause**: Two separate accounts own separate shares but share the same `youtube_channel_id`. The sidebar filters are technically correct (`isOwn` = current account only, `isCreatorCitation` = any account with matching channel), but the overlap is confusing.
**Resolution**: This will resolve naturally with Account Merge (Phase 3E). No code fix needed — the real fix is having a single account.

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

**Last Updated**: 2026-02-22
**Status**: Phase 3D complete (creator verification + account merge done), extension analytics tracking live
**Next**: Finish T1/T3/T6, then Creator Tools (Phase 4A), Legal/Publishing prerequisites, or Account Deletion
