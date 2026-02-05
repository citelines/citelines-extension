# YouTube Annotator - Setup Guide

This guide will help you set up both the backend API and the Chrome extension with sharing features.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Chrome browser

## Part 1: Backend Setup

### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from [postgresql.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE youtube_annotator;

# Exit psql
\q
```

### 3. Configure Backend

Navigate to the backend directory:
```bash
cd backend
```

Install dependencies:
```bash
npm install
```

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
DATABASE_URL=postgresql://yourusername@localhost:5432/youtube_annotator
PORT=3000
NODE_ENV=development
CORS_ORIGINS=chrome-extension://
```

**Note:** Replace `yourusername` with your PostgreSQL username.

### 4. Run Migrations

```bash
npm run migrate
```

You should see:
```
✓ 001_create_users.sql completed successfully
✓ 002_create_shares.sql completed successfully
✓ 003_add_indexes.sql completed successfully
✓ All migrations completed successfully!
```

### 5. Start Backend Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### 6. Verify Backend

Test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 1.234,
  "environment": "development"
}
```

Test user registration:
```bash
curl -X POST http://localhost:3000/api/auth/register
```

Expected response:
```json
{
  "anonymousId": "abc123...",
  "userId": "uuid...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## Part 2: Chrome Extension Setup

### 1. Update API URL (for production)

If deploying to production, update the API URL in `api.js`:

```javascript
// Line 8 in api.js
this.baseUrl = 'https://your-production-url.com/api';
```

For local development, keep it as:
```javascript
this.baseUrl = 'http://localhost:3000/api';
```

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `youtube-annotator` folder
5. The extension should now appear in your extensions list

### 3. Verify Extension

1. Go to any YouTube video
2. You should see:
   - Red "+" button (bottom right) - Add annotations
   - Blue "Share" button (bottom right) - Share your annotations
   - Green "Browse" button (bottom right) - Browse shared annotations
3. Add an annotation by clicking the "+" button
4. A red dot marker should appear on the progress bar

### 4. Test Sharing Features

**Create a share:**
1. Add some annotations to a video
2. Click the "Share" button
3. Enter an optional title
4. Click "Create Share"
5. Copy the generated shareable link

**Import a share:**
1. Open the shareable link (or click "Browse" to find shares)
2. An import modal should appear
3. Choose:
   - **View Only**: See shared annotations without saving (blue markers)
   - **Merge with Mine**: Combine shared annotations with yours
   - **Replace Mine**: Replace your annotations with shared ones

## Part 3: Troubleshooting

### Backend Issues

**Connection refused:**
- Make sure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL in `.env`

**Migration errors:**
- Drop and recreate database:
  ```bash
  dropdb youtube_annotator
  createdb youtube_annotator
  npm run migrate
  ```

**CORS errors in browser console:**
- Make sure the extension is loaded in Chrome
- Check that CORS_ORIGINS in `.env` includes `chrome-extension://`

### Extension Issues

**Buttons don't appear:**
- Refresh the YouTube page
- Check browser console for errors (F12)
- Make sure backend is running

**API errors:**
- Open browser console (F12) and check for error messages
- Verify backend health: `curl http://localhost:3000/api/health`
- Check that `api.js` has the correct API URL

**Share link doesn't work:**
- Make sure the share token is in the URL: `?share=abc12345`
- Check browser console for errors
- Verify the share exists: `curl http://localhost:3000/api/shares/abc12345`

## Part 4: Development

### Running Tests

**Backend:**
```bash
cd backend

# Test user registration
curl -X POST http://localhost:3000/api/auth/register

# Save the anonymousId from response, then test creating a share
curl -X POST http://localhost:3000/api/shares \
  -H "Content-Type: application/json" \
  -H "X-Anonymous-ID: YOUR_ANONYMOUS_ID" \
  -d '{
    "videoId": "dQw4w9WgXcQ",
    "title": "Test annotations",
    "annotations": [
      {"timestamp": 30, "text": "Test annotation 1"},
      {"timestamp": 60, "text": "Test annotation 2"}
    ]
  }'

# Get share (replace TOKEN)
curl http://localhost:3000/api/shares/TOKEN
```

### Database Queries

Connect to database:
```bash
psql youtube_annotator
```

Useful queries:
```sql
-- View all users
SELECT * FROM users;

-- View all shares
SELECT id, share_token, video_id, title, view_count, created_at FROM shares;

-- View annotations for a share
SELECT annotations FROM shares WHERE share_token = 'abc12345';

-- Count shares by video
SELECT video_id, COUNT(*) FROM shares GROUP BY video_id;
```

## Part 5: Deployment

### Deploy Backend to Railway

1. Sign up at [railway.app](https://railway.app)
2. Create a new project
3. Add PostgreSQL database
4. Connect GitHub repository
5. Set environment variables:
   - `NODE_ENV=production`
   - `CORS_ORIGINS=chrome-extension://your-extension-id`
6. Deploy from `backend` directory
7. Copy the deployment URL

### Update Extension for Production

1. Update `api.js` with production URL:
   ```javascript
   this.baseUrl = 'https://your-railway-url.railway.app/api';
   ```

2. Remove localhost permission from `manifest.json`:
   ```json
   "host_permissions": [
     "https://www.youtube.com/*",
     "https://your-railway-url.railway.app/*"
   ]
   ```

3. Package extension:
   - Go to `chrome://extensions/`
   - Click "Pack extension"
   - Select the `youtube-annotator` folder

4. Submit to Chrome Web Store:
   - Create developer account at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
   - Upload packaged extension
   - Fill in listing details
   - Submit for review

## Next Steps

- **Test thoroughly**: Create, share, and import annotations on various videos
- **Monitor logs**: Check backend logs for errors
- **User feedback**: Share with friends and collect feedback
- **Future features**: See `PLAN.md` for planned enhancements (voting, YouTube OAuth, moderation, etc.)

## Support

For issues or questions:
- Check browser console (F12) for errors
- Check backend logs
- Review the plan document for architecture details
