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

      // Re-fetch all annotations to get updated data with correct ownership
      await fetchAllAnnotations(videoId);
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
            // Debug: Log the share data to see what backend returns
            console.log(`[DEBUG] Share ${share.shareToken}:`, {
              isOwner: shareData.isOwner,
              annotationCount: shareData.annotations?.length
            });

            if (shareData.annotations && Array.isArray(shareData.annotations)) {
              // Use backend's isOwner field to determine ownership
              const isOwn = shareData.isOwner || false;

              // If this is the user's share, store the token to avoid creating duplicates
              if (isOwn && !userShareId) {
                userShareId = share.shareToken;
                console.log('[DEBUG] Found user share:', userShareId);
              }

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

  // Format date string
  function formatDate(citation) {
    if (!citation.month && !citation.day && !citation.year) return '';

    const parts = [];
    if (citation.month) parts.push(citation.month);
    if (citation.day) parts.push(citation.day);
    if (citation.year) parts.push(citation.year);

    return parts.join(' ');
  }

  // Format creation timestamp for display
  function formatCreationTime(isoString) {
    if (!isoString) return '';

    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      // Relative time for recent annotations
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

      // Absolute date for older annotations
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (e) {
      return '';
    }
  }

  // Format citation for display
  function formatCitation(citation) {
    if (!citation || !citation.type) return '';

    let html = '<div class="yt-annotator-citation">';

    switch(citation.type) {
      case 'youtube':
        html += '<div class="yt-annotator-citation-icon">🎥</div>';
        html += '<div class="yt-annotator-citation-content">';
        if (citation.url) {
          html += `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="yt-annotator-citation-title">${escapeHtml(citation.title || 'YouTube Video')}</a>`;
        } else {
          html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || 'YouTube Video')}</span>`;
        }
        const youtubeDate = formatDate(citation);
        if (youtubeDate) {
          html += `<div class="yt-annotator-citation-meta">${escapeHtml(youtubeDate)}</div>`;
        }
        html += '</div>';
        break;

      case 'movie':
        html += '<div class="yt-annotator-citation-icon">🎬</div>';
        html += '<div class="yt-annotator-citation-content">';
        html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || 'Movie')}</span>`;
        const movieMeta = [];
        if (citation.year) movieMeta.push(citation.year);
        if (citation.director) movieMeta.push(`dir. ${citation.director}`);
        if (movieMeta.length > 0) {
          html += `<div class="yt-annotator-citation-meta">${escapeHtml(movieMeta.join(' • '))}</div>`;
        }
        html += '</div>';
        break;

      case 'article':
        html += '<div class="yt-annotator-citation-icon">📄</div>';
        html += '<div class="yt-annotator-citation-content">';
        if (citation.url) {
          html += `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="yt-annotator-citation-title">${escapeHtml(citation.title || 'Article')}</a>`;
        } else {
          html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || 'Article')}</span>`;
        }
        const articleMeta = [];
        if (citation.author) articleMeta.push(`by ${citation.author}`);
        const articleDate = formatDate(citation);
        if (articleDate) articleMeta.push(articleDate);
        if (articleMeta.length > 0) {
          html += `<div class="yt-annotator-citation-meta">${escapeHtml(articleMeta.join(' • '))}</div>`;
        }
        html += '</div>';
        break;
    }

    html += '</div>';
    return html;
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
    const badge = isShared ? '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">OTHER USER</span>' : '<span style="background: #00d9ff; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px;">YOU</span>';

    const citationHTML = formatCitation(annotation.citation);
    const creationTime = formatCreationTime(annotation.createdAt);
    const creationTimeHTML = creationTime ? `<div class="yt-annotator-creation-time">Created ${creationTime}</div>` : '';

    popup.innerHTML = `
      <div class="yt-annotator-popup-header">
        <span class="yt-annotator-popup-timestamp">${formatTime(annotation.timestamp)}${badge}</span>
        <button class="yt-annotator-popup-close">&times;</button>
      </div>
      ${citationHTML}
      <div class="yt-annotator-popup-content">${escapeHtml(annotation.text)}</div>
      ${creationTimeHTML}
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

        // Find the user's share and remove this annotation from it
        const shareToken = annotation.shareToken;
        if (shareToken) {
          try {
            // Get current share data
            const shareData = await api.getShare(shareToken);

            // Filter out the deleted annotation
            const updatedAnnotations = shareData.annotations.filter(a => a.id !== annotation.id);

            if (updatedAnnotations.length === 0) {
              // If no annotations left, delete the entire share
              await api.deleteShare(shareToken);
            } else {
              // Update the share with remaining annotations
              await api.updateShare(shareToken, { annotations: updatedAnnotations });
            }

            // Update local storage
            annotations[videoId] = updatedAnnotations;
            await chrome.storage.local.set({ [`annotations_${videoId}`]: updatedAnnotations });

            // Re-fetch all annotations to update display
            await fetchAllAnnotations(videoId);
          } catch (error) {
            console.error('Failed to delete annotation:', error);
          }
        }

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
    popup.className = 'yt-annotator-popup yt-annotator-popup-create';

    popup.innerHTML = `
      <div class="yt-annotator-popup-header">
        <span class="yt-annotator-popup-timestamp">New annotation at ${formatTime(timestamp)}</span>
        <button class="yt-annotator-popup-close">&times;</button>
      </div>

      <div class="yt-annotator-citation-type">
        <label for="citation-type">Citation Type:</label>
        <select id="citation-type" class="yt-annotator-select">
          <option value="note">Basic Note</option>
          <option value="youtube">YouTube Video</option>
          <option value="movie">Movie</option>
          <option value="article">Article</option>
        </select>
      </div>

      <div id="citation-fields" class="yt-annotator-citation-fields">
        <!-- Dynamic fields will be inserted here -->
      </div>

      <textarea class="yt-annotator-popup-input" placeholder="Your note or comment..."></textarea>

      <div class="yt-annotator-popup-actions">
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
        <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save">Save</button>
      </div>
    `;

    const textarea = popup.querySelector('textarea');
    const citationTypeSelect = popup.querySelector('#citation-type');
    const citationFields = popup.querySelector('#citation-fields');

    // Function to update citation fields based on selected type
    function updateCitationFields(type) {
      let fieldsHTML = '';

      switch(type) {
        case 'youtube':
          fieldsHTML = `
            <input type="text" class="yt-annotator-input" id="citation-title" placeholder="Video Title" />
            <input type="url" class="yt-annotator-input" id="citation-url" placeholder="YouTube URL" />
            <div style="display: flex; gap: 8px;">
              <input type="text" class="yt-annotator-input" id="citation-month" placeholder="Month" style="flex: 1;" />
              <input type="text" class="yt-annotator-input" id="citation-day" placeholder="Day" style="flex: 1;" />
              <input type="text" class="yt-annotator-input" id="citation-year" placeholder="Year" style="flex: 1;" />
            </div>
          `;
          break;
        case 'movie':
          fieldsHTML = `
            <input type="text" class="yt-annotator-input" id="citation-title" placeholder="Movie Title" />
            <div style="display: flex; gap: 8px;">
              <input type="text" class="yt-annotator-input" id="citation-year" placeholder="Year" style="flex: 1;" />
              <input type="text" class="yt-annotator-input" id="citation-director" placeholder="Director (optional)" style="flex: 2;" />
            </div>
          `;
          break;
        case 'article':
          fieldsHTML = `
            <input type="text" class="yt-annotator-input" id="citation-title" placeholder="Article Title" />
            <input type="url" class="yt-annotator-input" id="citation-url" placeholder="Article URL" />
            <input type="text" class="yt-annotator-input" id="citation-author" placeholder="Author (optional)" />
            <div style="display: flex; gap: 8px;">
              <input type="text" class="yt-annotator-input" id="citation-month" placeholder="Month" style="flex: 1;" />
              <input type="text" class="yt-annotator-input" id="citation-day" placeholder="Day" style="flex: 1;" />
              <input type="text" class="yt-annotator-input" id="citation-year" placeholder="Year" style="flex: 1;" />
            </div>
          `;
          break;
        case 'note':
        default:
          fieldsHTML = '';
          break;
      }

      citationFields.innerHTML = fieldsHTML;

      // Stop keyboard events for all inputs
      citationFields.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', (e) => e.stopPropagation());
        input.addEventListener('keyup', (e) => e.stopPropagation());
        input.addEventListener('keypress', (e) => e.stopPropagation());
      });
    }

    // Initialize with note type (no fields)
    updateCitationFields('note');

    // Update fields when type changes
    citationTypeSelect.addEventListener('change', (e) => {
      updateCitationFields(e.target.value);
    });

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
      const citationType = citationTypeSelect.value;

      // Build citation object based on type
      let citation = null;
      if (citationType !== 'note') {
        citation = { type: citationType };

        const titleInput = popup.querySelector('#citation-title');
        const urlInput = popup.querySelector('#citation-url');
        const yearInput = popup.querySelector('#citation-year');
        const monthInput = popup.querySelector('#citation-month');
        const dayInput = popup.querySelector('#citation-day');
        const directorInput = popup.querySelector('#citation-director');
        const authorInput = popup.querySelector('#citation-author');

        if (titleInput) citation.title = titleInput.value.trim();
        if (urlInput) citation.url = urlInput.value.trim();
        if (yearInput) citation.year = yearInput.value.trim();
        if (monthInput) citation.month = monthInput.value.trim();
        if (dayInput) citation.day = dayInput.value.trim();
        if (directorInput) citation.director = directorInput.value.trim();
        if (authorInput) citation.author = authorInput.value.trim();

        // Validate: citation needs at least a title
        if (!citation.title) {
          alert('Please enter a title for the citation');
          return;
        }
      }

      // Require either text or citation
      if (!text && !citation) {
        alert('Please enter a note or add a citation');
        return;
      }

      const videoId = getVideoId();
      const newAnnotation = {
        id: Date.now().toString(),
        timestamp: timestamp,
        text: text,
        citation: citation,
        createdAt: new Date().toISOString()
      };

      if (!annotations[videoId]) {
        annotations[videoId] = [];
      }
      annotations[videoId].push(newAnnotation);

      try {
        await saveAnnotations(videoId, annotations[videoId]);
        renderMarkers();
        closePopup();
      } catch (error) {
        console.error('Failed to save annotation:', error);
        alert('Failed to save annotation. Please try again.');
      }
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

    // Initialize API and fetch all annotations
    try {
      await api.initialize();
      console.log('API initialized');

      // Fetch all annotations from all users for this video
      // renderMarkers() is called by fetchAllAnnotations() after data is loaded
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
