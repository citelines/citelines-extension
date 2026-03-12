# Citelines — YouTube Annotator

A Chrome extension that creates a collaborative citation layer on YouTube videos. Add timestamped citations to any video — all users with the extension see citations from everyone.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

**Website**: [citelines.org](https://www.citelines.org)

## What It Does

- **Timestamped citations** — click + to add a citation at the current video time
- **Collaborative by default** — every citation is visible to all Citelines users on that video
- **Triangle markers on the progress bar** — color-coded by ownership:
  - **Teal** = yours
  - **Grey** = other users'
  - **Orange** = the video's YouTube creator (verified via OAuth)
- **Citation types** — basic notes, YouTube videos, movies, articles with structured fields
- **Bibliography sidebar** — browse, filter (All / Mine / Others / Creator), and search citations
- **Three-dot menu** — edit your own citations, report or suggest edits on others'
- **Creator mode** — verified YouTube creators get an orange UI accent when viewing their own videos
- **Accounts** — anonymous by default (90-day expiry), or register with email/password or YouTube OAuth

## Installation

### Chrome Web Store

*Coming soon.*

### Load Unpacked (Development)

1. Clone and install:
   ```bash
   git clone https://github.com/abekatz11/youtube-annotator.git
   cd youtube-annotator
   npm install
   npm run build
   ```

2. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `youtube-annotator` folder

3. Go to any YouTube video — the + button, bibliography icon, and account icon appear on the player.

### Backend (for local development)

```bash
cd backend
npm install
cp .env.example .env   # edit with your PostgreSQL credentials
npm run migrate
npm run dev
```

The production backend is hosted on Railway.

## Tech Stack

**Extension** (Chrome Manifest V3):
- Content scripts: modular ES modules bundled with esbuild (`src/content/` → `content.bundle.js`)
- Standalone scripts: `api.js`, `auth.js`, `youtubeAuth.js`, `loginUI.js`, `userProfileUI.js`, `analytics.js`
- Service worker: `background.js` (OAuth, channel ID detection, install tracking)

**Backend** (Node.js + Express):
- PostgreSQL with JSONB for flexible citation storage
- JWT + anonymous ID dual authentication
- Multi-layer rate limiting
- Admin moderation system with web dashboard
- Hosted on Railway

## Project Structure

```
youtube-annotator/
├── src/content/              # Content script modules (esbuild entry: main.js)
│   ├── main.js               # Orchestrator: init, player detection, SPA navigation
│   ├── state.js              # Shared state
│   ├── markers.js            # Triangle markers on progress bar
│   ├── popup.js              # Citation view popup
│   ├── annotationsSidebar.js # Bibliography sidebar
│   ├── accountSidebar.js     # Account/auth sidebar
│   ├── creatorMode.js        # YouTube creator detection + orange UX
│   ├── fetchAnnotations.js   # Fetch citations from backend
│   └── ...                   # utils, storage, modals, citationFields, etc.
├── content.bundle.js         # Built bundle (do not edit directly)
├── api.js                    # Backend API client
├── auth.js                   # AuthManager (JWT + anonymous)
├── youtubeAuth.js            # YouTube OAuth helpers
├── manifest.json             # Extension manifest
├── content.css               # UI styling
├── background.js             # Service worker
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/           # auth, shares, users, admin, analytics
│   │   ├── models/           # User, Share
│   │   └── middleware/       # auth, rateLimiter, adminAuth
│   ├── migrations/           # SQL schema files
│   └── public/               # Admin dashboard (admin.html, admin.js)
├── CLAUDE.md                 # Detailed technical documentation
├── ROADMAP.md                # Project status, phases, and next steps
└── dev-docs/                 # Design docs (refactor, testing, moderation, etc.)
```

## Development

```bash
# Build content script bundle
npm run build

# Watch mode (rebuilds on file change)
npm run watch

# Start backend locally
cd backend && npm run dev
```

After changing files in `src/content/`, rebuild and reload the extension in `chrome://extensions/`.

## Security

- HTTPS only (Railway SSL)
- CORS restricted to YouTube.com
- bcrypt password hashing (12 rounds)
- JWT tokens with 30-day expiry
- Multi-layer rate limiting (5 layers)
- Parameterized SQL queries (no injection)
- HTML escaping on all user content (no XSS)
- Admin audit logging
- Pre-commit hook for credential scanning

## Documentation

- **[CLAUDE.md](CLAUDE.md)** — full technical documentation (architecture, API endpoints, database schema, auth system, deployment)
- **[ROADMAP.md](ROADMAP.md)** — project status, completed phases, future plans
- **[dev-docs/](dev-docs/)** — design docs for specific features

## License

All Rights Reserved — see [LICENSE](LICENSE) for details.

---

Built by [Citelines](https://www.citelines.org). Powered by Chrome Extension Manifest V3, Node.js, Express, and PostgreSQL.
