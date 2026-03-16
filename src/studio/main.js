// Main entry point / orchestrator for the Studio content script

import * as state from './state.js';
import { api, authManager, analytics } from './globals.js';
import { fetchOwnCitations } from './storage.js';
import { createSidebar, removeSidebar } from './sidebar.js';
import { renderStudioMarkers } from './markers.js';

console.log('[Citelines Studio] Content script loaded');

// Extract video ID from Studio URL path: /video/VIDEO_ID/edit
function getVideoIdFromUrl() {
  const match = window.location.pathname.match(/^\/video\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Initialize for a specific video
async function initialize(videoId) {
  if (state.initialized && state.currentVideoId === videoId) return;

  console.log('[Citelines Studio] Initializing for video:', videoId);
  state.setCurrentVideoId(videoId);
  state.setInitialized(true);

  // Init auth + API in parallel
  try {
    await Promise.allSettled([
      authManager.initialize(),
      api.initialize()
    ]);
    api.setAuthManager(authManager);
  } catch (err) {
    console.error('[Citelines Studio] Auth/API init failed:', err);
  }

  if (analytics) analytics.track('studio_viewed', { videoId });

  // Fetch own citations if logged in
  if (authManager.isLoggedIn()) {
    try {
      await fetchOwnCitations(videoId);
    } catch (err) {
      console.error('[Citelines Studio] Failed to fetch citations:', err);
    }
  }

  // Create sidebar (handles auth gate internally)
  createSidebar(videoId);
  renderStudioMarkers();
}

// Cleanup when leaving a video page
function cleanup() {
  removeSidebar();
  if (state.markersContainer) {
    state.markersContainer.remove();
    state.setMarkersContainer(null);
  }
  state.setCurrentVideoId(null);
  state.setUserShareToken(null);
  state.setAnnotations([]);
  state.setInitialized(false);
}

// Handle SPA navigation
function handleNavigation() {
  let lastUrl = location.href;

  const observer = new MutationObserver(() => {
    const url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;

    console.log('[Citelines Studio] Navigation detected:', url);

    const videoId = getVideoIdFromUrl();
    if (videoId && videoId !== state.currentVideoId) {
      cleanup();
      initialize(videoId);
    } else if (!videoId && state.currentVideoId) {
      cleanup();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  state.setNavObserver(observer);
}

// Start
const videoId = getVideoIdFromUrl();
if (videoId) {
  // Wait a tick for globals (api.js, auth.js) to initialize on window
  setTimeout(() => initialize(videoId), 100);
} else {
  console.log('[Citelines Studio] Not a video edit page, waiting for navigation...');
}
handleNavigation();
