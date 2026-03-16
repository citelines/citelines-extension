// Orange triangle markers on Studio's video preview player

import * as state from './state.js';

// Render markers above the Studio player's progress bar
export function renderStudioMarkers() {
  // Remove existing markers
  if (state.markersContainer) {
    state.markersContainer.remove();
    state.setMarkersContainer(null);
  }

  if (!state.annotations || state.annotations.length === 0) return;

  const duration = getVideoDuration();
  if (!duration || duration <= 0) return;

  const progressBar = findProgressBar();
  if (!progressBar) {
    // Progress bar not yet in DOM — retry once after a short delay
    setTimeout(() => renderStudioMarkers(), 1000);
    return;
  }

  // Ensure the progress bar parent is positioned
  const parent = progressBar.parentElement;
  if (parent && getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  const container = document.createElement('div');
  container.className = 'citelines-studio-markers';

  for (const ann of state.annotations) {
    const pct = (ann.timestamp / duration) * 100;
    if (pct < 0 || pct > 100) continue;

    const marker = document.createElement('div');
    marker.className = 'citelines-studio-marker';
    marker.style.left = `${pct}%`;
    marker.title = ann.text || (ann.citation?.title) || '';
    marker.dataset.annotationId = ann.id;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToAnnotation(ann.id);
    });

    container.appendChild(marker);
  }

  // Position markers container above the progress bar
  progressBar.parentElement.insertBefore(container, progressBar);
  state.setMarkersContainer(container);
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

// Find the Studio preview player's progress bar
function findProgressBar() {
  // Studio uses a custom video player — try common selectors
  // The progress bar is typically inside the video preview container
  const selectors = [
    '#progress-bar',
    '.progress-bar',
    'ytcp-video-preview #progress-bar',
    'ytcp-video-preview .progress-bar',
    '.video-preview-container #progress-bar',
    '#movie_player .ytp-progress-bar',
    '.ytp-progress-bar',
    'ytcp-video-player .ytp-progress-bar',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // Fallback: look for the video element and find a nearby progress-like element
  const video = document.querySelector('video');
  if (video) {
    const playerContainer = video.closest('[class*="player"], [id*="player"], ytcp-video-preview, #movie_player');
    if (playerContainer) {
      const bar = playerContainer.querySelector('[class*="progress"], [role="progressbar"], [role="slider"]');
      if (bar) return bar;
    }
  }

  return null;
}

// Get video duration from the Studio player
function getVideoDuration() {
  // Try the video element directly
  const video = document.querySelector('video');
  if (video && video.duration && isFinite(video.duration)) {
    return video.duration;
  }

  // Try parsing from a time display (e.g., "0:00 / 3:26")
  const timeDisplaySelectors = [
    '.time-display',
    '.ytp-time-display',
    '[class*="time"]',
    'ytcp-video-preview [class*="duration"]',
  ];

  for (const sel of timeDisplaySelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent;
      const match = text.match(/(\d+):(\d{2})(?::(\d{2}))?\s*$/);
      if (match) {
        if (match[3]) {
          return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
        }
        return parseInt(match[1]) * 60 + parseInt(match[2]);
      }
    }
  }

  return null;
}
