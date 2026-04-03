// Multi-track citation timeline for Studio video preview

import * as state from './state.js';
import { formatTime, escapeHtml, formatCitation } from '../content/utils.js';

let retryCount = 0;
const MAX_RETRIES = 10;

// Lane definitions — same as watch page
const LANES = [
  { id: 'article',  label: 'Article',  icon: '\uD83D\uDCC4' },
  { id: 'youtube',  label: 'YouTube',  icon: '\u25B6' },
  { id: 'movie',    label: 'Movie',    icon: '\uD83C\uDF9E' },
  { id: 'book',     label: 'Book',     icon: '\uD83D\uDCD6' },
  { id: 'podcast',  label: 'Podcast',  icon: '\uD83C\uDF99' },
  { id: 'note',     label: 'Note',     icon: '\uD83D\uDCDD' },
];

function getLaneId(ann) {
  return ann.citation?.type || 'note';
}

// Render multi-track markers below the Studio timeline
export function renderStudioMarkers() {
  // Remove existing markers
  if (state.markersContainer) {
    state.markersContainer.remove();
    state.setMarkersContainer(null);
  }

  if (!state.annotations || state.annotations.length === 0) return;

  const video = document.querySelector('video');
  if (!video) {
    retryLater();
    return;
  }

  const duration = video.duration;
  if (!duration || !isFinite(duration) || duration <= 0) {
    video.addEventListener('loadedmetadata', () => renderStudioMarkers(), { once: true });
    retryLater();
    return;
  }

  // Find the Studio timeline container
  const timeline = document.querySelector('#timeline-container');
  if (!timeline) {
    retryLater();
    return;
  }

  retryCount = 0;

  // Group annotations by lane
  const laneAnnotations = {};
  for (const ann of state.annotations) {
    const laneId = getLaneId(ann);
    if (!laneAnnotations[laneId]) laneAnnotations[laneId] = [];
    laneAnnotations[laneId].push(ann);
  }

  // Only show populated lanes
  const populatedLanes = LANES.filter(l => laneAnnotations[l.id]?.length > 0);

  // Include unknown lane ids
  const knownIds = new Set(LANES.map(l => l.id));
  for (const laneId of Object.keys(laneAnnotations)) {
    if (!knownIds.has(laneId)) {
      populatedLanes.push({ id: laneId, label: laneId.charAt(0).toUpperCase() + laneId.slice(1), icon: '\uD83D\uDCC4' });
    }
  }

  if (populatedLanes.length === 0) return;

  // Build the multi-track container
  const container = document.createElement('div');
  container.className = 'citelines-studio-timeline';

  const header = document.createElement('div');
  header.className = 'citelines-studio-timeline-header';
  header.innerHTML = `
    <span class="citelines-studio-timeline-title">
      <span class="citelines-studio-timeline-logo">Cite<span class="citelines-studio-timeline-pipe">|</span>ines</span>
      Timeline
    </span>
    <span class="citelines-studio-timeline-right">
      <span class="citelines-studio-timeline-count">${state.annotations.length} citation${state.annotations.length !== 1 ? 's' : ''} \u00b7 ${populatedLanes.length} type${populatedLanes.length !== 1 ? 's' : ''}</span>
      <span class="citelines-studio-timeline-chevron">&#9660;</span>
    </span>
  `;

  const body = document.createElement('div');
  body.className = 'citelines-studio-timeline-body';

  const tracks = document.createElement('div');
  tracks.className = 'citelines-studio-timeline-tracks';

  for (const lane of populatedLanes) {
    const trackEl = document.createElement('div');
    trackEl.className = 'citelines-studio-timeline-track';

    const laneEl = document.createElement('div');
    laneEl.className = 'citelines-studio-timeline-track-lane';

    const laneBg = document.createElement('div');
    laneBg.className = 'citelines-studio-timeline-track-lane-bg';
    laneEl.appendChild(laneBg);

    const laneAnns = laneAnnotations[lane.id] || [];
    for (const ann of laneAnns) {
      const pct = (ann.timestamp / duration) * 100;
      if (pct < 0 || pct > 100) continue;

      const marker = document.createElement('div');
      marker.className = 'citelines-studio-timeline-marker';
      marker.style.left = pct + '%';
      marker.dataset.annotationId = ann.id;

      // Hover tooltip — compact one-liner with timestamp + source
      const tooltipSource = ann.citation?.title || ann.text || 'Note';
      const tooltip = document.createElement('div');
      tooltip.className = 'citelines-studio-marker-tooltip';
      tooltip.innerHTML =
        `<div class="citelines-studio-marker-tooltip-row">` +
          `<span class="citelines-studio-marker-tooltip-time">${formatTime(ann.timestamp)}</span>` +
          `<span class="citelines-studio-marker-tooltip-source">${escapeHtml(tooltipSource)}</span>` +
        `</div>` +
        `<div class="citelines-studio-marker-tooltip-arrow"></div>` +
        `<div class="citelines-studio-marker-tooltip-arrow-inner"></div>`;
      marker.appendChild(tooltip);

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        showMarkerPopup(ann, marker);
        scrollToAnnotation(ann.id);
      });

      laneEl.appendChild(marker);
    }

    const labelEl = document.createElement('div');
    labelEl.className = 'citelines-studio-timeline-track-label';
    labelEl.innerHTML = `<span class="citelines-studio-timeline-track-icon">${lane.icon}</span>${lane.label}`;

    trackEl.appendChild(laneEl);
    trackEl.appendChild(labelEl);
    tracks.appendChild(trackEl);
  }

  body.appendChild(tracks);
  container.appendChild(header);
  container.appendChild(body);

  // Collapse/expand toggle
  const chevron = header.querySelector('.citelines-studio-timeline-chevron');
  header.addEventListener('click', () => {
    body.classList.toggle('collapsed');
    header.classList.toggle('collapsed');
    chevron.classList.toggle('collapsed');
  });

  // Insert after the html5 video player wrapper
  const html5Player = document.querySelector('ytcp-video-info ytcp-html5-video-player');
  if (html5Player && html5Player.parentNode) {
    html5Player.parentNode.insertBefore(container, html5Player.nextSibling);
  } else {
    // Fallback: insert after the timeline bar
    timeline.parentNode.insertBefore(container, timeline.nextSibling);
  }
  state.setMarkersContainer(container);
}

