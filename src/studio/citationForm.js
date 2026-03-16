// Quick Add citation form for Studio sidebar

import * as state from './state.js';
import { escapeHtml, formatTime } from '../content/utils.js';
import { CITATION_FIELD_DEFS } from '../content/citationFields.js';
import { saveAnnotation } from './storage.js';
import { renderCitationList } from './sidebar.js';
import { renderStudioMarkers } from './markers.js';

// Create and return the Quick Add form element
export function createCitationForm(videoId) {
  const form = document.createElement('div');
  form.className = 'citelines-studio-form';

  form.innerHTML = `
    <h3 class="citelines-studio-form-title">Add Citation</h3>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Timestamp</label>
      <div class="citelines-studio-timestamp-row">
        <input type="text" class="citelines-studio-input citelines-studio-timestamp-input" placeholder="0:00" value="0:00" />
        <button class="citelines-studio-btn-small citelines-studio-btn-current" title="Use current time">Now</button>
      </div>
    </div>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Source Type</label>
      <select class="citelines-studio-select">
        <option value="note">Basic Note</option>
        <option value="youtube">YouTube Video</option>
        <option value="movie">Movie</option>
        <option value="article">Article</option>
      </select>
    </div>
    <div class="citelines-studio-dynamic-fields"></div>
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Note</label>
      <textarea class="citelines-studio-textarea" placeholder="Your note or comment..." rows="3"></textarea>
    </div>
    <div class="citelines-studio-form-actions">
      <button class="citelines-studio-btn citelines-studio-btn-save">Add Citation</button>
    </div>
    <div class="citelines-studio-form-message" style="display: none;"></div>
  `;

  const timestampInput = form.querySelector('.citelines-studio-timestamp-input');
  const currentBtn = form.querySelector('.citelines-studio-btn-current');
  const typeSelect = form.querySelector('.citelines-studio-select');
  const dynamicFields = form.querySelector('.citelines-studio-dynamic-fields');
  const textarea = form.querySelector('.citelines-studio-textarea');
  const saveBtn = form.querySelector('.citelines-studio-btn-save');
  const messageEl = form.querySelector('.citelines-studio-form-message');

  // Stop all keyboard events from propagating to Studio
  form.querySelectorAll('input, textarea, select').forEach(el => {
    el.addEventListener('keydown', e => e.stopPropagation());
    el.addEventListener('keyup', e => e.stopPropagation());
    el.addEventListener('keypress', e => e.stopPropagation());
  });

  // "Now" button — get current time from the Studio preview player
  currentBtn.addEventListener('click', () => {
    const video = document.querySelector('video');
    if (video) {
      timestampInput.value = formatTime(video.currentTime);
    }
  });

  // Source type change — update dynamic fields
  function updateDynamicFields(type) {
    const fields = CITATION_FIELD_DEFS[type] || [];
    if (fields.length === 0) {
      dynamicFields.innerHTML = '';
      return;
    }

    let html = '';
    for (const field of fields) {
      if (field.isDate) {
        html += `
          <div class="citelines-studio-field">
            <label class="citelines-studio-label">Date</label>
            <div class="citelines-studio-date-row">
              <input type="text" class="citelines-studio-input" data-field="month" placeholder="Month" />
              <input type="text" class="citelines-studio-input" data-field="day" placeholder="Day" />
              <input type="text" class="citelines-studio-input" data-field="year" placeholder="Year" />
            </div>
          </div>
        `;
      } else {
        const isUrl = field.key === 'url';
        html += `
          <div class="citelines-studio-field">
            <label class="citelines-studio-label">${escapeHtml(field.label)}</label>
            <input type="${isUrl ? 'url' : 'text'}" class="citelines-studio-input" data-field="${field.key}" placeholder="${escapeHtml(field.label)}" />
          </div>
        `;
      }
    }

    dynamicFields.innerHTML = html;

    // Stop keyboard events on new inputs
    dynamicFields.querySelectorAll('input').forEach(el => {
      el.addEventListener('keydown', e => e.stopPropagation());
      el.addEventListener('keyup', e => e.stopPropagation());
      el.addEventListener('keypress', e => e.stopPropagation());
    });
  }

  typeSelect.addEventListener('change', () => updateDynamicFields(typeSelect.value));
  updateDynamicFields('note');

  // Save
  saveBtn.addEventListener('click', async () => {
    if (saveBtn.disabled) return;

    const timestamp = parseTimestamp(timestampInput.value);
    if (timestamp === null) {
      showMessage(messageEl, 'Invalid timestamp format. Use M:SS or H:MM:SS.', true);
      return;
    }

    const text = textarea.value.trim();
    const citationType = typeSelect.value;

    let citation = null;
    if (citationType !== 'note') {
      citation = { type: citationType };

      const fields = CITATION_FIELD_DEFS[citationType] || [];
      for (const field of fields) {
        if (field.isDate) {
          const month = dynamicFields.querySelector('[data-field="month"]')?.value.trim() || '';
          const day = dynamicFields.querySelector('[data-field="day"]')?.value.trim() || '';
          const year = dynamicFields.querySelector('[data-field="year"]')?.value.trim() || '';
          if (month) citation.month = month;
          if (day) citation.day = day;
          if (year) citation.year = year;
        } else {
          const val = dynamicFields.querySelector(`[data-field="${field.key}"]`)?.value.trim() || '';
          if (val) citation[field.key] = val;
        }
      }

      if (!citation.title && citationType !== 'note') {
        showMessage(messageEl, 'Please enter a title for the citation.', true);
        return;
      }
    }

    if (!text && !citation) {
      showMessage(messageEl, 'Please enter a note or add a citation.', true);
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const annotation = {
      id: Date.now().toString(),
      timestamp,
      text,
      citation,
      createdAt: new Date().toISOString()
    };

    try {
      await saveAnnotation(videoId, annotation);
      renderCitationList();
      renderStudioMarkers();

      // Reset form
      timestampInput.value = '0:00';
      typeSelect.value = 'note';
      updateDynamicFields('note');
      textarea.value = '';
      showMessage(messageEl, 'Citation added!', false);
    } catch (err) {
      console.error('[Studio] Failed to save citation:', err);
      showMessage(messageEl, 'Failed to save. Please try again.', true);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add Citation';
    }
  });

  return form;
}

function parseTimestamp(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function showMessage(el, text, isError) {
  el.textContent = text;
  el.style.display = 'block';
  el.className = 'citelines-studio-form-message' + (isError ? ' citelines-studio-error' : ' citelines-studio-success');
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}
