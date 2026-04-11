// Multi-track citation timeline: lanes by citation type, vertical bar markers

import * as state from './state.js';
import { authManager, analytics } from './globals.js';
import { formatTime, escapeHtml } from './utils.js';
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

// Bookmark lane — rendered separately after citation lanes
const BOOKMARK_LANE = { id: 'bookmark', label: 'My Bookmarks', icon: '\uD83D\uDD12' };

// Get the lane id for an annotation based on its citation type
function getLaneId(annotation) {
  if (annotation.isBookmark) return 'bookmark';
  return annotation.citation?.type || 'note';
}

// Get marker color class based on ownership
function getMarkerClass(annotation) {
  if (annotation.isBookmark) return 'bookmark';
  if (annotation.isCreatorCitation) return 'creator';
  if (annotation.isOwn) return 'mine';
  return 'other';
}

// Get a short source label for the hover tooltip
function getTooltipSource(annotation) {
  const c = annotation.citation;
  if (c?.title) return c.title;
  if (c?.url) return c.url;
  if (annotation.text) return annotation.text;
  return 'Note';
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

  const annotations = state.sharedAnnotations;

  // Group annotations by lane
  const laneAnnotations = {};
  for (const ann of annotations) {
    const laneId = getLaneId(ann);
    if (!laneAnnotations[laneId]) laneAnnotations[laneId] = [];
    laneAnnotations[laneId].push(ann);
  }

  // Only show lanes that have annotations (exclude bookmarks — handled separately)
  const populatedLanes = LANES.filter(l => laneAnnotations[l.id]?.length > 0);

  // Also include any unknown lane ids (future citation types)
  const knownIds = new Set(LANES.map(l => l.id));
  knownIds.add('bookmark'); // bookmark lane handled separately
  for (const laneId of Object.keys(laneAnnotations)) {
    if (!knownIds.has(laneId)) {
      populatedLanes.push({ id: laneId, label: laneId.charAt(0).toUpperCase() + laneId.slice(1), icon: '\uD83D\uDCC4' });
    }
  }

  const hasBookmarks = laneAnnotations['bookmark']?.length > 0;

  const tracksContainer = state.citationTimeline.querySelector('.citelines-tracks');
  const countEl = state.citationTimeline.querySelector('.citelines-count');
  console.log('[Citelines] renderMarkers: tracksContainer found?', !!tracksContainer, 'annotations:', annotations.length, 'lanes:', populatedLanes.map(l => l.id));
  if (!tracksContainer) return;

  tracksContainer.innerHTML = '';
  state.citationTimeline.style.display = '';

  // If no annotations, show timeline header with empty state
  if (annotations.length === 0) {
    if (countEl) countEl.textContent = '0 citations';
    return;
  }

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

      // Hover tooltip — compact one-liner with timestamp + source
      const colorClass = getMarkerClass(ann);
      const tooltip = document.createElement('div');
      tooltip.className = 'citelines-marker-tooltip';
      tooltip.innerHTML =
        `<div class="citelines-marker-tooltip-row">` +
          `<span class="citelines-marker-tooltip-time ${colorClass}">${formatTime(ann.timestamp)}</span>` +
          `<span class="citelines-marker-tooltip-source">${escapeHtml(getTooltipSource(ann))}</span>` +
        `</div>` +
        `<div class="citelines-marker-tooltip-arrow"></div>` +
        `<div class="citelines-marker-tooltip-arrow-inner"></div>`;
      marker.appendChild(tooltip);

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof analytics !== 'undefined') analytics.track('citation_clicked', { videoId: state.currentVideoId, source: 'marker' });
        showAnnotationPopup(ann, video, !ann.isOwn, marker);
      });

      laneEl.appendChild(marker);
    }

    const labelEl = document.createElement('div');
    labelEl.className = 'citelines-track-label';
    labelEl.textContent = lane.label;

    trackEl.appendChild(laneEl);
    trackEl.appendChild(labelEl);
    tracksContainer.appendChild(trackEl);
  }

  // Render bookmark lane (after citation lanes, with dashed separator)
  if (hasBookmarks) {
    // Add shared SVG defs for bookmark hash fill pattern
    const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgDefs.setAttribute('width', '0');
    svgDefs.setAttribute('height', '0');
    svgDefs.style.position = 'absolute';
    svgDefs.innerHTML = `
      <defs>
        <pattern id="citelines-bookmark-hash" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(4,151,166,0.6)" stroke-width="1.5"/>
        </pattern>
      </defs>
    `;
    tracksContainer.appendChild(svgDefs);

    const bookmarkTrack = document.createElement('div');
    bookmarkTrack.className = 'citelines-track citelines-track-bookmark';

    const bookmarkLane = document.createElement('div');
    bookmarkLane.className = 'citelines-track-lane';

    const bookmarkLaneBg = document.createElement('div');
    bookmarkLaneBg.className = 'citelines-track-lane-bg';
    bookmarkLane.appendChild(bookmarkLaneBg);

    const bookmarkAnns = laneAnnotations['bookmark'] || [];
    for (const ann of bookmarkAnns) {
      const pct = (ann.timestamp / video.duration) * 100;

      // SVG bookmark-shaped marker with hash fill
      const marker = document.createElement('div');
      marker.className = 'citelines-marker bookmark';
      marker.style.left = pct + '%';
      marker.dataset.annotationId = ann.id;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '12');
      svg.setAttribute('height', '16');
      svg.setAttribute('viewBox', '0 0 12 16');
      svg.innerHTML = `<path d="M1 1h10v13l-5-3.5L1 14V1z" fill="url(#citelines-bookmark-hash)" stroke="rgba(4,151,166,0.8)" stroke-width="1"/>`;
      marker.appendChild(svg);

      // Tooltip
      const colorClass = 'bookmark';
      const tooltip = document.createElement('div');
      tooltip.className = 'citelines-marker-tooltip';
      tooltip.innerHTML =
        `<div class="citelines-marker-tooltip-row">` +
          `<span class="citelines-marker-tooltip-time ${colorClass}">${formatTime(ann.timestamp)}</span>` +
          `<span class="citelines-marker-tooltip-source">${escapeHtml(getTooltipSource(ann))}</span>` +
        `</div>` +
        `<div class="citelines-marker-tooltip-arrow"></div>` +
        `<div class="citelines-marker-tooltip-arrow-inner"></div>`;
      marker.appendChild(tooltip);

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        showAnnotationPopup(ann, video, false, marker);
      });

      bookmarkLane.appendChild(marker);
    }

    const bookmarkLabel = document.createElement('div');
    bookmarkLabel.className = 'citelines-track-label citelines-track-label-bookmark';
    bookmarkLabel.textContent = BOOKMARK_LANE.label;

    bookmarkTrack.appendChild(bookmarkLane);
    bookmarkTrack.appendChild(bookmarkLabel);
    tracksContainer.appendChild(bookmarkTrack);
  }

  // Update count (exclude bookmarks from citation count)
  const citationCount = annotations.filter(a => !a.isBookmark).length;
  if (countEl) {
    let countText = `${citationCount} citation${citationCount !== 1 ? 's' : ''}`;
    if (hasBookmarks) countText += ` \u00b7 ${laneAnnotations['bookmark'].length} bookmark${laneAnnotations['bookmark'].length !== 1 ? 's' : ''}`;
    countEl.textContent = countText;
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
