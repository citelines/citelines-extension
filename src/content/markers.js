// Multi-track citation timeline: lanes by citation type, vertical bar markers

import * as state from './state.js';
import { authManager, analytics } from './globals.js';
import { showAnnotationPopup } from './popup.js';
import { updateSidebarContent } from './annotationsSidebar.js';

// Lane definitions — order determines display order
const LANES = [
  { id: 'article',  label: 'Article',  icon: '\uD83D\uDCC4' },
  { id: 'youtube',  label: 'YouTube',  icon: '\u25B6' },
  { id: 'movie',    label: 'Movie',    icon: '\uD83C\uDF9E' },
  { id: 'book',     label: 'Book',     icon: '\uD83D\uDCD6' },
  { id: 'podcast',  label: 'Podcast',  icon: '\uD83C\uDF99' },
  { id: 'note',     label: 'Note',     icon: '\uD83D\uDCDD' },
];

// Get the lane id for an annotation based on its citation type
function getLaneId(annotation) {
  return annotation.citation?.type || 'note';
}

// Get marker color class based on ownership
function getMarkerClass(annotation) {
  if (annotation.isCreatorCitation) return 'creator';
  if (annotation.isOwn) return 'mine';
  return 'other';
}

// Instantly update isOwn on cached annotations and re-render markers
export function refreshMarkerColors() {
  const currentUserId = authManager.getCurrentUser()?.id || null;
  state.setSharedAnnotations(state.sharedAnnotations.map(ann => ({
    ...ann,
    isOwn: currentUserId ? ann.creatorUserId === currentUserId : false
  })));
  renderMarkers();
}

// Render the multi-track timeline
export function renderMarkers() {
  if (!state.citationTimeline) return;

  const video = document.querySelector('video');
  if (!video) return;

  if (!video.duration || video.duration === 0) {
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

  // Check if an ad is currently playing
  const player = document.querySelector('.html5-video-player');
  if (player && player.classList.contains('ad-showing')) {
    startAdObserver();
    return;
  }

  const annotations = state.sharedAnnotations.filter(a => !a.adminDeleted);

  // Group annotations by lane
  const laneAnnotations = {};
  for (const ann of annotations) {
    const laneId = getLaneId(ann);
    if (!laneAnnotations[laneId]) laneAnnotations[laneId] = [];
    laneAnnotations[laneId].push(ann);
  }

  // Only show lanes that have annotations
  const populatedLanes = LANES.filter(l => laneAnnotations[l.id]?.length > 0);

  // Also include any unknown lane ids (future citation types)
  const knownIds = new Set(LANES.map(l => l.id));
  for (const laneId of Object.keys(laneAnnotations)) {
    if (!knownIds.has(laneId)) {
      populatedLanes.push({ id: laneId, label: laneId.charAt(0).toUpperCase() + laneId.slice(1), icon: '\uD83D\uDCC4' });
    }
  }

  const tracksContainer = state.citationTimeline.querySelector('.citelines-tracks');
  const countEl = state.citationTimeline.querySelector('.citelines-count');
  console.log('[Citelines] renderMarkers: tracksContainer found?', !!tracksContainer, 'annotations:', annotations.length, 'lanes:', populatedLanes.map(l => l.id));
  if (!tracksContainer) return;

  tracksContainer.innerHTML = '';

  // If no annotations, hide the timeline entirely
  if (annotations.length === 0) {
    state.citationTimeline.style.display = 'none';
    return;
  }
  state.citationTimeline.style.display = '';

  // Playhead
  const playhead = document.createElement('div');
  playhead.className = 'citelines-playhead';
  const currentPct = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
  playhead.style.left = `${currentPct}%`;
  tracksContainer.appendChild(playhead);

  // Render each populated lane
  for (const lane of populatedLanes) {
    const trackEl = document.createElement('div');
    trackEl.className = 'citelines-track';

    const laneEl = document.createElement('div');
    laneEl.className = 'citelines-track-lane';

    const laneBg = document.createElement('div');
    laneBg.className = 'citelines-track-lane-bg';
    laneEl.appendChild(laneBg);

    // Add markers for this lane
    const laneAnns = laneAnnotations[lane.id] || [];
    for (const ann of laneAnns) {
      const pct = (ann.timestamp / video.duration) * 100;
      const marker = document.createElement('div');
      marker.className = 'citelines-marker ' + getMarkerClass(ann);
      marker.style.left = pct + '%';
      marker.dataset.annotationId = ann.id;

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof analytics !== 'undefined') analytics.track('citation_clicked', { videoId: state.currentVideoId, source: 'marker' });
        showAnnotationPopup(ann, video, !ann.isOwn, marker);
      });

      laneEl.appendChild(marker);
    }

    const labelEl = document.createElement('div');
    labelEl.className = 'citelines-track-label';
    labelEl.innerHTML = `<span class="citelines-track-icon">${lane.icon}</span>${lane.label}`;

    trackEl.appendChild(laneEl);
    trackEl.appendChild(labelEl);
    tracksContainer.appendChild(trackEl);
  }

  // Update count
  if (countEl) {
    const typeCount = populatedLanes.length;
    countEl.textContent = `${annotations.length} citation${annotations.length !== 1 ? 's' : ''} \u00b7 ${typeCount} type${typeCount !== 1 ? 's' : ''}`;
  }

  // Log
  const ownCount = annotations.filter(a => a.isOwn).length;
  const sharedCount = annotations.filter(a => !a.isOwn && !a.isCreatorCitation).length;
  const creatorCount = annotations.filter(a => a.isCreatorCitation).length;
  console.log(`Rendered ${ownCount} own + ${sharedCount} shared + ${creatorCount} creator annotations`);

  // Update sidebar if open
  if (state.sidebarOpen && state.sidebar) {
    updateSidebarContent();
  }
}

