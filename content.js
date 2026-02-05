// YouTube Annotator - Content Script

(function() {
  'use strict';

  let currentVideoId = null;
  let annotations = {}; // Local annotations (your own)
  let sharedAnnotations = []; // All annotations from all users
  let markersContainer = null;
  let addButton = null;
  let activePopup = null;
  let userShareId = null; // Your share ID for current video

  // Get video ID from URL
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // Format seconds to MM:SS or HH:MM:SS
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load annotations from storage
  async function loadAnnotations(videoId) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`annotations_${videoId}`], (result) => {
        resolve(result[`annotations_${videoId}`] || []);
      });
    });
  }

  // Save annotations to storage and backend
  async function saveAnnotations(videoId, annotationsList) {
    // Save to local storage
    await new Promise((resolve) => {
      chrome.storage.local.set({ [`annotations_${videoId}`]: annotationsList }, resolve);
    });

    // Auto-save to backend (collaborative mode)
    try {
      if (annotationsList.length > 0) {
        await syncAnnotationsToBackend(videoId, annotationsList);
      }
    } catch (error) {
      console.error('Failed to sync annotations to backend:', error);
    }
  }

  // Sync user's annotations to backend
  async function syncAnnotationsToBackend(videoId, annotationsList) {
    const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

    if (userShareId) {
      // Update existing share
      await api.updateShare(userShareId, {
        annotations: annotationsList,
        title: `${videoTitle} - Annotations`
      });
    } else {
      // Create new share
      const result = await api.createShare(videoId, annotationsList, `${videoTitle} - Annotations`);
      userShareId = result.shareToken;
      console.log('Created share:', result.shareToken);
    }
  }

  // Fetch all annotations from all users for current video
  async function fetchAllAnnotations(videoId) {
    try {
      const result = await api.getSharesForVideo(videoId);
      sharedAnnotations = []; // Clear existing shared annotations

      // Fetch all share details in parallel
      const shareFetches = result.shares.map(share =>
        api.getShare(share.shareToken)
          .then(shareData => {
            if (shareData.annotations && Array.isArray(shareData.annotations)) {
              // Use backend's isOwner field to determine ownership
              const isOwn = shareData.isOwner || false;

              return shareData.annotations.map(ann => ({
                ...ann,
                shareToken: share.shareToken,
                isOwn: isOwn
              }));
            }
            return [];
          })
          .catch(err => {
            console.error('Failed to fetch share:', err);
            return [];
          })
      );

      // Wait for all fetches to complete
      const allAnnotations = await Promise.all(shareFetches);

      // Flatten the array of arrays into sharedAnnotations
      sharedAnnotations = allAnnotations.flat();

      console.log(`Loaded ${result.shares.length} shares with ${sharedAnnotations.length} total annotations for video ${videoId}`);

      // Render once after all annotations are loaded
      renderMarkers();
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  }

  // Create marker element for an annotation
  function createMarker(annotation, video, isViewOnly = false) {
    const marker = document.createElement('div');
    marker.className = isViewOnly ? 'yt-annotator-marker yt-annotator-marker-shared' : 'yt-annotator-marker';
    marker.dataset.annotationId = annotation.id;

    // Calculate position as percentage
    const percentage = (annotation.timestamp / video.duration) * 100;
    marker.style.left = `${percentage}%`;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      showAnnotationPopup(annotation, video, isViewOnly);
    });

    return marker;
  }

  // Render all markers
  function renderMarkers() {
    if (!markersContainer) return;

    const video = document.querySelector('video');
    if (!video || !video.duration) return;

    // Clear existing markers
    markersContainer.innerHTML = '';

    const videoId = getVideoId();

    // Render ALL annotations from sharedAnnotations (includes everyone's)
    // Use isOwn flag to determine color
    sharedAnnotations.forEach((annotation) => {
      const isShared = !annotation.isOwn; // Blue if not yours, red if yours
      const marker = createMarker(annotation, video, isShared);
      markersContainer.appendChild(marker);
    });

    const ownCount = sharedAnnotations.filter(a => a.isOwn).length;
    const sharedCount = sharedAnnotations.filter(a => !a.isOwn).length;
    console.log(`Rendered ${ownCount} own + ${sharedCount} shared annotations`);
  }

  // Close any open popup
  function closePopup() {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  }

  // Show popup for viewing/editing annotation
  function showAnnotationPopup(annotation, video, isShared = false) {
    closePopup();

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    const popup = document.createElement('div');
    popup.className = 'yt-annotator-popup';

    const deleteButton = isShared ? '' : '<button class="yt-annotator-btn yt-annotator-btn-danger" data-action="delete">Delete</button>';
    const badge = isShared ? '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">OTHER USER</span>' : '<span style="background: #ff6b6b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">YOU</span>';

    popup.innerHTML = `
      <div class="yt-annotator-popup-header">
        <span class="yt-annotator-popup-timestamp">${formatTime(annotation.timestamp)}${badge}</span>
        <button class="yt-annotator-popup-close">&times;</button>
      </div>
      <div class="yt-annotator-popup-content">${escapeHtml(annotation.text)}</div>
      <div class="yt-annotator-popup-actions">
        ${deleteButton}
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="goto">Go to</button>
      </div>
    `;

    // Event listeners
    popup.querySelector('.yt-annotator-popup-close').addEventListener('click', closePopup);

    if (!isShared) {
      popup.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const videoId = getVideoId();
        annotations[videoId] = (annotations[videoId] || []).filter(a => a.id !== annotation.id);
        await saveAnnotations(videoId, annotations[videoId]);
        renderMarkers();
        closePopup();
      });
    }

    popup.querySelector('[data-action="goto"]').addEventListener('click', () => {
      video.currentTime = annotation.timestamp;
      closePopup();
    });

    playerContainer.appendChild(popup);
    activePopup = popup;
  }

  // Show popup for creating new annotation
  function showCreatePopup(timestamp, video) {
    closePopup();

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    const popup = document.createElement('div');
    popup.className = 'yt-annotator-popup';

    popup.innerHTML = `
      <div class="yt-annotator-popup-header">
        <span class="yt-annotator-popup-timestamp">New annotation at ${formatTime(timestamp)}</span>
        <button class="yt-annotator-popup-close">&times;</button>
      </div>
      <textarea class="yt-annotator-popup-input" placeholder="Enter your annotation..."></textarea>
      <div class="yt-annotator-popup-actions">
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
        <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save">Save</button>
      </div>
    `;

    const textarea = popup.querySelector('textarea');

    // Stop keyboard events from reaching YouTube player
    textarea.addEventListener('keydown', (e) => e.stopPropagation());
    textarea.addEventListener('keyup', (e) => e.stopPropagation());
    textarea.addEventListener('keypress', (e) => e.stopPropagation());

    popup.querySelector('.yt-annotator-popup-close').addEventListener('click', closePopup);
    popup.querySelector('[data-action="cancel"]').addEventListener('click', closePopup);

    popup.querySelector('[data-action="save"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) return;

      const videoId = getVideoId();
      const newAnnotation = {
        id: Date.now().toString(),
        timestamp: timestamp,
        text: text,
        createdAt: new Date().toISOString()
      };

      if (!annotations[videoId]) {
        annotations[videoId] = [];
      }
      annotations[videoId].push(newAnnotation);
      await saveAnnotations(videoId, annotations[videoId]);
      renderMarkers();
      closePopup();
    });

    playerContainer.appendChild(popup);
    activePopup = popup;

    // Focus textarea
    setTimeout(() => textarea.focus(), 0);
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Create the add annotation button
  function createAddButton() {
    if (addButton) return;

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    addButton = document.createElement('button');
    addButton.className = 'yt-annotator-add-btn';
    addButton.innerHTML = '+';
    addButton.title = 'Add annotation at current time';

    addButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const video = document.querySelector('video');
      if (video) {
        showCreatePopup(video.currentTime, video);
      }
    });

    playerContainer.appendChild(addButton);
  }

  // Create share and browse buttons
  function createShareButtons() {
    console.log('[YT Annotator] createShareButtons called');
    if (shareButton || browseButton) {
      console.log('[YT Annotator] Buttons already exist, skipping');
      return;
    }

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) {
      console.log('[YT Annotator] Player container not found');
      return;
    }
    console.log('[YT Annotator] Creating share buttons...');

    // Create container for share buttons
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

    // Share button
    console.log('[YT Annotator] createShareButton exists:', typeof createShareButton !== 'undefined');
    shareButton = createShareButton();
    shareButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const videoId = getVideoId();
      const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';
      const annotationsList = annotations[videoId] || [];

      if (annotationsList.length === 0) {
        alert('No annotations to share! Add some annotations first.');
        return;
      }

      showShareModal(videoId, annotationsList, videoTitle, (result) => {
        console.log('Share created:', result);
      });
    });

    // Browse button
    browseButton = createBrowseButton();
    browseButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const videoId = getVideoId();

      showBrowseModal(videoId, (shareData) => {
        handleImportShare(shareData);
      });
    });

    buttonContainer.appendChild(shareButton);
    buttonContainer.appendChild(browseButton);
    playerContainer.appendChild(buttonContainer);
    console.log('[YT Annotator] Share and Browse buttons added successfully');
  }

  // Handle importing shared annotations
  async function handleImportShare(shareData) {
    const videoId = getVideoId();
    const localAnnotations = annotations[videoId] || [];

    showImportModal(shareData, localAnnotations, async (action, sharedAnnotations) => {
      if (action === 'view') {
        // View only mode - store in temporary array
        viewOnlyAnnotations = sharedAnnotations.map((ann, index) => ({
          ...ann,
          id: `shared_${Date.now()}_${index}` // Give unique IDs
        }));
        renderMarkers();
        console.log('Viewing shared annotations (not saved)');
      } else if (action === 'merge') {
        // Merge with local annotations
        const merged = [...localAnnotations];

        // Add shared annotations that don't conflict (within 1 second)
        sharedAnnotations.forEach(sharedAnn => {
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

        annotations[videoId] = merged;
        await saveAnnotations(videoId, merged);
        renderMarkers();
        console.log(`Merged ${merged.length - localAnnotations.length} new annotations`);
      } else if (action === 'replace') {
        // Replace local annotations
        const replaced = sharedAnnotations.map((ann, index) => ({
          ...ann,
          id: Date.now().toString() + index.toString()
        }));

        annotations[videoId] = replaced;
        await saveAnnotations(videoId, replaced);
        renderMarkers();
        console.log(`Replaced with ${replaced.length} shared annotations`);
      }
    });
  }

  // Check for share parameter in URL
  async function checkForShareLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareToken = urlParams.get('share');

    if (shareToken) {
      console.log('Share token detected:', shareToken);

      try {
        // Fetch shared annotations
        const shareData = await api.getShare(shareToken);
        console.log('Loaded share:', shareData);

        // Show import modal after short delay to let page load
        setTimeout(() => {
          handleImportShare(shareData);
        }, 2000);
      } catch (error) {
        console.error('Failed to load share:', error);
        // Optionally show error notification
      }
    }
  }

  // Create markers container
  function createMarkersContainer() {
    if (markersContainer) return;

    // Find the progress bar
    const progressBar = document.querySelector('.ytp-progress-bar-container');
    if (!progressBar) return;

    markersContainer = document.createElement('div');
    markersContainer.className = 'yt-annotator-markers-container';
    progressBar.appendChild(markersContainer);
  }

  // Initialize the extension for current video
  async function initialize() {
    const videoId = getVideoId();
    if (!videoId) return;

    // Check if video changed
    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      annotations[videoId] = await loadAnnotations(videoId);
      sharedAnnotations = []; // Clear shared annotations
      userShareId = null; // Reset share ID for new video
    }

    createMarkersContainer();
    createAddButton();
    renderMarkers();

    // Initialize API and fetch all annotations
    try {
      await api.initialize();
      console.log('API initialized');

      // Fetch all annotations from all users for this video
      await fetchAllAnnotations(videoId);
    } catch (err) {
      console.error('Failed to initialize API:', err);
    }
  }

  // Wait for YouTube player to be ready
  let playerObserver = null;
  let initialized = false;

  function waitForPlayer() {
    playerObserver = new MutationObserver((mutations, obs) => {
      if (initialized) return;

      const player = document.querySelector('#movie_player');
      const video = document.querySelector('video');

      if (player && video) {
        // Initialize when video metadata is loaded
        if (video.readyState >= 1) {
          initialized = true;
          obs.disconnect();
          initialize();
        } else {
          video.addEventListener('loadedmetadata', () => {
            if (!initialized) {
              initialized = true;
              obs.disconnect();
              initialize();
            }
          }, { once: true });
        }
      }
    });

    playerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try immediately
    const player = document.querySelector('#movie_player');
    const video = document.querySelector('video');
    if (player && video && video.readyState >= 1) {
      initialized = true;
      if (playerObserver) playerObserver.disconnect();
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
        // Reset UI elements for new page
        markersContainer = null;
        addButton = null;
        sharedAnnotations = [];
        userShareId = null;
        initialized = false;
        closePopup();

        // Re-initialize after short delay
        setTimeout(() => {
          const player = document.querySelector('#movie_player');
          const video = document.querySelector('video');
          if (player && video && video.readyState >= 1) {
            initialized = true;
            initialize();
          }
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (activePopup && !activePopup.contains(e.target)) {
      closePopup();
    }
  });

  // Start
  waitForPlayer();
  handleNavigation();
})();
