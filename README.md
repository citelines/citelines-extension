# Citelines — Video Annotator

A browser extension that creates a collaborative citation layer on videos. Add timestamped citations to a video — all users with the extension see citations from everyone.

Pilot browser: Chrome; Pilot player: YouTube.com

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-red)

**Website**: [citelines.org](https://www.citelines.org)

## What It Does

- **Timestamped citations** — Viewers can click + to add a citation at the current video time
- **Collaborative** — every citation is visible to all Citelines users on that video. Other viewers can suggest edits to existing citations.
- **Creator Tools** — Video creators can add citations as part of the publishing flow, at time of upload. Other viewers will see those citations on the video as added by the video's creator.
- **In-context citations** — Video Player Progress Bar has markers color-coded by ownership:
  - **Teal** = yours
  - **Grey** = other users'
  - **Orange** = the video's creator
- **Bibliography sidebar** — browse and filter (All / Mine / Others / Creator) citations
- **Citation types** — basic notes, YouTube videos, movies, articles with structured fields
- **Modify citations** — edit your own citations, report or suggest edits on others'
- **Accounts** — anonymous by default (90-day expiry), or register with email/password

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
- Watch page: modular ES modules bundled with esbuild (`src/content/` → `content.bundle.js`)
- Studio sidebar: creator citation tools on `studio.youtube.com` (`src/studio/` → `studio.bundle.js`)
- Standalone scripts: `api.js`, `auth.js`, `youtubeAuth.js`, `loginUI.js`, `userProfileUI.js`, `analytics.js`
- Service worker: `background.js` (OAuth, channel ID detection, install tracking)

**Backend** (Node.js + Express):
- PostgreSQL with JSONB
- JWT + anonymous ID authentication
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
├── src/studio/               # Studio sidebar modules (esbuild entry: main.js)
│   ├── main.js               # Orchestrator: detect video edit page, SPA nav
│   ├── sidebar.js            # Sidebar DOM, citation list, layout push
│   ├── citationForm.js       # Quick Add form with dynamic fields
│   ├── markers.js            # Orange markers on Studio video preview
│   └── ...                   # storage, state, globals
├── content.bundle.js         # Built watch page bundle (do not edit directly)
├── studio.bundle.js          # Built studio bundle (do not edit directly)
├── api.js                    # Backend API client
├── auth.js                   # AuthManager (JWT + anonymous)
├── youtubeAuth.js            # YouTube OAuth helpers
├── manifest.json             # Extension manifest
├── content.css               # Watch page styling
├── studio.css                # Studio sidebar styling
├── background.js             # Service worker
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/           # auth, shares, users, admin, analytics
│   │   ├── models/           # User, Share
│   │   └── middleware/       # auth, rateLimiter, adminAuth
│   ├── migrations/           # SQL schema files
│   └── public/               # Admin dashboard (admin.html, admin.js)
└── dev-docs/                 # Design docs (refactor, testing, moderation, etc.)
```

## Development

```bash
# Build both bundles (content + studio)
npm run build

# Watch mode (rebuilds on file change)
npm run watch          # content bundle
npm run watch:studio   # studio bundle

# Start backend locally (only needed for backend development)
cd backend && npm run dev
```

After changing files in `src/content/` or `src/studio/`, rebuild and reload the extension in `chrome://extensions/`.

## Documentation

- **[citelines.org/documentation](https://www.citelines.org/documentation)** — additional documentation
- **[dev-docs/](dev-docs/)** — design docs for specific features

## License

All Rights Reserved — see [LICENSE](LICENSE) for details.

---

Built by [Citelines](https://www.citelines.org). Powered by Chrome Extension Manifest V3, Node.js, Express, and PostgreSQL.
