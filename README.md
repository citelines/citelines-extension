# YouTube Annotator

A Chrome extension that lets users add timestamped annotations to YouTube videos and share them with others. Similar to SoundCloud's comment markers on the playback bar.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Local Annotations
- ✅ Add timestamped annotations to any YouTube video
- ✅ Visual markers on the progress bar (red dots)
- ✅ Click markers to view annotation content
- ✅ Jump to specific timestamps
- ✅ Delete annotations
- ✅ Persistent storage (saved locally)
- ✅ Works with YouTube's SPA navigation

### Sharing Features (NEW!)
- ✅ Share your annotations via shareable links
- ✅ Import shared annotations from others
- ✅ Browse popular annotations for any video
- ✅ Three import modes:
  - **View Only**: See shared annotations without saving (blue markers)
  - **Merge**: Combine shared annotations with your local ones
  - **Replace**: Overwrite your annotations with shared ones
- ✅ Anonymous authentication (no sign-up required)
- ✅ Backend API with PostgreSQL

## Screenshots

**Adding an annotation:**
```
[YouTube Video Player]
          ⬆
     [+ button]
```

**Annotation markers on progress bar:**
```
[Progress bar with red dots at different positions]
 •     •        •           •
```

**Share modal:**
```
┌─────────────────────────────┐
│ Share Annotations           │
│                             │
│ Video: Example Video        │
│ Annotations: 5              │
│                             │
│ Title: [Optional]           │
│                             │
│ [Cancel]  [Create Share]    │
└─────────────────────────────┘
```

## Installation

### Option 1: From Chrome Web Store (Coming Soon)
*Extension pending review*

### Option 2: Load Unpacked (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/youtube-annotator.git
   cd youtube-annotator
   ```

2. Set up the backend (required for sharing features):
   - See [SETUP.md](SETUP.md) for detailed instructions
   - Quick start:
     ```bash
     cd backend
     npm install
     createdb youtube_annotator
     cp .env.example .env
     # Edit .env with your database credentials
     npm run migrate
     npm start
     ```

3. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `youtube-annotator` folder

4. Navigate to any YouTube video and start annotating!

## Usage

### Creating Annotations

1. Play a YouTube video
2. Pause at the moment you want to annotate
3. Click the red "**+**" button (bottom right of video player)
4. Type your annotation
5. Click "Save"

A red dot marker will appear on the progress bar at that timestamp.

### Viewing Annotations

- Click any red dot marker on the progress bar
- A popup will show:
  - Timestamp
  - Annotation text
  - "Go to" button (jumps to that timestamp)
  - "Delete" button (removes the annotation)

### Sharing Annotations

1. Click the blue "**Share**" button
2. Enter an optional title
3. Click "Create Share"
4. Copy the generated link and send it to others

The shareable link format:
```
https://youtube.com/watch?v=VIDEO_ID&share=TOKEN
```

### Importing Shared Annotations

**Method 1: Direct Link**
- Open a share link (e.g., from a friend)
- An import modal will appear automatically
- Choose how to import:
  - **View Only**: Preview annotations without saving
  - **Merge with Mine**: Add to your existing annotations
  - **Replace Mine**: Replace your annotations entirely

**Method 2: Browse**
- Click the green "**Browse**" button
- See all shared annotations for the current video
- Click on a share to preview and import

## Architecture

### Frontend (Chrome Extension)
- **content.js** - Main logic, UI rendering
- **api.js** - Backend API communication
- **shareUI.js** - Share/import modals
- **content.css** - Styling

### Backend (Node.js + Express)
- **PostgreSQL** database for storing users and shares
- **RESTful API** for creating/fetching shares
- **Anonymous authentication** (no emails required)
- **Rate limiting** to prevent abuse

### Data Flow
```
User clicks Share
  ↓
Extension sends annotations to backend
  ↓
Backend generates share token
  ↓
User gets shareable YouTube URL with token
  ↓
Recipient opens URL
  ↓
Extension detects token, fetches annotations
  ↓
Import modal appears
```

## API Endpoints

See [backend/README.md](backend/README.md) for complete API documentation.

**Core endpoints:**
- `POST /api/auth/register` - Create anonymous user
- `POST /api/shares` - Create share
- `GET /api/shares/:token` - Get shared annotations
- `GET /api/shares/video/:videoId` - Browse shares for video
- `GET /api/shares/me` - List user's shares
- `PUT /api/shares/:token` - Update share
- `DELETE /api/shares/:token` - Delete share

## Development

### Project Structure
```
youtube-annotator/
├── manifest.json          # Chrome extension manifest
├── content.js             # Main extension logic
├── api.js                 # API client
├── shareUI.js             # Share UI components
├── content.css            # Styles
├── backend/               # Node.js backend
│   ├── src/
│   │   ├── server.js      # Express server
│   │   ├── routes/        # API routes
│   │   ├── models/        # Database models
│   │   ├── middleware/    # Auth, error handling
│   │   └── utils/         # Token generation, validation
│   ├── migrations/        # SQL migrations
│   └── package.json
├── SETUP.md              # Setup instructions
└── README.md             # This file
```

### Running Locally

1. **Install git hooks** (prevents committing credentials):
   ```bash
   ./scripts/install-hooks.sh
   ```

2. Start backend:
   ```bash
   cd backend
   npm run dev
   ```

3. Load extension in Chrome (see Installation)

4. Test on YouTube videos

### Testing

Run the backend test script:
```bash
cd backend
./test-api.sh
```

Manual testing checklist:
- [ ] Create annotations
- [ ] Annotations persist after page refresh
- [ ] Share button creates shareable link
- [ ] Share link opens import modal
- [ ] View-only mode shows blue markers
- [ ] Merge combines annotations correctly
- [ ] Replace overwrites existing annotations
- [ ] Browse shows available shares
- [ ] Navigation between videos works

## Roadmap

### v1.0 (Current - MVP)
- [x] Local annotations with visual markers
- [x] Anonymous sharing via backend
- [x] Import/merge/replace functionality
- [x] Browse shares by video

### v2.0 (Planned)
- [ ] YouTube OAuth integration
- [ ] Voting/rating system for annotations
- [ ] User profiles and display names
- [ ] Comments on annotation sets

### v3.0 (Future)
- [ ] Video owner moderation
- [ ] Following system
- [ ] Trending annotations
- [ ] Full-text search
- [ ] Collections/playlists

See [PLAN.md](PLAN.md) for detailed future feature specifications.

## Security

- **Anonymous authentication**: No emails or passwords stored
- **Input validation**: All user input sanitized
- **Rate limiting**: Prevents spam and abuse
- **SQL injection protection**: Parameterized queries
- **CORS**: Restricted to extension origins
- **XSS prevention**: HTML escaping on all user content
- **Git hooks**: Pre-commit credential scanning prevents accidental leaks

### For Developers

**Important**: Install git hooks after cloning:
```bash
./scripts/install-hooks.sh
```

This installs a pre-commit hook that scans for exposed credentials (database URLs, API keys, passwords) before allowing commits. Prevents GitGuardian alerts and security incidents.

## Privacy

- **Local storage**: Your annotations are stored locally in your browser
- **Optional sharing**: You choose what to share
- **Anonymous by default**: No personal information required
- **No tracking**: We don't collect analytics or usage data

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/youtube-annotator/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/youtube-annotator/discussions)

## Acknowledgments

- Inspired by SoundCloud's comment system
- Built with Chrome Extension Manifest V3
- Backend powered by Node.js, Express, and PostgreSQL

---

**Made with ❤️ by the YouTube Annotator team**

*Star ⭐ this repo if you find it useful!*
