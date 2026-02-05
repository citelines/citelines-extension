# YouTube Annotator

A Chrome extension that creates a collaborative annotation layer on YouTube videos. All users with the extension automatically see annotations from all other users, similar to a crowdsourced comment system on the progress bar.

## Project Status

**Deployment**: ✅ Live on Railway
**Backend URL**: `https://youtube-annotator-production.up.railway.app`
**Mode**: Collaborative annotations (automatic sharing)
**Database**: PostgreSQL on Railway
**Status**: ✅ Fully functional - ownership detection working correctly

## Quick Links

- **Repository**: https://github.com/abekatz11/youtube-annotator
- **Backend Health**: https://youtube-annotator-production.up.railway.app/api/health
- **Railway Dashboard**: railway.app

## Project Structure

```
youtube-annotator/
├── manifest.json          # Chrome extension manifest (V3)
├── content.js             # Main extension logic with collaborative sync
├── api.js                 # Backend API client (production Railway URL)
├── shareUI.js             # UI components (legacy, unused)
├── content.css            # Styling for markers and popups
├── backend/               # Node.js + Express backend (deployed on Railway)
│   ├── src/
│   │   ├── server.js      # Express server with CORS, rate limiting, proxy trust
│   │   ├── config/database.js
│   │   ├── middleware/    # auth.js, errorHandler.js
│   │   ├── models/        # User.js, Share.js
│   │   ├── routes/        # auth.js, shares.js
│   │   ├── utils/         # tokenGenerator.js, validator.js
│   │   └── migrate.js
│   ├── migrations/        # SQL schema files
│   ├── railway.json       # Railway deployment config
│   └── package.json
├── SETUP.md
├── README.md
└── CLAUDE.md              # This file (gitignored)
```

## Current Features

### Collaborative Annotation System
- **Auto-share**: Every annotation automatically saved to backend
- **Auto-fetch**: See all users' annotations when loading a video
- **Color-coded markers** (intended behavior):
  - 🔴 Red markers: Your annotations ("YOU" badge)
  - 🔵 Blue markers: Other users' annotations ("OTHER USER" badge)
- **Real-time sync**: Changes sync to Railway backend
- **Click to view**: See annotation text, timestamp, ownership
- **Delete your own**: Can only delete your annotations
- **Anonymous auth**: No sign-up, automatic ID generation
- **Local + Cloud**: Stored locally (offline) and in backend (shared)

### Recent Fixes

**Ownership Detection Bug** ✅ FIXED:
- **Problem**: Incognito and regular windows were sharing the same anonymous ID
- **Root cause**: chrome.storage.local is shared between incognito and regular modes by default
- **Solution**: Implemented separate storage keys for each context:
  - Regular mode: `anonymousId`
  - Incognito mode: `anonymousId_incognito`
- **Result**: Each context now has its own user identity, ownership detection works correctly
- Red markers ("YOU") = your annotations
- Blue markers ("OTHER USER") = other users' annotations

## Technical Implementation

### Data Flow (Collaborative Mode)

**Creating an Annotation:**
1. User clicks + button, types text, clicks Save
2. Saves to chrome.storage.local (local backup)
3. Syncs to backend via `POST /api/shares` or `PUT /api/shares/:token`
4. Re-fetches all annotations for video (to get updated isOwner flags)
5. Renders all annotations with correct ownership

**Loading a Video:**
1. Extension detects video ID from URL
2. Initializes API (gets/creates anonymous ID)
3. Fetches all shares for video: `GET /api/shares/video/:videoId`
4. For each share, fetches full details: `GET /api/shares/:token` (includes isOwner)
5. Flattens all annotations into `sharedAnnotations` array with isOwn flags
6. Renders markers (red if isOwn, blue if !isOwn)

### Backend Architecture

**Deployed on Railway:**
- Production URL: `https://youtube-annotator-production.up.railway.app`
- PostgreSQL database managed by Railway
- Auto-deploys on push to main branch
- Environment: production
- Migrations run once (not on every deploy)

**Key Configurations:**
- `app.set('trust proxy', true)` - Railway runs behind proxy
- CORS allows YouTube.com origin (Chrome Private Network Access)
- Rate limiting: 100 req/min general, 50 writes/hour (GET requests not limited)

**Authentication:**
- Anonymous ID (128-bit base64url)
- Stored in chrome.storage.local
- Sent via X-Anonymous-ID header
- Backend looks up user and sets `isOwner` field in responses

### Database Schema

**users table:**
```sql
- id (UUID, primary key)
- anonymous_id (VARCHAR, unique)
- auth_type (VARCHAR) - 'anonymous'
- created_at (TIMESTAMP)
- email, display_name (NULL for anonymous)
```

**shares table:**
```sql
- id (UUID, primary key)
- share_token (VARCHAR, unique, 8 chars)
- user_id (UUID, foreign key)
- video_id (VARCHAR) - YouTube video ID
- title (VARCHAR)
- annotations (JSONB) - Array of annotation objects
- is_public (BOOLEAN) - always true in collaborative mode
- view_count (INTEGER)
- created_at, updated_at (TIMESTAMP)
```

**Collaborative Mode Usage:**
- Each user has one share per video
- Share created on first annotation
- Share updated when annotations change
- All shares fetched and displayed to all users

### API Endpoints

**Health:**
- `GET /api/health` - Server status

