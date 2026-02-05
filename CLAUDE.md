# YouTube Annotator

A Chrome extension that lets users add timestamped annotations to YouTube videos, similar to SoundCloud's comment markers on the playback bar.

## Project Structure

```
youtube-annotator/
├── manifest.json      # Chrome extension manifest (V3)
├── content.js         # Main logic - injected into YouTube pages
├── content.css        # Styling for markers and popups
└── icons/
    └── placeholder_icon.png
```

## Current Features

- **Add annotations**: Click the red + button to create an annotation at the current timestamp
- **View annotations**: Red dot markers appear on the progress bar; click to view
- **Go to timestamp**: Jump to the annotation's position in the video
- **Delete annotations**: Remove annotations you no longer need
- **Local persistence**: Annotations stored in chrome.storage.local
- **SPA navigation**: Works when navigating between videos without page reload

## Technical Notes

- Uses MutationObserver to detect when YouTube player is ready
- Keyboard events (spacebar, etc.) are intercepted in the textarea to prevent YouTube from capturing them
- Markers are positioned as percentage of video duration on `.ytp-progress-bar-container`
- Popup is appended to `#movie_player` container

## Development

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder
4. Navigate to any YouTube video

## Next Task

Build a backend so users can share annotations with each other. Decisions needed:
- Backend tech: Node.js/Express, Python/FastAPI, or Firebase/Supabase
- Auth: Anonymous or user accounts

## Future Plans

- **Sharing**: Backend to share annotations with other users who have the extension
- **Multi-browser**: Support Firefox and other browsers
- **Edit annotations**: Modify existing annotation text
- **Export/import**: Backup and restore annotations
