# Quick Start Guide

Get the YouTube Annotator up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL installed and running
- Chrome browser

## 1. Database Setup (1 minute)

```bash
# Create database
createdb youtube_annotator
```

## 2. Backend Setup (2 minutes)

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env (change username to yours)
# DATABASE_URL=postgresql://yourusername@localhost:5432/youtube_annotator

# Run migrations
npm run migrate

# Start server
npm start
```

You should see:
```
YouTube Annotator API server running on port 3000
```

## 3. Load Extension (1 minute)

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `youtube-annotator` folder
5. Extension loaded! ✅

## 4. Test It Out (1 minute)

1. Open any YouTube video
2. You should see three buttons on the video player:
   - Red "**+**" button (add annotation)
   - Blue "**Share**" button (share your annotations)
   - Green "**Browse**" button (see shared annotations)

3. Try it:
   - Click the **+** button
   - Type something
   - Click Save
   - See a red dot appear on the progress bar ✅

4. Share it:
   - Click the **Share** button
   - Add a title (optional)
   - Click "Create Share"
   - Copy the link and open it in a new tab
   - Import modal appears! ✅

## Troubleshooting

**Backend won't start?**
```bash
# Check PostgreSQL is running
pg_isready

# Check database exists
psql -l | grep youtube_annotator
```

**Extension not loading?**
- Make sure backend is running: `curl http://localhost:3000/api/health`
- Check Chrome console (F12) for errors
- Refresh the YouTube page

**Share button does nothing?**
- Add some annotations first (click the + button)
- Check backend logs for errors

## Quick Test Script

Test the backend API:
```bash
cd backend
chmod +x test-api.sh
./test-api.sh
```

This will:
1. Register a test user
2. Create a test share
3. Fetch the share
4. Show you the shareable URL

## What's Next?

- Read [README.md](README.md) for full feature list
- See [SETUP.md](SETUP.md) for deployment guide
- Check [CLAUDE.md](CLAUDE.md) for architecture details

## Need Help?

- Check browser console (F12) for errors
- Check backend logs in terminal
- Review the setup guide: [SETUP.md](SETUP.md)

---

**That's it! You're ready to annotate and share!** 🎉
