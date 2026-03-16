// Orange triangle markers on Studio's video preview player timeline

import * as state from './state.js';
import { formatTime, escapeHtml, formatCitation } from '../content/utils.js';

let retryCount = 0;
const MAX_RETRIES = 10;

// Render markers above the Studio timeline
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

  // Find the Studio timeline container: #timeline-container inside <ytcp-video-player-timeline>
  const timeline = document.querySelector('#timeline-container');
  if (!timeline) {
    retryLater();
    return;
  }

  retryCount = 0;

  // Ensure timeline is positioned for absolute children
  if (getComputedStyle(timeline).position === 'static') {
    timeline.style.position = 'relative';
  }

  const container = document.createElement('div');
  container.className = 'citelines-studio-markers';

  for (const ann of state.annotations) {
    const pct = (ann.timestamp / duration) * 100;
    if (pct < 0 || pct > 100) continue;

    const marker = document.createElement('div');
    marker.className = 'citelines-studio-marker';
    marker.style.left = `${pct}%`;
    marker.title = `${formatTime(ann.timestamp)} — ${ann.text || ann.citation?.title || ''}`;
    marker.dataset.annotationId = ann.id;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      showMarkerPopup(ann, marker);
      scrollToAnnotation(ann.id);
    });

    container.appendChild(marker);
  }

  timeline.appendChild(container);
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

  const videoContainer = document.querySelector('ytcp-video-info .container');
  if (!videoContainer) return;

  // Ensure container is positioned for absolute popup
  if (getComputedStyle(videoContainer).position === 'static') {
    videoContainer.style.position = 'relative';
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
  `;

  popup.querySelector('.citelines-studio-popup-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeMarkerPopup();
  });

  videoContainer.appendChild(popup);
  activePopup = popup;

  // Close on click outside
  const outsideHandler = (e) => {
    if (!popup.contains(e.target) && !marker.contains(e.target)) {
      closeMarkerPopup();
      document.removeEventListener('click', outsideHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideHandler), 0);
}

// Scroll the sidebar to a specific annotation
function scrollToAnnotation(annotationId) {
  if (!state.sidebar) return;
  const el = state.sidebar.querySelector(`[data-annotation-id="${annotationId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('citelines-studio-highlight');
    setTimeout(() => el.classList.remove('citelines-studio-highlight'), 1500);
  }
}
