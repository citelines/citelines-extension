// Report and suggest modals

import { api } from './globals.js';
import { escapeHtml } from './utils.js';
import { getFieldsForCitation, buildFieldEditorHTML, wireFieldEditorToggle, collectFieldChanges } from './citationFields.js';

// Show report modal for a citation
export function showReportModal(annotation) {
  const reasons = [
    'Inaccurate or misleading',
    'Spam or self-promotion',
    'Offensive or inappropriate',
    'Irrelevant to video',
    'Other'
  ];

  const modal = document.createElement('div');
  modal.className = 'yt-annotator-report-modal';
  modal.innerHTML = `
    <div class="yt-annotator-report-content">
      <button class="yt-annotator-report-close">&times;</button>
      <h3>Report Citation</h3>
      <p style="color: #aaa; font-size: 13px; margin: 0 0 16px 0;">Why are you reporting this citation?</p>
      <div class="yt-annotator-report-reasons">
        ${reasons.map((r, i) => `
          <label class="yt-annotator-report-reason">
            <input type="radio" name="report-reason" value="${escapeHtml(r)}" ${i === 0 ? 'checked' : ''}>
            <span>${escapeHtml(r)}</span>
          </label>
        `).join('')}
      </div>
      <div style="margin-bottom: 4px;">
        <span class="yt-annotator-report-label">Additional details (optional):</span>
        <textarea class="yt-annotator-report-textarea" placeholder="Provide any extra context..."></textarea>
      </div>
      <div class="yt-annotator-report-actions">
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
        <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="submit">Submit</button>
      </div>
    </div>
  `;

  modal.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('keydown', (e) => e.stopPropagation());
    ta.addEventListener('keyup', (e) => e.stopPropagation());
    ta.addEventListener('keypress', (e) => e.stopPropagation());
  });

  const closeModal = () => modal.remove();

  modal.querySelector('.yt-annotator-report-close').addEventListener('click', closeModal);
  modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    const reason = modal.querySelector('input[name="report-reason"]:checked')?.value;
    const details = modal.querySelector('.yt-annotator-report-textarea').value.trim();

    try {
      await api.reportCitation(annotation.shareToken, annotation.id, reason, details);

      const content = modal.querySelector('.yt-annotator-report-content');
      content.innerHTML = `
        <button class="yt-annotator-report-close">&times;</button>
        <h3>Report Citation</h3>
        <div class="yt-annotator-report-success">
          Thank you for your report. Our team will<br>review this citation.
        </div>
        <div class="yt-annotator-report-actions">
          <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="close">Close</button>
        </div>
      `;
      content.querySelector('.yt-annotator-report-close').addEventListener('click', closeModal);
      content.querySelector('[data-action="close"]').addEventListener('click', closeModal);
    } catch (error) {
      console.error('Failed to submit report:', error);
    }
  });

  document.body.appendChild(modal);
}

// Handle suggest action: fetch existing suggestion if user has one, then open modal
export async function handleSuggestAction(annotation) {
  if (annotation.userHasSuggestion) {
    try {
      const result = await api.getMySuggestion(annotation.shareToken, annotation.id);
      if (result.suggestion) {
        showSuggestModal(annotation, result.suggestion);
        return;
      }
    } catch (error) {
      console.error('Failed to fetch existing suggestion:', error);
    }
  }
  showSuggestModal(annotation, null);
}

