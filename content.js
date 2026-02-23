// YouTube Annotator - Content Script

(function() {
  'use strict';

  let currentVideoId = null;
  let annotations = {}; // Local annotations (your own)
  let sharedAnnotations = []; // All annotations from all users
  let markersContainer = null;
  let creatorMarkersContainer = null;
  let addButton = null;
  let sidebarButton = null;
  let sidebar = null;
  let sidebarOpen = false;
  let sidebarFilter = 'all'; // 'all', 'mine', 'creator', 'others'
  let activePopup = null;
  let userShareId = null; // Your share ID for current video
  let loginButton = null; // Login/user badge button
  let loginUI = null; // Login UI instance
  let expiryWarning = null; // Expiry warning banner
  let accountSidebar = null;
  let accountSidebarOpen = false;
  let currentVideoChannelId = null; // Channel ID of the video being watched

  // Get video ID from URL
  function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  // Get the channel ID of the video being watched (for creator detection).
  // Content scripts run in an isolated JS world, so we delegate to the background
  // service worker which uses chrome.scripting.executeScript (world: MAIN) to
  // read ytInitialData from the page's actual JavaScript context.
  function getVideoChannelId() {
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
  // Used to switch the UI accent color from teal to orange ("creator mode").
  function isCreatorMode() {
    return !!(
      currentVideoChannelId &&
      authManager.isLoggedIn() &&
      authManager.getYouTubeChannelId() === currentVideoChannelId
    );
  }

  // Toggle .creator-mode CSS class on UI elements so the accent color
  // switches from teal to orange when viewing your own video as a creator.
  function updateCreatorMode() {
    const creatorMode = isCreatorMode();
    const elements = [addButton, sidebarButton, loginButton, sidebar, accountSidebar].filter(Boolean);
    elements.forEach(el => el.classList.toggle('creator-mode', creatorMode));
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

  // Get storage key for annotations (different for incognito mode)
  function getAnnotationsStorageKey(videoId) {
    const isIncognito = chrome.extension.inIncognitoContext;
    return isIncognito ? `annotations_incognito_${videoId}` : `annotations_${videoId}`;
  }

  // Load annotations from storage
  async function loadAnnotations(videoId) {
    return new Promise((resolve) => {
      const storageKey = getAnnotationsStorageKey(videoId);
      chrome.storage.local.get([storageKey], (result) => {
        resolve(result[storageKey] || []);
      });
    });
  }

  // Save annotations to storage and backend
  async function saveAnnotations(videoId, annotationsList) {
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

      // Handle suspension/block errors
      if (error.suspended || error.blocked) {
        const message = error.blocked
          ? 'Your account has been blocked. Your annotations will not be saved.'
          : `Your account is suspended until ${new Date(error.suspendedUntil).toLocaleDateString()}. Your annotations will not be saved.`;

        alert(message);

        // Note: Don't clear existing annotations - they should remain visible locally
        // The user just can't create new ones while suspended
      }
    }
  }

  // Sync user's annotations to backend
  async function syncAnnotationsToBackend(videoId, annotationsList) {
    const videoTitle = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent || 'YouTube Video';

    if (userShareId) {
      // Update existing share
      await api.updateShare(userShareId, {
        annotations: annotationsList,
        title: videoTitle
      });
    } else {
      // Create new share
      const result = await api.createShare(videoId, annotationsList, videoTitle);
      userShareId = result.shareToken;
      console.log('Created share:', result.shareToken);
    }
  }

  // Fetch all annotations from all users for current video.
  // Makes a single request to /api/shares/video/:videoId (which now includes
  // full annotation data and isOwner), parallelized with getVideoChannelId().
  async function fetchAllAnnotations(videoId) {
    try {
      // Fire shares request (+ channel ID if not already known)
      const channelIdPromise = currentVideoChannelId
        ? Promise.resolve(currentVideoChannelId)
        : getVideoChannelId();
      const [result, videoChannelId] = await Promise.all([
        api.getSharesForVideo(videoId),
        channelIdPromise
      ]);

      // Store for creator-mode detection (teal→orange UI accent)
      currentVideoChannelId = videoChannelId;

      sharedAnnotations = [];
      userShareId = null; // Re-discover from backend response each time

      for (const share of result.shares) {
        if (!share.annotations || !Array.isArray(share.annotations)) continue;

        const isOwn = share.isOwner || false;

        // If this is the user's share, sync local storage to match backend state
        if (isOwn && !userShareId) {
          userShareId = share.shareToken;
          const nonDeletedAnnotations = share.annotations.filter(ann => !ann.deleted_at);
          annotations[videoId] = nonDeletedAnnotations;
          const storageKey = getAnnotationsStorageKey(videoId);
          chrome.storage.local.set({ [storageKey]: nonDeletedAnnotations });
        }

        // isCreatorCitation: the share's creator is the video's YouTube channel owner.
        // This is an absolute property of the annotation — independent of who is viewing.
        const isCreatorCitation = !!(
          videoChannelId &&
          share.creatorYoutubeChannelId &&
          share.creatorYoutubeChannelId === videoChannelId
        );

        const mapped = share.annotations
          .filter(ann => !ann.deleted_at)
          .map(ann => ({
            ...ann,
            shareToken: share.shareToken,
            isOwn,
            creatorDisplayName: share.creatorDisplayName,
            creatorUserId: share.userId,
            isCreatorCitation
          }));

        sharedAnnotations.push(...mapped);
      }

      // No owned share found — clear stale local annotations from a previous account
      if (!userShareId) {
        annotations[videoId] = [];
        const storageKey = getAnnotationsStorageKey(videoId);
        chrome.storage.local.set({ [storageKey]: [] });
      }

      renderMarkers();
      updateCreatorMode();
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  }

  // Create marker element for an annotation
  // markerType: 'own' | 'other' | 'creator'
  function createMarker(annotation, video, markerType = 'other') {
    const marker = document.createElement('div');
    if (markerType === 'creator') {
      marker.className = 'yt-annotator-marker yt-annotator-marker-creator';
    } else if (markerType === 'other') {
      marker.className = 'yt-annotator-marker yt-annotator-marker-shared';
    } else {
      marker.className = 'yt-annotator-marker';
    }
    marker.dataset.annotationId = annotation.id;

    // Calculate position as percentage
    const percentage = (annotation.timestamp / video.duration) * 100;
    marker.style.left = `${percentage}%`;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      showAnnotationPopup(annotation, video, !annotation.isOwn);
    });

    return marker;
  }

  // Instantly update isOwn on cached annotations and re-render markers
  // without waiting for a network call
  function refreshMarkerColors() {
    const currentUserId = authManager.getCurrentUser()?.id || null;
    sharedAnnotations = sharedAnnotations.map(ann => ({
      ...ann,
      isOwn: currentUserId ? ann.creatorUserId === currentUserId : false
    }));
    renderMarkers();
  }

  // Render all markers
  function renderMarkers() {
    console.log(`[Markers] renderMarkers() called, sharedAnnotations count: ${sharedAnnotations.length}`);
    console.log('[Markers] Breakdown:', {
      own: sharedAnnotations.filter(a => a.isOwn).length,
      others: sharedAnnotations.filter(a => !a.isOwn).length
    });

    if (!markersContainer) {
      console.log('[Markers] No markers container, skipping render');
      return;
    }

    const video = document.querySelector('video');
    if (!video) {
      console.log('[Markers] Video element not found, skipping render');
      return;
    }

    if (!video.duration || video.duration === 0) {
      console.log('[Markers] Video duration not ready yet, waiting...');
      // Retry when duration is available (handles ads and slow loading)
      const retryRender = () => {
        if (video.duration && video.duration > 0) {
          console.log('[Markers] Video duration now available:', video.duration);
          renderMarkers();
        }
      };

      // Listen for multiple events to catch when video is ready
      video.addEventListener('durationchange', retryRender, { once: true });
      video.addEventListener('loadedmetadata', retryRender, { once: true });
      video.addEventListener('canplay', retryRender, { once: true });

      return;
    }

    // Check if we're in an ad by comparing duration to known ad lengths
    // Ads are usually 6s, 15s, 30s, or 60s exactly
    const isLikelyAd = video.duration && (
      Math.abs(video.duration - 6) < 0.1 ||
      Math.abs(video.duration - 15) < 0.1 ||
      Math.abs(video.duration - 30) < 0.1 ||
      Math.abs(video.duration - 60) < 0.1
    );

    if (isLikelyAd) {
      console.log(`[Markers] Detected possible ad (duration: ${video.duration}s), waiting for actual video...`);
      const adDuration = video.duration;
      let retryAttempted = false;

      // Wait for ad to finish and actual video to load
      const waitForActualVideo = () => {
        if (retryAttempted) return; // Only retry once
        retryAttempted = true;

        const newVideo = document.querySelector('video');
        // Check if duration has changed significantly (not just > 60s)
        if (newVideo && newVideo.duration && Math.abs(newVideo.duration - adDuration) > 1) {
          console.log(`[Markers] Actual video loaded after ad (new duration: ${newVideo.duration}s)`);
          renderMarkers();
        } else {
          console.log(`[Markers] Duration unchanged (${newVideo?.duration}s) - might be false positive, rendering anyway`);
          renderMarkers();
        }
      };

      video.addEventListener('ended', waitForActualVideo, { once: true });
      video.addEventListener('durationchange', waitForActualVideo, { once: true });

      // Fallback: if no event fires within 2 seconds, assume false positive and render
      setTimeout(() => {
        if (!retryAttempted) {
          console.log('[Markers] Ad detection timeout - rendering markers anyway');
          retryAttempted = true;
          renderMarkers();
        }
      }, 2000);

      return;
    }

    // Clear existing markers
    markersContainer.innerHTML = '';
    if (creatorMarkersContainer) creatorMarkersContainer.innerHTML = '';

    // Render ALL annotations from sharedAnnotations (includes everyone's)
    sharedAnnotations.forEach((annotation) => {
      if (annotation.isCreatorCitation) {
        // Creator citations go in the upper orange row (regardless of ownership)
        if (creatorMarkersContainer) {
          const marker = createMarker(annotation, video, 'creator');
          creatorMarkersContainer.appendChild(marker);
        }
      } else {
        // Non-creator citations: teal if own, grey if others
        const markerType = annotation.isOwn ? 'own' : 'other';
        const marker = createMarker(annotation, video, markerType);
        markersContainer.appendChild(marker);
      }
    });

    const ownCount = sharedAnnotations.filter(a => a.isOwn).length;
    const sharedCount = sharedAnnotations.filter(a => !a.isOwn && !a.isCreatorCitation).length;
    const creatorCount = sharedAnnotations.filter(a => a.isCreatorCitation).length;
    console.log(`Rendered ${ownCount} own + ${sharedCount} shared + ${creatorCount} creator annotations`);

    // Update sidebar if it's open
    if (sidebarOpen && sidebar) {
      updateSidebarContent();
    }
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
  function formatCitation(citation, isOwn = true) {
    if (!citation || !citation.type) return '';

    const ownershipClass = isOwn ? '' : ' other';
    let html = `<div class="yt-annotator-citation${ownershipClass}">`;

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
    // Remove connector line if it exists
    const connector = document.querySelector('.yt-annotator-popup-connector');
    if (connector) {
      connector.remove();
    }
  }

  // Position popup near the marker on the progress bar
  function positionPopupNearMarker(popup, annotation, video) {
    try {
      if (!video || !video.duration) {
        console.log('[Positioning] No video or duration');
        return;
      }

      // Calculate marker position as percentage
      const percentage = (annotation.timestamp / video.duration) * 100;

      // Get the progress bar and player container
      const progressBar = document.querySelector('.ytp-progress-bar-container');
      const playerContainer = document.querySelector('#movie_player');

      if (!progressBar || !playerContainer) {
        console.log('[Positioning] Missing progress bar or player container');
        return;
      }

      const progressBarRect = progressBar.getBoundingClientRect();
      const playerRect = playerContainer.getBoundingClientRect();

      // Calculate marker absolute position on the progress bar
      const markerAbsoluteX = progressBarRect.left + (percentage / 100) * progressBarRect.width;

      // Get popup dimensions
      const popupWidth = popup.offsetWidth;

      // Constrain popup to middle 40% of video window (30% to 70%)
      const playerWidth = playerRect.width;
      const minConstraint = playerWidth * 0.30;
      const maxConstraint = playerWidth * 0.70;

      // Calculate ideal popup position (centered on marker, relative to player)
      const markerRelativeToPlayer = markerAbsoluteX - playerRect.left;
      let popupLeft = markerRelativeToPlayer - (popupWidth / 2);

      // Clamp to middle 40% zone
      const popupMinLeft = minConstraint - (popupWidth / 2);
      const popupMaxLeft = maxConstraint - (popupWidth / 2);
      popupLeft = Math.max(popupMinLeft, Math.min(popupLeft, popupMaxLeft));

      // Position popup
      popup.style.left = `${popupLeft}px`;
      popup.style.transform = 'none';

      console.log('[Positioning] Popup positioned at', popupLeft);
      console.log('[Positioning] Marker absolute X:', markerAbsoluteX);
      console.log('[Positioning] Marker relative to player:', markerRelativeToPlayer);

      // Wait for next frame to get accurate popup position
      requestAnimationFrame(() => {
        try {
          const popupRect = popup.getBoundingClientRect();
          const playerRect = playerContainer.getBoundingClientRect();

          // Create connector line
          const connector = document.createElement('div');
          connector.className = 'yt-annotator-popup-connector';

          // Calculate connector geometry
          // Connector starts at popup's bottom edge (top: 100% in CSS)
          const popupBottom = popupRect.bottom;
          // Markers are positioned at top: -4px, so their top edge is 4px above progress bar
          const markerTop = progressBarRect.top - 4;
          const totalHeight = Math.abs(markerTop - popupBottom);

          console.log('[Connector] Total height:', totalHeight);
          console.log('[Positions] Popup left:', popupRect.left, 'width:', popupRect.width);
          console.log('[Positions] Player left:', playerRect.left);
          console.log('[Positions] Marker absolute X:', markerAbsoluteX);
          console.log('[Positions] Progress bar left:', progressBarRect.left, 'width:', progressBarRect.width);

          // Only show connector if there's a reasonable gap
          if (totalHeight >= 10) {
            // Calculate positions relative to popup's border box
            // Connector container has left: 0, so it starts at popup's left edge
            const popupBorderWidth = popup.offsetWidth;
            const popupCenterX = popupBorderWidth / 2;

            // Marker position relative to popup's border box (left edge)
            const markerXRelativeToPopup = markerAbsoluteX - popupRect.left;
            const horizontalOffset = markerXRelativeToPopup - popupCenterX;

            console.log('[Calc] Popup border width:', popupBorderWidth);
            console.log('[Calc] Popup center X (border box):', popupCenterX);
            console.log('[Calc] Marker X relative to popup:', markerXRelativeToPopup);
            console.log('[Calc] Horizontal offset:', horizontalOffset);

            // Elbow at 30% down from popup
            const elbowHeight = totalHeight * 0.3;
            const remainingHeight = totalHeight - elbowHeight;

            // Calculate horizontal line position
            // Extend by 1px on each side to overlap with vertical lines (2px total)
            const horizontalWidth = Math.abs(horizontalOffset) + 2;
            const horizontalLeft = Math.min(markerXRelativeToPopup, popupCenterX) - 1;

            // Connector color matches marker color
            const connectorColor = annotation.isCreatorCitation ? '#ffaa3e'
              : annotation.isOwn ? '#0497a6'
              : '#888888';

            // Create three line segments
            const verticalTop = document.createElement('div');
            verticalTop.className = 'yt-annotator-connector-vertical-top';
            verticalTop.style.cssText = `
              position: absolute;
              top: 0;
              left: ${popupCenterX}px;
              transform: translateX(-50%);
              width: 2px;
              height: ${elbowHeight + 1}px;
              background: ${connectorColor};
            `;

            const horizontal = document.createElement('div');
            horizontal.className = 'yt-annotator-connector-horizontal';
            horizontal.style.cssText = `
              position: absolute;
              top: ${elbowHeight}px;
              left: ${horizontalLeft}px;
              width: ${horizontalWidth}px;
              height: 2px;
              background: ${connectorColor};
            `;

            const verticalBottom = document.createElement('div');
            verticalBottom.className = 'yt-annotator-connector-vertical-bottom';
            verticalBottom.style.cssText = `
              position: absolute;
              top: ${elbowHeight}px;
              left: ${markerXRelativeToPopup}px;
              transform: translateX(-50%);
              width: 2px;
              height: ${remainingHeight}px;
              background: ${connectorColor};
            `;

            connector.appendChild(verticalTop);
            connector.appendChild(horizontal);
            connector.appendChild(verticalBottom);

            // Set connector height
            connector.style.height = `${totalHeight}px`;

            popup.appendChild(connector);
            console.log('[Connector] Added segments:', {elbowHeight, horizontalOffset, remainingHeight});
          } else {
            console.log('[Connector] Height too small:', totalHeight);
          }
        } catch (err) {
          console.error('[Connector] Error:', err);
        }
      });
    } catch (error) {
      console.error('[Positioning] Error:', error);
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

    // Show creator's display name for all annotations
    const creatorName = annotation.creatorDisplayName || 'Anonymous';
    let badge;
    if (annotation.isCreatorCitation) {
      // Creator citations always get orange badge; "(YOU)" added if it's also the viewer's own
      const ownSuffix = !isShared ? ' (YOU)' : '';
      badge = `<span style="background: #ffaa3e; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px;">Creator${ownSuffix} - ${escapeHtml(creatorName)}</span>`;
    } else if (!isShared) {
      // Own non-creator annotation — teal badge
      badge = `<span style="background: #0497a6; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px; border: 2px solid #3a3a3a;">YOU - ${escapeHtml(creatorName)}</span>`;
    } else {
      badge = `<span style="background: #3a3a3a; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">${escapeHtml(creatorName)}</span>`;
    }

    const citationHTML = formatCitation(annotation.citation, !isShared);
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

    // Badge click handler - show user profile
    const badgeElement = popup.querySelector('.yt-annotator-popup-header span');
    if (badgeElement && annotation.creatorUserId) {
      badgeElement.style.cursor = 'pointer';
      badgeElement.addEventListener('click', (e) => {
        e.stopPropagation();
        const userProfileUI = new UserProfileUI();
        userProfileUI.show(annotation.creatorUserId, annotation.creatorDisplayName || 'User', annotation.isOwn);
      });
    }

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
            const storageKey = getAnnotationsStorageKey(videoId);
            await chrome.storage.local.set({ [storageKey]: updatedAnnotations });

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

    // Position popup near the marker
    positionPopupNearMarker(popup, annotation, video);
  }

  // Show popup for creating new annotation
  function showCreatePopup(timestamp, video) {
    closePopup();

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    const popup = document.createElement('div');
    popup.className = 'yt-annotator-popup yt-annotator-popup-create' + (isCreatorMode() ? ' creator-mode' : '');

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

      const saveBtn = popup.querySelector('[data-action="save"]');
      if (saveBtn.disabled) return; // Prevent double-submission

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

      // Disable button and show saving state to prevent double-submission
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

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

        // Always remove the annotation from local state on failure — prevents
        // duplicates if the user retries after an error
        annotations[videoId] = annotations[videoId].filter(ann => ann.id !== newAnnotation.id);
        const storageKey = getAnnotationsStorageKey(videoId);
        await new Promise((resolve) => {
          chrome.storage.local.set({ [storageKey]: annotations[videoId] }, resolve);
        });

        if (error.suspended || error.blocked) {
          const message = error.blocked
            ? 'Your account has been blocked. You cannot create annotations.'
            : `Your account is suspended until ${new Date(error.suspendedUntil).toLocaleDateString()}. You cannot create annotations.`;
          alert(message);
        } else {
          // Re-enable button so user can retry
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          alert('Failed to save annotation. Please try again.');
        }
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

  // Get initials from a display name (max 2)
  function getInitials(displayName) {
    const words = displayName.trim().split(/\s+/);
    return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  // Populate the login button based on current auth state
  function updateLoginButton() {
    if (!loginButton) return;
    const sidebarWasOpen = loginButton.classList.contains('sidebar-open');

    if (authManager.isLoggedIn()) {
      const user = authManager.getCurrentUser();
      const initials = getInitials(user.displayName);
      loginButton.className = 'yt-annotator-user-badge';
      loginButton.innerHTML = `<span class="yt-annotator-user-initials">${escapeHtml(initials)}</span>`;
      loginButton.title = `Logged in as ${user.displayName} - Click to logout`;
    } else {
      loginButton.className = 'yt-annotator-login-btn';
      loginButton.innerHTML = '👤';
      loginButton.title = 'Sign in or create account';
    }

    if (sidebarWasOpen) loginButton.classList.add('sidebar-open');
  }

  // Create the login/user button shell immediately, populate after auth init
  function createLoginButton() {
    if (loginButton) return;

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    loginButton = document.createElement('button');
    loginButton.className = 'yt-annotator-user-badge';
    loginButton.innerHTML = '';
    loginButton.title = 'Loading...';

    loginButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLoginButtonClick();
    });

    playerContainer.appendChild(loginButton);
  }

  // Create the account sidebar
  function createAccountSidebar() {
    if (accountSidebar) return;

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    accountSidebar = document.createElement('div');
    accountSidebar.className = 'yt-annotator-account-sidebar';

    // Prevent YouTube from intercepting keystrokes typed in the sidebar
    accountSidebar.addEventListener('keydown', (e) => e.stopPropagation());
    accountSidebar.addEventListener('keypress', (e) => e.stopPropagation());
    accountSidebar.addEventListener('keyup', (e) => e.stopPropagation());

    playerContainer.appendChild(accountSidebar);
  }

  /**
   * Show merge confirmation dialog in the account sidebar.
   * Called when /youtube/connect detects a separate YouTube account.
   */
  function showMergeConfirmation(mergeData, sidebar) {
    const body = sidebar.querySelector('.yt-annotator-account-sidebar-body');
    if (!body) return;

    const name = mergeData.secondaryDisplayName || 'YouTube account';
    const count = mergeData.secondaryShareCount || 0;

    const mergeHtml = `
      <div class="yt-annotator-merge-prompt">
        <p style="color:#ccc; font-size:0.85rem; line-height:1.5; margin:0.75rem 0;">
          Your YouTube channel is already linked to another account
          (<strong style="color:#fff;">${escapeHtml(name)}</strong>) with
          <strong style="color:#fff;">${count}</strong> citation${count !== 1 ? 's' : ''}.
          Merge into this account?
        </p>
        <div style="display:flex; gap:8px; margin-top:0.75rem;">
          <button class="yt-annotator-merge-confirm"
            style="flex:1; background:#0497a6; color:#000; border:none; border-radius:6px;
                   padding:8px 12px; font-size:0.82rem; font-weight:600; cursor:pointer;">
            Merge Accounts
          </button>
          <button class="yt-annotator-merge-cancel"
            style="flex:1; background:transparent; color:#aaa; border:1px solid #555;
                   border-radius:6px; padding:8px 12px; font-size:0.82rem; cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>
    `;

    // Replace the connect button with the merge prompt
    const connectBtn = body.querySelector('.yt-annotator-connect-yt-btn');
    if (connectBtn) {
      connectBtn.insertAdjacentHTML('afterend', mergeHtml);
      connectBtn.remove();
    } else {
      body.insertAdjacentHTML('beforeend', mergeHtml);
    }

    body.querySelector('.yt-annotator-merge-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      updateAccountSidebarContent();
    });

    body.querySelector('.yt-annotator-merge-confirm').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target;
      btn.textContent = 'Merging...';
      btn.disabled = true;

      try {
        await authManager.mergeWithYouTube(mergeData._accessToken);
        updateAccountSidebarContent();
        if (currentVideoId) fetchAllAnnotations(currentVideoId);
      } catch (err) {
        console.error('[Auth] Merge failed:', err);
        btn.textContent = 'Merge failed';
        btn.style.background = '#f44336';
        btn.style.color = '#fff';
        setTimeout(() => updateAccountSidebarContent(), 2000);
      }
    });
  }

  // Populate account sidebar based on auth state
  function updateAccountSidebarContent() {
    if (!accountSidebar) return;

    if (authManager.isLoggedIn()) {
      const user = authManager.getCurrentUser();
      const initials = getInitials(user.displayName);

      const ytVerified = authManager.isYouTubeVerified();
      const ytTitle = user.youtubeChannelTitle || '';
      const ytSection = ytVerified
        ? `<div class="yt-annotator-yt-status">&#10003; YouTube: ${escapeHtml(ytTitle)}</div>`
        : `<button class="yt-annotator-connect-yt-btn">Verify as YouTube Creator</button>`;

      accountSidebar.innerHTML = `
        <div class="yt-annotator-sidebar-header">
          <h3>Account</h3>
          <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
        </div>
        <div class="yt-annotator-account-sidebar-body">
          <div class="yt-annotator-account-avatar">${escapeHtml(initials)}</div>
          <div class="yt-annotator-account-name">${escapeHtml(user.displayName)}</div>
          <div class="yt-annotator-account-email">${escapeHtml(user.email || '')}</div>
          ${ytSection}
          <div class="yt-annotator-account-stats">
            <div class="yt-annotator-account-stats-joined">Contributor since —</div>
            <div class="yt-annotator-account-stats-row">
              <div class="yt-annotator-account-stat"><span class="yt-annotator-account-stat-num">—</span> Citations</div>
              <div class="yt-annotator-account-stat"><span class="yt-annotator-account-stat-num">—</span> Videos</div>
            </div>
          </div>
          <button class="yt-annotator-account-signout">Sign Out</button>
        </div>
      `;

      accountSidebar.querySelector('.yt-annotator-account-signout').addEventListener('click', async (e) => {
        e.stopPropagation();
        await authManager.logout();
        userShareId = null; // Clear stale share token so anonymous session starts fresh
        toggleAccountSidebar();
        updateLoginButton();
        refreshMarkerColors(); // Instant visual update
        updateCreatorMode();   // Switch accent back to teal
        if (currentVideoId) fetchAllAnnotations(currentVideoId); // Background refresh
      });

      // Fetch and populate usage stats
      const userId = user.id;
      if (userId) {
        fetch(`https://youtube-annotator-production.up.railway.app/api/users/${userId}/profile`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(profile => {
            const joinedEl = accountSidebar?.querySelector('.yt-annotator-account-stats-joined');
            const statNums = accountSidebar?.querySelectorAll('.yt-annotator-account-stat-num');
            if (joinedEl && profile.accountCreated) {
              const d = new Date(profile.accountCreated);
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              joinedEl.textContent = `Contributor since ${months[d.getMonth()]} ${d.getFullYear()}`;
            }
            if (statNums && statNums.length >= 2) {
              statNums[0].textContent = profile.totalAnnotations ?? 0;
              statNums[1].textContent = profile.uniqueVideos ?? 0;
            }
          })
          .catch(() => {}); // silently fail — stats are non-critical
      }

      if (!ytVerified) {
        accountSidebar.querySelector('.yt-annotator-connect-yt-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const result = await connectYouTubeChannel(api, authManager, (msg) => {
              const statusEl = accountSidebar.querySelector('.yt-annotator-connect-yt-btn');
              if (statusEl) statusEl.textContent = msg;
            });

            // If a merge is needed, show confirmation dialog
            if (result.needsMerge) {
              showMergeConfirmation(result, accountSidebar);
              return;
            }

            // Refresh sidebar to show verified state
            updateAccountSidebarContent();
            // Re-fetch annotations to update creator markers
            if (currentVideoId) fetchAllAnnotations(currentVideoId);
          } catch (err) {
            console.error('[Auth] YouTube connect failed:', err);
            const btn = accountSidebar.querySelector('.yt-annotator-connect-yt-btn');
            if (btn) btn.textContent = 'Connect YouTube Channel';
            alert(err.message || 'Failed to connect YouTube channel');
          }
        });
      }
    } else {
      accountSidebar.innerHTML = `
        <div class="yt-annotator-sidebar-header">
          <h3>Account</h3>
          <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
        </div>
        <div class="yt-annotator-account-auth-body"></div>
      `;

      if (!loginUI) {
        loginUI = new LoginUI(authManager, handleLoginSuccess, toggleAccountSidebar);
      }
      loginUI.show(accountSidebar.querySelector('.yt-annotator-account-auth-body'), 'login');
    }

    accountSidebar.querySelector('.yt-annotator-sidebar-close').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleAccountSidebar();
    });
  }

  // Toggle the account sidebar open/closed
  function toggleAccountSidebar() {
    // Close bibliography sidebar if open
    if (sidebarOpen) toggleSidebar();

    accountSidebarOpen = !accountSidebarOpen;

    if (accountSidebarOpen) {
      createAccountSidebar();
      updateAccountSidebarContent();
      if (isCreatorMode()) accountSidebar.classList.add('creator-mode');
      accountSidebar.classList.add('yt-annotator-sidebar-open');
      if (addButton) addButton.classList.add('sidebar-open');
      if (sidebarButton) sidebarButton.classList.add('sidebar-open');
      if (loginButton) loginButton.classList.add('sidebar-open');
    } else {
      if (accountSidebar) accountSidebar.classList.remove('yt-annotator-sidebar-open');
      if (addButton) addButton.classList.remove('sidebar-open');
      if (sidebarButton) sidebarButton.classList.remove('sidebar-open');
      if (loginButton) loginButton.classList.remove('sidebar-open');
    }
  }

  // Handle login button click — always opens the account sidebar
  function handleLoginButtonClick() {
    toggleAccountSidebar();
  }

  // Handle successful login
  async function handleLoginSuccess() {
    console.log('[Auth] Login successful, refreshing UI...');

    updateLoginButton();
    refreshMarkerColors(); // Instant visual update
    updateCreatorMode();   // Switch accent to orange if on own video
    if (accountSidebarOpen) toggleAccountSidebar();
    if (currentVideoId) fetchAllAnnotations(currentVideoId); // Background refresh

    // Re-fetch annotations to update ownership
    if (currentVideoId) {
      await fetchAllAnnotations(currentVideoId);
    }
  }

  // Check and show expiry warning if needed
  async function checkExpiryWarning() {
    if (authManager.isLoggedIn()) {
      // No warning for logged-in users
      return;
    }

    try {
      const expiryInfo = await authManager.getExpiryInfo();
      if (expiryInfo && expiryInfo.daysUntilExpiry !== null && expiryInfo.daysUntilExpiry <= 10) {
        showExpiryWarning(expiryInfo.daysUntilExpiry);
      }
    } catch (error) {
      console.error('[Auth] Failed to check expiry:', error);
    }
  }

  // Show expiry warning banner
  function showExpiryWarning(daysLeft) {
    if (expiryWarning) return; // Already showing

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    expiryWarning = document.createElement('div');
    expiryWarning.className = 'yt-annotator-expiry-warning';
    expiryWarning.innerHTML = `
      <div class="yt-annotator-expiry-warning-text">
        ⚠️ Your account expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.
        Create an account to preserve your citations permanently.
      </div>
      <button>Sign Up</button>
    `;

    expiryWarning.querySelector('button').addEventListener('click', () => {
      if (!loginUI) {
        loginUI = new LoginUI(authManager, handleLoginSuccess);
      }
      loginUI.show('register');
    });

    playerContainer.appendChild(expiryWarning);
  }

  // Create the sidebar toggle button
  function createSidebarButton() {
    if (sidebarButton) return;

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    sidebarButton = document.createElement('button');
    sidebarButton.className = 'yt-annotator-sidebar-btn';
    sidebarButton.innerHTML = '≡';
    sidebarButton.title = 'View all annotations';

    sidebarButton.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    playerContainer.appendChild(sidebarButton);
  }

  // Toggle sidebar open/closed
  function toggleSidebar() {
    // Close account sidebar if open
    if (accountSidebarOpen) {
      accountSidebarOpen = false;
      if (accountSidebar) accountSidebar.classList.remove('yt-annotator-sidebar-open');
    }

    sidebarOpen = !sidebarOpen;
    if (sidebarOpen) {
      if (!sidebar) {
        createSidebar();
      }
      sidebar.classList.add('yt-annotator-sidebar-open');
      if (isCreatorMode()) sidebar.classList.add('creator-mode');
      updateSidebarContent();

      // Move buttons to the left when sidebar opens
      if (addButton) addButton.classList.add('sidebar-open');
      if (sidebarButton) sidebarButton.classList.add('sidebar-open');
      if (loginButton) loginButton.classList.add('sidebar-open');
    } else {
      if (sidebar) {
        sidebar.classList.remove('yt-annotator-sidebar-open');
      }

      // Move buttons back when sidebar closes
      if (addButton) addButton.classList.remove('sidebar-open');
      if (sidebarButton) sidebarButton.classList.remove('sidebar-open');
      if (loginButton) loginButton.classList.remove('sidebar-open');
    }
  }

  // Create the sidebar panel
  function createSidebar() {
    if (sidebar) return;

    const playerContainer = document.querySelector('#movie_player');
    if (!playerContainer) return;

    sidebar = document.createElement('div');
    sidebar.className = 'yt-annotator-sidebar';

    sidebar.innerHTML = `
      <div class="yt-annotator-sidebar-header">
        <h3>Citations</h3>
        <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
      </div>
      <div class="yt-annotator-sidebar-filters">
        <button class="yt-annotator-filter-btn active" data-filter="all">All</button>
        <button class="yt-annotator-filter-btn" data-filter="mine">Mine</button>
        <button class="yt-annotator-filter-btn" data-filter="creator">Creator</button>
        <button class="yt-annotator-filter-btn" data-filter="others">Others</button>
      </div>
      <div class="yt-annotator-sidebar-count"></div>
      <div class="yt-annotator-sidebar-content"></div>
    `;

    // Close button
    sidebar.querySelector('.yt-annotator-sidebar-close').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    // Filter buttons
    sidebar.querySelectorAll('.yt-annotator-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filter = btn.dataset.filter;
        sidebarFilter = filter;

        // Update active state
        sidebar.querySelectorAll('.yt-annotator-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        updateSidebarContent();
      });
    });

    playerContainer.appendChild(sidebar);
  }

  // Update sidebar content with annotations
  function updateSidebarContent() {
    if (!sidebar) return;

    const contentDiv = sidebar.querySelector('.yt-annotator-sidebar-content');
    const countDiv = sidebar.querySelector('.yt-annotator-sidebar-count');

    // Filter annotations based on selected filter
    let filtered = sharedAnnotations;
    if (sidebarFilter === 'mine') {
      filtered = sharedAnnotations.filter(a => a.isOwn);
    } else if (sidebarFilter === 'creator') {
      filtered = sharedAnnotations.filter(a => a.isCreatorCitation);
    } else if (sidebarFilter === 'others') {
      filtered = sharedAnnotations.filter(a => !a.isOwn && !a.isCreatorCitation);
    }

    // Sort by timestamp
    filtered = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

    // Update count
    countDiv.textContent = `${filtered.length} annotation${filtered.length !== 1 ? 's' : ''}`;

    // Generate list HTML
    if (filtered.length === 0) {
      contentDiv.innerHTML = '<div class="yt-annotator-sidebar-empty">No annotations yet</div>';
      return;
    }

    const listHTML = filtered.map(annotation => {
      const citationPreview = annotation.citation ?
        `<div class="yt-annotator-sidebar-citation">
          ${annotation.citation.type === 'youtube' ? '🎥' : annotation.citation.type === 'movie' ? '🎬' : '📄'}
          ${escapeHtml(annotation.citation.title || '')}
        </div>` : '';

      const textPreview = annotation.text ?
        `<div class="yt-annotator-sidebar-text">${escapeHtml(annotation.text.substring(0, 100))}${annotation.text.length > 100 ? '...' : ''}</div>` : '';

      const ownerClass = annotation.isCreatorCitation ? 'creator-citation' : (annotation.isOwn ? 'own' : 'other');
      const creatorName = annotation.creatorDisplayName || 'Anonymous';
      let ownerBadge;
      if (annotation.isCreatorCitation) {
        // Creator citations always get orange badge; "(YOU)" added if also own
        const ownSuffix = annotation.isOwn ? ' (YOU)' : '';
        ownerBadge = `<span class="yt-annotator-sidebar-badge creator">Creator${ownSuffix} - ${escapeHtml(creatorName)}</span>`;
      } else if (annotation.isOwn) {
        ownerBadge = `<span class="yt-annotator-sidebar-badge own">YOU - ${escapeHtml(creatorName)}</span>`;
      } else {
        ownerBadge = `<span class="yt-annotator-sidebar-badge other">${escapeHtml(creatorName)}</span>`;
      }

      return `
        <div class="yt-annotator-sidebar-item ${ownerClass}" data-timestamp="${annotation.timestamp}">
          <div class="yt-annotator-sidebar-item-header">
            <span class="yt-annotator-sidebar-time">${formatTime(annotation.timestamp)}</span>
            ${ownerBadge}
          </div>
          ${citationPreview}
          ${textPreview}
        </div>
      `;
    }).join('');

    contentDiv.innerHTML = listHTML;

    // Add click handlers to show annotation popup
    contentDiv.querySelectorAll('.yt-annotator-sidebar-item').forEach((item, index) => {
      const annotation = filtered[index];

      // Click on item (but not badge) shows popup
      item.addEventListener('click', (e) => {
        // Don't show popup if clicking on badge
        if (e.target.classList.contains('yt-annotator-sidebar-badge')) {
          return;
        }
        e.stopPropagation();
        const video = document.querySelector('video');
        if (video && annotation) {
          showAnnotationPopup(annotation, video, !annotation.isOwn);
        }
      });

      // Click on badge shows user profile
      const badge = item.querySelector('.yt-annotator-sidebar-badge');
      if (badge && annotation.creatorUserId) {
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          const userProfileUI = new UserProfileUI();
          userProfileUI.show(annotation.creatorUserId, annotation.creatorDisplayName || 'User', annotation.isOwn);
        });
      }
    });
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

  // Create markers containers (viewer row + creator row)
  function createMarkersContainer() {
    if (markersContainer) return;

    // Find the progress bar
    const progressBar = document.querySelector('.ytp-progress-bar-container');
    if (!progressBar) return;

    // Viewer row (standard, markers at top: -10px via CSS)
    markersContainer = document.createElement('div');
    markersContainer.className = 'yt-annotator-markers-container';
    progressBar.appendChild(markersContainer);

    // Creator row (orange, markers at top: -24px)
    creatorMarkersContainer = document.createElement('div');
    creatorMarkersContainer.className = 'yt-annotator-markers-container yt-annotator-creator-markers-container';
    progressBar.appendChild(creatorMarkersContainer);
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
      currentVideoChannelId = null; // Reset until fetched for new video
    }

    createMarkersContainer();
    createAddButton();
    createSidebarButton();
    createLoginButton(); // Show empty circle immediately
    updateCreatorMode(); // Apply teal/orange based on current video's channel

    // Run auth init, API init, and channel ID fetch in parallel
    const [authReady, , channelIdResult] = await Promise.allSettled([
      authManager.initialize(),
      api.initialize(),
      getVideoChannelId()
    ]);

    // Apply creator mode as early as possible (before annotations load)
    if (channelIdResult.status === 'fulfilled' && channelIdResult.value) {
      currentVideoChannelId = channelIdResult.value;
      updateCreatorMode();
    }

    // Wire up auth and update UI
    api.setAuthManager(authManager);
    updateLoginButton();
    checkExpiryWarning();
    if (authReady.status === 'rejected') {
      console.error('[Auth] Failed to initialize:', authReady.reason);
    }

    // Fetch annotations now that auth is set on the API
    try {
      await fetchAllAnnotations(videoId);
    } catch (err) {
      console.error('Failed to fetch annotations:', err);
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
        console.log('[YT Annotator] Navigation detected:', url);

        // Reset UI elements for new page
        console.log('[Navigation] Cleaning up UI elements');

        // Remove all DOM elements
        if (markersContainer) {
          markersContainer.remove();
          markersContainer = null;
        }
        if (creatorMarkersContainer) {
          creatorMarkersContainer.remove();
          creatorMarkersContainer = null;
        }
        if (addButton) {
          addButton.remove();
          addButton = null;
        }
        if (sidebarButton) {
          sidebarButton.remove();
          sidebarButton = null;
        }
        if (loginButton) {
          loginButton.remove();
          loginButton = null;
        }
        if (sidebar) {
          sidebar.remove();
          sidebar = null;
        }
        if (expiryWarning) {
          expiryWarning.remove();
          expiryWarning = null;
        }

        // Reset state
        sidebarOpen = false;
        sharedAnnotations = [];
        userShareId = null;
        currentVideoChannelId = null;
        initialized = false;
        closePopup();

        // Disconnect previous observer if exists
        if (playerObserver) {
          playerObserver.disconnect();
          playerObserver = null;
        }

        // Wait for new video player to be ready
        waitForPlayer();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // ESC key closes the sidebar (or account sidebar)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sidebarOpen) toggleSidebar();
      else if (accountSidebarOpen) toggleAccountSidebar();
    }
  });

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