// Update playhead position (called on timeupdate)
function updatePlayhead() {
  if (!state.citationTimeline) return;
  const video = document.querySelector('video');
  if (!video || !video.duration) return;

  const playhead = state.citationTimeline.querySelector('.citelines-playhead');
  if (!playhead) return;

  const pct = video.currentTime / video.duration;
  playhead.style.left = `${pct * 100}%`;
}

// Watch for ads to finish
export function startAdObserver() {
  if (state.adObserver) return;
  const player = document.querySelector('.html5-video-player');
  if (!player) return;

  const observer = new MutationObserver(() => {
    if (!player.classList.contains('ad-showing')) {
      observer.disconnect();
      state.setAdObserver(null);
      setTimeout(() => renderMarkers(), 300);
    }
  });
  observer.observe(player, { attributes: true, attributeFilter: ['class'] });
  state.setAdObserver(observer);
}

// Create the multi-track citation timeline element
export function createMarkersContainer() {
  if (state.citationTimeline) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  // Also create the old markers containers for backward compat (popup positioning uses them)
  const progressBar = document.querySelector('.ytp-progress-bar-container');
  if (progressBar) {
    const mc = document.createElement('div');
    mc.className = 'yt-annotator-markers-container';
    progressBar.appendChild(mc);
    state.setMarkersContainer(mc);

    const cmc = document.createElement('div');
    cmc.className = 'yt-annotator-markers-container yt-annotator-creator-markers-container';
    progressBar.appendChild(cmc);
    state.setCreatorMarkersContainer(cmc);
  }

  // Build the citation timeline
  const timeline = document.createElement('div');
  timeline.className = 'citelines-timeline';
  timeline.style.display = 'none'; // hidden until annotations load

  timeline.innerHTML = `
    <div class="citelines-timeline-header">
      <span class="citelines-title">
        <span class="citelines-logo">Cite<span class="citelines-logo-pipe">|</span>ines</span>
        Citations
      </span>
      <span class="citelines-right">
        <span class="citelines-count"></span>
        <span class="citelines-chevron">&#9660;</span>
      </span>
    </div>
    <div class="citelines-timeline-body">
      <div class="citelines-tracks"></div>
      <div class="citelines-legend">
        <div class="citelines-legend-item"><div class="citelines-legend-swatch creator"></div> Creator</div>
        <div class="citelines-legend-item"><div class="citelines-legend-swatch mine"></div> Yours</div>
        <div class="citelines-legend-item"><div class="citelines-legend-swatch other"></div> Others</div>
      </div>
    </div>
  `;

  // Insert between the player and the video info (#below)
  // #below may not exist yet on initial load, so wait for it
  function insertTimeline() {
    const below = document.querySelector('#below');
    if (below && below.parentNode) {
      below.parentNode.insertBefore(timeline, below);
      state.setCitationTimeline(timeline);
      return true;
    }
    return false;
  }

  if (!insertTimeline()) {
    // Wait for #below to appear
    const observer = new MutationObserver(() => {
      if (insertTimeline()) {
        observer.disconnect();
        // Re-render now that timeline is in the DOM
        renderMarkers();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Also set state so renderMarkers doesn't bail early
    state.setCitationTimeline(timeline);
  }

  // Collapse/expand toggle
  const header = timeline.querySelector('.citelines-timeline-header');
  const body = timeline.querySelector('.citelines-timeline-body');
  const chevron = timeline.querySelector('.citelines-chevron');

  header.addEventListener('click', () => {
    const collapsed = !state.timelineCollapsed;
    state.setTimelineCollapsed(collapsed);
    body.classList.toggle('collapsed', collapsed);
    header.classList.toggle('collapsed', collapsed);
    chevron.classList.toggle('collapsed', collapsed);
  });

  // Track playhead position
  const video = document.querySelector('video');
  if (video) {
    video.addEventListener('timeupdate', updatePlayhead);
  }
}