**Authentication:**
- `POST /api/auth/register` - Create anonymous user
- `GET /api/auth/verify` - Verify anonymous ID (requires X-Anonymous-ID header)

**Shares (Collaborative):**
- `POST /api/shares` - Create share (requires X-Anonymous-ID)
- `GET /api/shares/:token` - Get share with isOwner field (optional auth)
- `GET /api/shares/video/:videoId` - Get all shares for video (public)
- `PUT /api/shares/:token` - Update share (requires ownership)
- `DELETE /api/shares/:token` - Delete share (requires ownership)

**Rate Limiting:**
- General: 100 requests/minute per IP
- Writes: 50 operations/hour per IP
- Reads (GET): Not rate limited (collaborative mode needs frequent fetching)

## Deployment History

### Initial Setup
1. Created Railway project from GitHub
2. Added PostgreSQL database
3. Set DATABASE_URL environment variable
4. Configured root directory to `backend`

### Issues Encountered & Fixed

**CORS Errors (Multiple iterations):**
- Issue: Chrome Private Network Access blocking YouTube.com → localhost
- Initial fix: Added Access-Control-Allow-Private-Network header
- Production issue: CORS config only allowed YouTube in development mode
- Final fix: Allow YouTube.com in both development and production

**Database Connection:**
- Issue: App trying to connect to localhost instead of Railway PostgreSQL
- Fix: Added DATABASE_URL environment variable in Railway

**Rate Limiting:**
- Issue: Rate limiter crashing due to X-Forwarded-For header
- Fix: Added `app.set('trust proxy', true)` for Railway proxy
- Issue: GET requests being rate limited (10/hour), blocking collaborative mode
- Fix: Changed rate limiter to skip GET requests, increased write limit to 50/hour

**Migration Issues:**
- Issue: Migrations running on every deploy, causing "relation already exists" errors
- Fix: Changed railway.json to only run `npm start`, not migrations
- Migrations now run manually only when schema changes

**Duplicate Annotations:**
- Issue: fetchAllAnnotations called renderMarkers() multiple times during async fetches
- Fix: Use Promise.all to wait for all fetches, render once at end

**Annotations Not Appearing:**
- Issue: Removed local rendering but didn't re-fetch after saving
- Fix: Re-fetch all annotations after syncing to backend

**Ownership Detection:** ✅ FIXED
- Issue: chrome.storage.local shared between incognito and regular modes
- Fix: Use separate storage keys (`anonymousId` vs `anonymousId_incognito`)
- Result: Each context has its own anonymous ID, proper ownership detection

## Development Notes

### Railway Deployment
- Auto-deploys on push to main branch
- Check deployments: Railway dashboard → service → Deployments tab
- View logs: Click deployment → View Logs
- Migrations: Run manually via shell or temporarily change start command

### Testing Collaborative Mode
1. Load extension in regular Chrome window
2. Load extension in incognito window (enable "Allow in incognito")
3. Both windows go to same YouTube video
4. Create annotation in one window
5. Should appear in both windows with correct colors

### Debugging
- Check console logs: `[YT Annotator]` prefix
- Check Network tab: Verify X-Anonymous-ID header sent
- Check API responses: Verify isOwner field values
- Check Railway logs: See backend errors

### Known Issues

**None currently** - All major issues have been resolved!

**Incognito Mode:**
- ✅ Works correctly with separate anonymous IDs
- ✅ Annotations properly color-coded (red = yours, blue = others)
- ✅ Each context (regular/incognito) treated as separate user

**Data Cleanup:**
- Old test annotations remain in database
- May confuse testing
- Can clear via: `chrome.storage.local.clear()` in console

## Recent Commits

1. `c6a4a15` - Fix: Separate anonymous IDs for incognito mode ✅
2. `7ad58f4` - Add debug logging for ownership detection
3. `597d029` - Fix: Don't render markers before fetching annotations
4. `79c985d` - Re-fetch annotations after saving to backend
5. `f72dc45` - Fix: Render annotations from shared data only
6. `212542f` - Fix duplicate annotations and multiple re-renders
7. `d8745b3` - Don't run migrations on every deploy
8. `2432296` - Fix rate limiting for collaborative mode

## Next Steps

1. ✅ ~~Fix ownership detection bug~~ - COMPLETE
2. **Clean test data** - Remove old annotations from database
3. **Test multi-user** - Verify collaborative mode with real users
4. **Polish UI** - Loading states, error messages
5. **Add filtering** - Toggle show/hide others' annotations
6. **Performance** - Test with many annotations
7. **Submit to Chrome Web Store** - Package and publish

## Future Features

### Phase 2: User Identity
- YouTube OAuth integration
- Display usernames with annotations
- Sync across devices
- User profiles

### Phase 3: Quality Control
- Voting system (upvote/downvote)
- Sort by score
- Filter low-quality
- Report spam

### Phase 4: Advanced Features
- Edit annotations
- Reply threads
- Full-text search
- Trending annotations
- Multi-browser support

## Support Resources

- **Setup Guide**: SETUP.md
- **API Documentation**: backend/README.md
- **Test Script**: backend/test-api.sh
- **Production Health**: `curl https://youtube-annotator-production.up.railway.app/api/health`

---

**Last Updated**: Ownership detection bug fixed - fully functional collaborative mode
**Status**: ✅ Production ready - all core features working correctly
**Repository**: https://github.com/abekatz11/youtube-annotator
