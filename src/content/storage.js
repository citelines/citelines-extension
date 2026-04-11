// Local storage and backend sync for annotations

import * as state from './state.js';
import { api } from './globals.js';
import { fetchAllAnnotations } from './fetchAnnotations.js';

// Get storage key for annotations (different for incognito mode)
export function getAnnotationsStorageKey(videoId) {
  const isIncognito = chrome.extension.inIncognitoContext;
  return isIncognito ? `annotations_incognito_${videoId}` : `annotations_${videoId}`;
}

// Load annotations from storage
export async function loadAnnotations(videoId) {
  return new Promise((resolve) => {
    const storageKey = getAnnotationsStorageKey(videoId);
    chrome.storage.local.get([storageKey], (result) => {
      resolve(result[storageKey] || []);
    });
  });
}

// Save annotations to storage and backend
export async function saveAnnotations(videoId, annotationsList) {
  // Save to local storage
  await new Promise((resolve) => {
    const storageKey = getAnnotationsStorageKey(videoId);
    chrome.storage.local.set({ [storageKey]: annotationsList }, resolve);
  });

  // Auto-save to backend (collaborative mode)
  try {
    if (annotationsList.length > 0) {
      await syncAnnotationsToBackend(videoId, annotationsList);
    }

    // Re-fetch all annotations to get updated data with correct ownership
    await fetchAllAnnotations(videoId);
  } catch (error) {
    console.error('Failed to sync annotations to backend:', error);

    // Handle suspension/ban errors
    if (error.suspended || error.banned) {
      const message = error.banned
        ? 'Your account has been suspended. Your citations will not be saved.'
        : `Your account is suspended until ${new Date(error.suspendedUntil).toLocaleDateString()}. Your citations will not be saved.`;

      alert(message);
    }
  }
}

// Sync user's annotations to backend
export async function syncAnnotationsToBackend(videoId, annotationsList) {
  const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

  if (state.userShareId) {
    // Update existing share
    await api.updateShare(state.userShareId, {
      annotations: annotationsList,
      title: videoTitle
    });
  } else {
    // Create new share
    const result = await api.createShare(videoId, annotationsList, videoTitle);
    state.setUserShareId(result.shareToken);
    console.log('Created share:', result.shareToken);
  }
}

// Save a bookmark (private annotation) to backend
export async function saveBookmark(videoId, text, timestamp) {
  const annotation = {
    id: Date.now().toString(),
    timestamp,
    text,
    citation: null,
    createdAt: new Date().toISOString()
  };

  const updatedBookmarks = [...state.bookmarkAnnotations, annotation];
  const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

  try {
    if (state.bookmarkShareId) {
      await api.updateShare(state.bookmarkShareId, {
        annotations: updatedBookmarks,
        title: videoTitle
      });
    } else {
      const result = await api.createShare(videoId, updatedBookmarks, videoTitle, false);
      state.setBookmarkShareId(result.shareToken);
    }
    state.setBookmarkAnnotations(updatedBookmarks);
    await fetchAllAnnotations(videoId);
  } catch (error) {
    console.error('Failed to save bookmark:', error);
    if (error.suspended || error.banned) {
      alert('Your account is suspended. Bookmarks will not be saved.');
    }
  }
}
