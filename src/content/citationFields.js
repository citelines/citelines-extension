// Citation field definitions and field editor helpers
// Shared by suggest modal, edit mode, and create popup

import { escapeHtml, formatDate } from './utils.js';

// Field definitions per citation type
export const CITATION_FIELD_DEFS = {
  note: [],
  youtube: [
    { key: 'title', label: 'Title', source: 'citation' },
    { key: 'url', label: 'URL', source: 'citation' },
    { key: 'date', label: 'Date', source: 'citation', isDate: true },
  ],
  movie: [
    { key: 'title', label: 'Title', source: 'citation' },
    { key: 'year', label: 'Year', source: 'citation' },
    { key: 'director', label: 'Director', source: 'citation' },
  ],
  article: [
    { key: 'title', label: 'Title', source: 'citation' },
    { key: 'url', label: 'URL', source: 'citation' },
    { key: 'author', label: 'Author', source: 'citation' },
    { key: 'date', label: 'Date', source: 'citation', isDate: true },
  ],
};

// Build the fields list for a given citation type (always includes Note at the end)
export function getFieldsForCitation(citationType) {
  return [
    ...(CITATION_FIELD_DEFS[citationType] || []),
    { key: 'text', label: 'Note', source: 'text' },
  ];
}

// Get original value for a field from citation/text
export function getFieldOriginalValue(field, citation, originalText) {
  if (field.isDate) return formatDate(citation);
  if (field.source === 'citation') return citation[field.key] || '';
  return originalText;
}

// Build field editor HTML rows (read-only value + pencil + collapsible input)
export function buildFieldEditorHTML(fields, citation, originalText) {
  let html = '';
  for (const field of fields) {
    const origVal = getFieldOriginalValue(field, citation, originalText);
    const displayVal = origVal || '(empty)';

    if (field.isDate) {
      html += `
        <div class="yt-annotator-suggest-field" data-field="${field.key}">
          <span class="yt-annotator-report-label">${field.label}</span>
          <div class="yt-annotator-suggest-row">
            <div class="yt-annotator-suggest-original">${escapeHtml(displayVal)}</div>
            <button class="yt-annotator-suggest-edit-btn" title="Edit">&#9998;</button>
          </div>
          <div class="yt-annotator-suggest-input-wrap" style="display: none;">
            <div style="display: flex; gap: 6px; flex: 1;">
              <input type="text" class="yt-annotator-suggest-input" data-date-part="month" placeholder="Month" value="${escapeHtml(citation.month || '')}" style="flex: 1;" />
              <input type="text" class="yt-annotator-suggest-input" data-date-part="day" placeholder="Day" value="${escapeHtml(citation.day || '')}" style="flex: 1;" />
              <input type="text" class="yt-annotator-suggest-input" data-date-part="year" placeholder="Year" value="${escapeHtml(citation.year || '')}" style="flex: 1;" />
            </div>
            <button class="yt-annotator-suggest-collapse-btn" title="Cancel edit">&times;</button>
          </div>
        </div>`;
    } else {
      const isTextarea = field.key === 'text';
      const inputTag = isTextarea
        ? `<textarea class="yt-annotator-suggest-input" data-field-key="${field.key}">${escapeHtml(origVal)}</textarea>`
        : `<input type="text" class="yt-annotator-suggest-input" data-field-key="${field.key}" value="${escapeHtml(origVal)}" />`;

      html += `
        <div class="yt-annotator-suggest-field" data-field="${field.key}">
          <span class="yt-annotator-report-label">${field.label}</span>
          <div class="yt-annotator-suggest-row">
            <div class="yt-annotator-suggest-original">${escapeHtml(displayVal)}</div>
            <button class="yt-annotator-suggest-edit-btn" title="Edit">&#9998;</button>
          </div>
          <div class="yt-annotator-suggest-input-wrap" style="display: none;">
            ${inputTag}
            <button class="yt-annotator-suggest-collapse-btn" title="Cancel edit">&times;</button>
          </div>
        </div>`;
    }
  }
  return html;
}

// Wire pencil/collapse toggle handlers on field editor rows inside a container
export function wireFieldEditorToggle(container) {
  container.querySelectorAll('.yt-annotator-suggest-field').forEach(fieldEl => {
    const editBtn = fieldEl.querySelector('.yt-annotator-suggest-edit-btn');
    const inputWrap = fieldEl.querySelector('.yt-annotator-suggest-input-wrap');
    const collapseBtn = fieldEl.querySelector('.yt-annotator-suggest-collapse-btn');

    const toggle = () => {
      const visible = inputWrap.style.display !== 'none';
      inputWrap.style.display = visible ? 'none' : 'flex';
      editBtn.classList.toggle('active', !visible);
    };
    editBtn.addEventListener('click', toggle);
    collapseBtn.addEventListener('click', toggle);
  });

  // Stop keyboard events on all inputs/textareas
  container.querySelectorAll('textarea, input').forEach(el => {
    el.addEventListener('keydown', (e) => e.stopPropagation());
    el.addEventListener('keyup', (e) => e.stopPropagation());
    el.addEventListener('keypress', (e) => e.stopPropagation());
  });
}

// Collect changed values from field editor rows. Returns { text?, citation? } or empty object.
export function collectFieldChanges(container, fields, citation, originalText) {
  const changes = {};
  const citationChanges = {};

  for (const field of fields) {
    const fieldEl = container.querySelector(`.yt-annotator-suggest-field[data-field="${field.key}"]`);
    const inputWrap = fieldEl.querySelector('.yt-annotator-suggest-input-wrap');
    if (inputWrap.style.display === 'none') continue; // Not opened

    if (field.isDate) {
      const m = fieldEl.querySelector('[data-date-part="month"]').value.trim();
      const d = fieldEl.querySelector('[data-date-part="day"]').value.trim();
      const y = fieldEl.querySelector('[data-date-part="year"]').value.trim();
      const origM = citation.month || '';
      const origD = citation.day || '';
      const origY = citation.year || '';
      if (m !== origM || d !== origD || y !== origY) {
        citationChanges.month = m;
        citationChanges.day = d;
        citationChanges.year = y;
      }
    } else if (field.source === 'citation') {
      const val = fieldEl.querySelector(`[data-field-key="${field.key}"]`).value.trim();
      const orig = citation[field.key] || '';
      if (val !== orig) {
        citationChanges[field.key] = val;
      }
    } else {
      // text field
      const val = fieldEl.querySelector(`[data-field-key="${field.key}"]`).value.trim();
      if (val !== originalText) {
        changes.text = val;
      }
    }
  }

  if (Object.keys(citationChanges).length > 0) {
    changes.citation = citationChanges;
  }

  return changes;
}
