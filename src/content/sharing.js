// Share and browse buttons, import handling

import * as state from './state.js';
import { api, createShareButton, createBrowseButton, showShareModal, showBrowseModal, showImportModal } from './globals.js';
import { getVideoId } from './utils.js';
import { saveAnnotations } from './storage.js';
import { renderMarkers } from './markers.js';

// Create share and browse buttons
export function createShareButtons() {
  console.log('[YT Annotator] createShareButtons called');
  if (state.shareButton || state.browseButton) {
    console.log('[YT Annotator] Buttons already exist, skipping');
    return;
  }

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) {
    console.log('[YT Annotator] Player container not found');
    return;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'yt-annotator-share-container';
  buttonContainer.style.cssText = `
    position: absolute;
    bottom: 70px;
    right: 12px;
    display: flex;
    gap: 8px;
    z-index: 60;
  `;

  const sb = createShareButton();
  sb.addEventListener('click', async (e) => {
    e.stopPropagation();
    const videoId = getVideoId();
    const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';
    const annotationsList = state.annotations[videoId] || [];

    if (annotationsList.length === 0) {
      alert('No annotations to share! Add some annotations first.');
      return;
    }

    showShareModal(videoId, annotationsList, videoTitle, (result) => {
      console.log('Share created:', result);
    });
  });
  state.setShareButton(sb);

  const bb = createBrowseButton();
  bb.addEventListener('click', async (e) => {
    e.stopPropagation();
    const videoId = getVideoId();

    showBrowseModal(videoId, (shareData) => {
      handleImportShare(shareData);
    });
  });
  state.setBrowseButton(bb);

  buttonContainer.appendChild(sb);
  buttonContainer.appendChild(bb);
  playerContainer.appendChild(buttonContainer);
  console.log('[YT Annotator] Share and Browse buttons added successfully');
}

// Handle importing shared annotations
export async function handleImportShare(shareData) {
  const videoId = getVideoId();
  const localAnnotations = state.annotations[videoId] || [];

  showImportModal(shareData, localAnnotations, async (action, sharedAnns) => {
    if (action === 'view') {
      state.setViewOnlyAnnotations(sharedAnns.map((ann, index) => ({
        ...ann,
        id: `shared_${Date.now()}_${index}`
      })));
      renderMarkers();
      console.log('Viewing shared annotations (not saved)');
    } else if (action === 'merge') {
      const merged = [...localAnnotations];

      sharedAnns.forEach(sharedAnn => {
        const hasConflict = merged.some(local =>
          Math.abs(local.timestamp - sharedAnn.timestamp) < 1
        );

        if (!hasConflict) {
          merged.push({
            ...sharedAnn,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          });
        }
      });

      state.annotations[videoId] = merged;
      await saveAnnotations(videoId, merged);
      renderMarkers();
      console.log(`Merged ${merged.length - localAnnotations.length} new annotations`);
    } else if (action === 'replace') {
      const replaced = sharedAnns.map((ann, index) => ({
        ...ann,
        id: Date.now().toString() + index.toString()
      }));

      state.annotations[videoId] = replaced;
      await saveAnnotations(videoId, replaced);
      renderMarkers();
      console.log(`Replaced with ${replaced.length} shared annotations`);
    }
  });
}

// Check for share parameter in URL
export async function checkForShareLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');

  if (shareToken) {
    console.log('Share token detected:', shareToken);

    try {
      const shareData = await api.getShare(shareToken);
      console.log('Loaded share:', shareData);

      setTimeout(() => {
        handleImportShare(shareData);
      }, 2000);
    } catch (error) {
      console.error('Failed to load share:', error);
    }
  }
}