// Show suggest-edit modal for a citation
export function showSuggestModal(annotation, existingSuggestion = null) {
  const citation = annotation.citation || {};
  const citationType = citation.type || 'note';
  const originalText = annotation.text || '';

  const fields = getFieldsForCitation(citationType);
  const fieldsHTML = buildFieldEditorHTML(fields, citation, originalText);

  const isEditing = !!existingSuggestion;
  const modalTitle = isEditing ? 'View My Suggestion' : 'Suggest a Change';
  const submitLabel = isEditing ? 'Update Suggestion' : 'Submit';
  const existingReason = isEditing ? (existingSuggestion.reason || '') : '';

  let existingChanges = {};
  if (isEditing && existingSuggestion.suggestedText) {
    try { existingChanges = JSON.parse(existingSuggestion.suggestedText); } catch (e) {}
  }

  const modal = document.createElement('div');
  modal.className = 'yt-annotator-report-modal';
  modal.innerHTML = `
    <div class="yt-annotator-report-content">
      <button class="yt-annotator-report-close">&times;</button>
      <h3>${modalTitle}</h3>
      ${fieldsHTML}
      <div style="margin-top: 14px; margin-bottom: 4px;">
        <span class="yt-annotator-report-label">Reason (optional):</span>
        <textarea class="yt-annotator-report-textarea yt-annotator-suggest-reason" placeholder="Why this change?">${escapeHtml(existingReason)}</textarea>
      </div>
      <div class="yt-annotator-report-actions">
        <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel">Cancel</button>
        <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="submit">${submitLabel}</button>
      </div>
    </div>
  `;

  wireFieldEditorToggle(modal);

  // Pre-fill and pre-expand fields from existing suggestion
  if (isEditing && Object.keys(existingChanges).length > 0) {
    for (const field of fields) {
      let hasChange = false;
      if (field.isDate && existingChanges.citation) {
        hasChange = 'month' in existingChanges.citation || 'day' in existingChanges.citation || 'year' in existingChanges.citation;
      } else if (field.source === 'citation' && existingChanges.citation && field.key in existingChanges.citation) {
        hasChange = true;
      } else if (field.key === 'text' && 'text' in existingChanges) {
        hasChange = true;
      }

      if (hasChange) {
        const fieldEl = modal.querySelector(`.yt-annotator-suggest-field[data-field="${field.key}"]`);
        if (!fieldEl) continue;
        const inputWrap = fieldEl.querySelector('.yt-annotator-suggest-input-wrap');
        const editBtn = fieldEl.querySelector('.yt-annotator-suggest-edit-btn');
        inputWrap.style.display = 'flex';
        editBtn.classList.add('active');

        if (field.isDate && existingChanges.citation) {
          const mInput = fieldEl.querySelector('[data-date-part="month"]');
          const dInput = fieldEl.querySelector('[data-date-part="day"]');
          const yInput = fieldEl.querySelector('[data-date-part="year"]');
          if (mInput && existingChanges.citation.month !== undefined) mInput.value = existingChanges.citation.month;
          if (dInput && existingChanges.citation.day !== undefined) dInput.value = existingChanges.citation.day;
          if (yInput && existingChanges.citation.year !== undefined) yInput.value = existingChanges.citation.year;
        } else if (field.source === 'citation' && existingChanges.citation) {
          const input = fieldEl.querySelector(`[data-field-key="${field.key}"]`);
          if (input) input.value = existingChanges.citation[field.key];
        } else if (field.key === 'text') {
          const input = fieldEl.querySelector(`[data-field-key="text"]`);
          if (input) input.value = existingChanges.text;
        }
      }
    }
  }

  const closeModal = () => modal.remove();

  modal.querySelector('.yt-annotator-report-close').addEventListener('click', closeModal);
  modal.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modal.querySelector('[data-action="submit"]').addEventListener('click', async () => {
    const reason = modal.querySelector('.yt-annotator-suggest-reason').value.trim();

    const changes = collectFieldChanges(modal, fields, citation, originalText);
    if (Object.keys(changes).length === 0) return;

    const suggestedText = JSON.stringify(changes);

    try {
      if (isEditing) {
        await api.updateSuggestion(existingSuggestion.id, suggestedText, reason);
      } else {
        await api.suggestEdit(annotation.shareToken, annotation.id, suggestedText, reason);
      }

      annotation.userHasSuggestion = true;

      const successMsg = isEditing ? 'Your suggestion has been updated.' : 'Your suggestion has been submitted.<br>The citation author will be notified.';
      const content = modal.querySelector('.yt-annotator-report-content');
      content.innerHTML = `
        <button class="yt-annotator-report-close">&times;</button>
        <h3>${modalTitle}</h3>
        <div class="yt-annotator-report-success">
          ${successMsg}
        </div>
        <div class="yt-annotator-report-actions">
          <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="close">Close</button>
        </div>
      `;
      content.querySelector('.yt-annotator-report-close').addEventListener('click', closeModal);
      content.querySelector('[data-action="close"]').addEventListener('click', closeModal);
    } catch (error) {
      console.error('Failed to submit suggestion:', error);
    }
  });

  document.body.appendChild(modal);
}
