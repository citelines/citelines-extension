// Marker creation, rendering, and ad observer

import * as state from './state.js';
import { authManager, analytics } from './globals.js';
import { showAnnotationPopup } from './popup.js';
import { updateSidebarContent } from './annotationsSidebar.js';

// Create marker element for an annotation
// markerType: 'own' | 'other' | 'creator'
export function createMarker(annotation, video, markerType = 'other') {
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
    if (typeof analytics !== 'undefined') analytics.track('citation_clicked', { videoId: state.currentVideoId, source: 'marker' });
    showAnnotationPopup(annotation, video, !annotation.isOwn);
  });

  return marker;
}

// Instantly update isOwn on cached annotations and re-render markers
// without waiting for a network call
export function refreshMarkerColors() {
  const currentUserId = authManager.getCurrentUser()?.id || null;
  state.setSharedAnnotations(state.sharedAnnotations.map(ann => ({
    ...ann,
    isOwn: currentUserId ? ann.creatorUserId === currentUserId : false
  })));
  renderMarkers();
}

// Render all markers
export function renderMarkers() {
  if (!state.markersContainer) return;

  const video = document.querySelector('video');
  if (!video) return;

  if (!video.duration || video.duration === 0) {
    // Retry when duration is available (handles ads and slow loading)
    const retryRender = () => {
      if (video.duration && video.duration > 0) {
        renderMarkers();
      }
    };

    video.addEventListener('durationchange', retryRender, { once: true });
    video.addEventListener('loadedmetadata', retryRender, { once: true });
    video.addEventListener('canplay', retryRender, { once: true });

    return;
  }

  // Check if an ad is currently playing using YouTube's own class
  const player = document.querySelector('.html5-video-player');
  if (player && player.classList.contains('ad-showing')) {
    startAdObserver();
    return;
  }

  // Clear existing markers
  state.markersContainer.innerHTML = '';
  if (state.creatorMarkersContainer) state.creatorMarkersContainer.innerHTML = '';

  // Render ALL annotations from sharedAnnotations (includes everyone's)
  state.sharedAnnotations.forEach((annotation) => {
    // Skip admin-deleted annotations (no marker on progress bar)
    if (annotation.adminDeleted) return;

    if (annotation.isCreatorCitation) {
      // Creator citations go in the upper orange row (regardless of ownership)
      if (state.creatorMarkersContainer) {
        const marker = createMarker(annotation, video, 'creator');
        state.creatorMarkersContainer.appendChild(marker);
      }
    } else {
      // Non-creator citations: teal if own, grey if others
      const markerType = annotation.isOwn ? 'own' : 'other';
      const marker = createMarker(annotation, video, markerType);
      state.markersContainer.appendChild(marker);
    }
  });

  const ownCount = state.sharedAnnotations.filter(a => a.isOwn).length;
  const sharedCount = state.sharedAnnotations.filter(a => !a.isOwn && !a.isCreatorCitation).length;
  const creatorCount = state.sharedAnnotations.filter(a => a.isCreatorCitation).length;
  console.log(`Rendered ${ownCount} own + ${sharedCount} shared + ${creatorCount} creator annotations`);

  // Update sidebar if it's open
  if (state.sidebarOpen && state.sidebar) {
    updateSidebarContent();
  }
}

// Watch for ads to finish so we can render markers with the real video duration
export function startAdObserver() {
  if (state.adObserver) return; // already watching
  const player = document.querySelector('.html5-video-player');
  if (!player) return;

  const observer = new MutationObserver(() => {
    if (!player.classList.contains('ad-showing')) {
      observer.disconnect();
      state.setAdObserver(null);
      // Small delay to let the real video duration settle
      setTimeout(() => renderMarkers(), 300);
    }
  });
  observer.observe(player, { attributes: true, attributeFilter: ['class'] });
  state.setAdObserver(observer);
}

// Create markers containers (viewer row + creator row)
export function createMarkersContainer() {
  if (state.markersContainer) return;

  const progressBar = document.querySelector('.ytp-progress-bar-container');
  if (!progressBar) return;

  // Viewer row (standard, markers at top: -10px via CSS)
  const mc = document.createElement('div');
  mc.className = 'yt-annotator-markers-container';
  progressBar.appendChild(mc);
  state.setMarkersContainer(mc);

  // Creator row (orange, markers at top: -24px)
  const cmc = document.createElement('div');
  cmc.className = 'yt-annotator-markers-container yt-annotator-creator-markers-container';
  progressBar.appendChild(cmc);
  state.setCreatorMarkersContainer(cmc);
}
