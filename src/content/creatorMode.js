// Creator mode detection and UI toggling

import * as state from './state.js';
import { authManager } from './globals.js';

// Get the channel ID of the video being watched.
// Delegates to background service worker which uses chrome.scripting.executeScript.
export function getVideoChannelId() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_CHANNEL_ID' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('[Creator] Could not get channel ID:', chrome.runtime.lastError.message);
        return resolve(null);
      }
      const id = response?.channelId || null;
      console.log('[Creator] Video channel ID:', id);
      resolve(id);
    });
  });
}

// True when the logged-in user is the YouTube creator of the current video.
export function isCreatorMode() {
  return !!(
    state.currentVideoChannelId &&
    authManager.isLoggedIn() &&
    authManager.getYouTubeChannelId() === state.currentVideoChannelId
  );
}

// Toggle .creator-mode CSS class on UI elements so the accent color
// switches from teal to orange when viewing your own video as a creator.
export function updateCreatorMode() {
  const creatorMode = isCreatorMode();
  const elements = [state.addButton, state.sidebarButton, state.loginButton, state.sidebar, state.accountSidebar].filter(Boolean);
  elements.forEach(el => el.classList.toggle('creator-mode', creatorMode));
}