function retryLater() {
  if (retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(() => renderStudioMarkers(), 1000);
  }
}

let activePopup = null;

function closeMarkerPopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

function showMarkerPopup(ann, marker) {
  closeMarkerPopup();

  // Append popup to the timeline container and position near the marker
  const timelineEl = state.markersContainer;
  if (!timelineEl) return;

  if (getComputedStyle(timelineEl).position === 'static') {
    timelineEl.style.position = 'relative';
  }

  const popup = document.createElement('div');
  popup.className = 'citelines-studio-popup';

  let citationHtml = '';
  if (ann.citation && ann.citation.type) {
    citationHtml = formatCitation(ann.citation, true);
  }

  popup.innerHTML = `
    <div class="citelines-studio-popup-header">
      <span class="citelines-studio-popup-time">${escapeHtml(formatTime(ann.timestamp))}</span>
      <button class="citelines-studio-popup-close">&times;</button>
    </div>
    ${citationHtml}
    ${ann.text ? `<div class="citelines-studio-popup-text">${escapeHtml(ann.text)}</div>` : ''}
    <div class="citelines-studio-popup-actions">
      <button class="citelines-studio-popup-goto">Go to</button>
    </div>
  `;

  popup.querySelector('.citelines-studio-popup-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeMarkerPopup();
  });

  popup.querySelector('.citelines-studio-popup-goto').addEventListener('click', (e) => {
    e.stopPropagation();
    const video = document.querySelector('video');
    if (video) video.currentTime = ann.timestamp;
    closeMarkerPopup();
  });

  timelineEl.appendChild(popup);
  activePopup = popup;

  // Position above the marker
  const markerRect = marker.getBoundingClientRect();
  const timelineRect = timelineEl.getBoundingClientRect();
  const popupWidth = popup.offsetWidth;

  const markerCenterX = markerRect.left + markerRect.width / 2 - timelineRect.left;
  let popupLeft = markerCenterX - popupWidth / 2;
  const padding = 8;
  popupLeft = Math.max(padding, Math.min(popupLeft, timelineRect.width - popupWidth - padding));

  const popupBottom = timelineRect.bottom - markerRect.top + 8;

  popup.style.position = 'absolute';
  popup.style.left = `${popupLeft}px`;
  popup.style.bottom = `${popupBottom}px`;
  popup.style.top = 'auto';
  popup.style.transform = 'none';

  const outsideHandler = (e) => {
    if (!popup.contains(e.target) && !marker.contains(e.target)) {
      closeMarkerPopup();
      document.removeEventListener('click', outsideHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideHandler), 0);
}

function scrollToAnnotation(annotationId) {
  if (!state.sidebar) return;
  const el = state.sidebar.querySelector(`[data-annotation-id="${annotationId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('citelines-studio-highlight');
    setTimeout(() => el.classList.remove('citelines-studio-highlight'), 1500);
  }
}
