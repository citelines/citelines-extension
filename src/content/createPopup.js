// New annotation creation popup

import * as state from './state.js';
import { escapeHtml, formatTime, getVideoId } from './utils.js';
import { isCreatorMode } from './creatorMode.js';
import { closePopup } from './popup.js';
import { getAnnotationsStorageKey, saveAnnotations, saveBookmark } from './storage.js';
import { renderMarkers } from './markers.js';
import { authManager } from './globals.js';

// Show popup for creating new annotation
export function showCreatePopup(timestamp, video) {
  closePopup();

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const popup = document.createElement('div');
  popup.className = 'yt-annotator-popup yt-annotator-popup-create' + (isCreatorMode() ? ' creator-mode' : '');

  const isLoggedIn = authManager && authManager.isLoggedIn();

  popup.innerHTML = `
    <div class="yt-annotator-popup-header">
      <span class="yt-annotator-popup-timestamp">New annotation at ${formatTime(timestamp)}</span>
      <button class="yt-annotator-popup-close">&times;</button>
    </div>

    <div class="yt-annotator-create-toggle">
      <button class="yt-annotator-toggle-btn active" data-mode="citation">Citation <span class="yt-annotator-toggle-label">public</span></button>
      <button class="yt-annotator-toggle-btn${isLoggedIn ? '' : ' disabled'}" data-mode="bookmark">Bookmark <span class="yt-annotator-toggle-label">private</span></button>
    </div>

    <div class="yt-annotator-login-hint" style="display: none;">
      Sign in to save private bookmarks.
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

    <div class="yt-annotator-private-hint" style="display: none;">
      Only visible to you
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
  const citationTypeContainer = popup.querySelector('.yt-annotator-citation-type');
  const privateHint = popup.querySelector('.yt-annotator-private-hint');
  const loginHint = popup.querySelector('.yt-annotator-login-hint');
  const toggleBtns = popup.querySelectorAll('.yt-annotator-toggle-btn');
  let createMode = 'citation'; // 'citation' or 'bookmark'

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = btn.dataset.mode;

      if (mode === 'bookmark' && !isLoggedIn) {
        loginHint.style.display = 'block';
        return;
      }

      loginHint.style.display = 'none';
      createMode = mode;
      toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

      if (mode === 'bookmark') {
        citationTypeContainer.style.display = 'none';
        citationFields.style.display = 'none';
        privateHint.style.display = 'block';
        textarea.placeholder = 'Your private note...';
      } else {
        citationTypeContainer.style.display = '';
        citationFields.style.display = '';
        privateHint.style.display = 'none';
        textarea.placeholder = 'Your note or comment...';
      }
    });
  });

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

    citationFields.querySelectorAll('input').forEach(input => {
      input.addEventListener('keydown', (e) => e.stopPropagation());
      input.addEventListener('keyup', (e) => e.stopPropagation());
      input.addEventListener('keypress', (e) => e.stopPropagation());
    });
  }

  updateCitationFields('note');

  citationTypeSelect.addEventListener('change', (e) => {
    updateCitationFields(e.target.value);
  });

  textarea.addEventListener('keydown', (e) => e.stopPropagation());
  textarea.addEventListener('keyup', (e) => e.stopPropagation());
  textarea.addEventListener('keypress', (e) => e.stopPropagation());

  popup.querySelector('.yt-annotator-popup-close').addEventListener('click', closePopup);
  popup.querySelector('[data-action="cancel"]').addEventListener('click', closePopup);

  popup.querySelector('[data-action="save"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const saveBtn = popup.querySelector('[data-action="save"]');
    if (saveBtn.disabled) return;

    const text = textarea.value.trim();
    const videoId = getVideoId();

    // Bookmark mode: save privately
    if (createMode === 'bookmark') {
      if (!text) {
        alert('Please enter a note');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        await saveBookmark(videoId, text, timestamp);
        closePopup();
      } catch (error) {
        console.error('Failed to save bookmark:', error);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        alert('Failed to save bookmark. Please try again.');
      }
      return;
    }

    // Citation mode: existing logic
    const citationType = citationTypeSelect.value;

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

      if (!citation.title) {
        alert('Please enter a title for the citation');
        return;
      }
    }

    if (!text && !citation) {
      alert('Please enter a note or add a citation');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const newAnnotation = {
      id: Date.now().toString(),
      timestamp: timestamp,
      text: text,
      citation: citation,
      createdAt: new Date().toISOString()
    };

    if (!state.annotations[videoId]) {
      state.annotations[videoId] = [];
    }
    state.annotations[videoId].push(newAnnotation);

    try {
      await saveAnnotations(videoId, state.annotations[videoId]);
      renderMarkers();
      closePopup();
    } catch (error) {
      console.error('Failed to save annotation:', error);

      state.annotations[videoId] = state.annotations[videoId].filter(ann => ann.id !== newAnnotation.id);
      const storageKey = getAnnotationsStorageKey(videoId);
      await new Promise((resolve) => {
        chrome.storage.local.set({ [storageKey]: state.annotations[videoId] }, resolve);
      });

      if (error.suspended || error.banned) {
        const message = error.banned
          ? 'Your account has been suspended. You cannot create citations.'
          : `Your account is suspended until ${new Date(error.suspendedUntil).toLocaleDateString()}. You cannot create citations.`;
        alert(message);
      } else {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        alert('Failed to save annotation. Please try again.');
      }
    }
  });

  playerContainer.appendChild(popup);
  state.setActivePopup(popup);

  setTimeout(() => textarea.focus(), 0);
}
