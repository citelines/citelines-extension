// Main entry point / orchestrator for the YouTube Annotator content script

import * as state from './state.js';
import { api, authManager, analytics } from './globals.js';
import { getVideoId } from './utils.js';
import { getVideoChannelId, updateCreatorMode } from './creatorMode.js';
import { loadAnnotations } from './storage.js';
import { createMarkersContainer } from './markers.js';
import { closePopup } from './popup.js';
import { showCreatePopup } from './createPopup.js';
import { createSidebarButton, toggleSidebar } from './annotationsSidebar.js';
import { createLoginButton, updateLoginButton, checkExpiryWarning, toggleAccountSidebar } from './accountSidebar.js';
import { fetchAllAnnotations } from './fetchAnnotations.js';

// Re-export so other modules that already import from main.js still work
export { fetchAllAnnotations };

// Create the add annotation button
function createAddButton() {
  if (state.addButton) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const btn = document.createElement('button');
  btn.className = 'yt-annotator-add-btn';
  btn.innerHTML = '+';
  btn.title = 'Add annotation at current time';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const video = document.querySelector('video');
    if (video) {
      showCreatePopup(video.currentTime, video);
    }
  });

  playerContainer.appendChild(btn);
  state.setAddButton(btn);
}

// Initialize the extension for current video
async function initialize() {
  const videoId = getVideoId();
  if (!videoId) return;

  if (videoId !== state.currentVideoId) {
    state.setCurrentVideoId(videoId);
    if (typeof analytics !== 'undefined') analytics.track('video_viewed', { videoId });
    state.annotations[videoId] = await loadAnnotations(videoId);
    state.setSharedAnnotations([]);
    state.setUserShareId(null);
    state.setBookmarkShareId(null);
    state.setBookmarkAnnotations([]);
    state.setCurrentVideoChannelId(null);
  }

  createMarkersContainer();
  createAddButton();
  createSidebarButton();
  createLoginButton();
  updateCreatorMode();

  const [authReady, , channelIdResult] = await Promise.allSettled([
    authManager.initialize(),
    api.initialize(),
    getVideoChannelId()
  ]);

  if (channelIdResult.status === 'fulfilled' && channelIdResult.value) {
    state.setCurrentVideoChannelId(channelIdResult.value);
    updateCreatorMode();
  }

  api.setAuthManager(authManager);
  updateLoginButton();
  checkExpiryWarning();
  if (authReady.status === 'rejected') {
    console.error('[Auth] Failed to initialize:', authReady.reason);
  }

  try {
    await fetchAllAnnotations(videoId);
  } catch (err) {
    console.error('Failed to fetch annotations:', err);
  }
}

// Wait for YouTube player to be ready
function waitForPlayer() {
  const observer = new MutationObserver((mutations, obs) => {
    if (state.initialized) return;

    const player = document.querySelector('#movie_player');
    const video = document.querySelector('video');

    if (player && video) {
      if (video.readyState >= 1) {
        state.setInitialized(true);
        obs.disconnect();
        initialize();
      } else {
        video.addEventListener('loadedmetadata', () => {
          if (!state.initialized) {
            state.setInitialized(true);
            obs.disconnect();
            initialize();
          }
        }, { once: true });
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  state.setPlayerObserver(observer);

  // Also try immediately
  const player = document.querySelector('#movie_player');
  const video = document.querySelector('video');
  if (player && video && video.readyState >= 1) {
    state.setInitialized(true);
    observer.disconnect();
    initialize();
  }
}

// Handle YouTube SPA navigation
function handleNavigation() {
  let lastUrl = location.href;

  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('[YT Annotator] Navigation detected:', url);

      // Remove all DOM elements
      if (state.markersContainer) {
        state.markersContainer.remove();
        state.setMarkersContainer(null);
      }
      if (state.creatorMarkersContainer) {
        state.creatorMarkersContainer.remove();
        state.setCreatorMarkersContainer(null);
      }
      if (state.citationTimeline) {
        state.citationTimeline.remove();
        state.setCitationTimeline(null);
        state.setTimelineCollapsed(false);
      }
      if (state.adObserver) {
        state.adObserver.disconnect();
        state.setAdObserver(null);
      }
      if (state.addButton) {
        state.addButton.remove();
        state.setAddButton(null);
      }
      if (state.sidebarButton) {
        state.sidebarButton.remove();
        state.setSidebarButton(null);
      }
      if (state.loginButton) {
        state.loginButton.remove();
        state.setLoginButton(null);
      }
      if (state.sidebar) {
        state.sidebar.remove();
        state.setSidebar(null);
      }
      if (state.expiryWarning) {
        state.expiryWarning.remove();
        state.setExpiryWarning(null);
      }

      // Reset state
      state.setSidebarOpen(false);
      state.setSharedAnnotations([]);
      state.setUserShareId(null);
      state.setBookmarkShareId(null);
      state.setBookmarkAnnotations([]);
      state.setCurrentVideoChannelId(null);
      state.setInitialized(false);
      closePopup();

      if (state.playerObserver) {
        state.playerObserver.disconnect();
        state.setPlayerObserver(null);
      }

      waitForPlayer();
    }
  }).observe(document, { subtree: true, childList: true });
}

// ESC key closes the sidebar (or account sidebar)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.sidebarOpen) toggleSidebar();
    else if (state.accountSidebarOpen) toggleAccountSidebar();
  }
});

// Close popup when clicking outside (but not during textarea resize drags)
let isResizing = false;
document.addEventListener('mousedown', (e) => {
  if (state.activePopup && state.activePopup.contains(e.target)) {
    isResizing = true;
  }
});
document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
  }
});
document.addEventListener('click', (e) => {
  if (isResizing) return;
  if (state.activePopup && !state.activePopup.contains(e.target)) {
    closePopup();
  }
});

// Close popup on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.activePopup) {
    closePopup();
  }
});

// Start
waitForPlayer();
handleNavigation();
