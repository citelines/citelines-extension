// Studio sidebar: citation list, edit/delete, collapse/expand

import * as state from './state.js';
import { api, authManager, LoginUI } from './globals.js';
import { escapeHtml, formatTime, formatCitation, formatCreationTime } from '../content/utils.js';
import { CITATION_FIELD_DEFS } from '../content/citationFields.js';
import { createCitationForm } from './citationForm.js';
import { updateAnnotation, deleteAnnotation } from './storage.js';
import { renderStudioMarkers } from './markers.js';

let escHandler = null;

// Create the sidebar DOM and attach to body
export function createSidebar(videoId) {
  removeSidebar();

  const sidebar = document.createElement('div');
  sidebar.className = 'citelines-studio-sidebar';
  sidebar.id = 'citelines-studio-sidebar';

  const header = document.createElement('div');
  header.className = 'citelines-studio-header';
  header.innerHTML = `
    <div class="citelines-studio-header-left">
      <span class="citelines-studio-logo">C|</span>
      <span class="citelines-studio-title">Citelines</span>
    </div>
    <button class="citelines-studio-close" title="Collapse sidebar">&times;</button>
  `;
  sidebar.appendChild(header);

  header.querySelector('.citelines-studio-close').addEventListener('click', collapseSidebar);

  const content = document.createElement('div');
  content.className = 'citelines-studio-content';
  sidebar.appendChild(content);

  document.body.appendChild(sidebar);
  state.setSidebar(sidebar);
  state.setSidebarOpen(true);
  setStudioLayout(true);
  showCollapseButton();

  // Escape key closes sidebar
  if (!escHandler) {
    escHandler = (e) => {
      if (e.key === 'Escape' && state.sidebarOpen) {
        collapseSidebar();
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  // Check auth and render appropriate content
  if (authManager.isLoggedIn()) {
    renderAuthenticatedContent(content, videoId);
  } else {
    renderSignInPrompt(content);
  }
}

function renderAuthenticatedContent(content, videoId) {
  // Add the Quick Add form
  const form = createCitationForm(videoId);
  content.appendChild(form);

  // Divider
  const divider = document.createElement('div');
  divider.className = 'citelines-studio-divider';
  content.appendChild(divider);

  // Citation list header
  const listHeader = document.createElement('div');
  listHeader.className = 'citelines-studio-list-header';
  listHeader.innerHTML = `<h3>Your Citations</h3><span class="citelines-studio-count">${state.annotations.length}</span>`;
  content.appendChild(listHeader);

  // Citation list container
  const list = document.createElement('div');
  list.className = 'citelines-studio-list';
  list.id = 'citelines-studio-list';
  content.appendChild(list);

  renderCitationListInto(list);
}

function renderSignInPrompt(content) {
  const prompt = document.createElement('div');
  prompt.className = 'citelines-studio-signin';
  prompt.innerHTML = `
    <div class="citelines-studio-signin-icon">&#128274;</div>
    <h3>Sign in to add citations</h3>
    <p>Sign in with your YouTube account to add citations to your videos.</p>
    <button class="citelines-studio-btn citelines-studio-btn-youtube">&#9654; Sign in with YouTube</button>
  `;

  prompt.querySelector('.citelines-studio-btn-youtube').addEventListener('click', async () => {
    try {
      // Use the YouTube OAuth flow from youtubeAuth.js
      if (window.launchYouTubeOAuth) {
        await window.launchYouTubeOAuth();
        // After successful login, re-initialize
        if (authManager.isLoggedIn()) {
          const videoId = state.currentVideoId;
          if (videoId) {
            const { fetchOwnCitations } = await import('./storage.js');
            await fetchOwnCitations(videoId);
            createSidebar(videoId);
            renderStudioMarkers();
          }
        }
      }
    } catch (err) {
      console.error('[Studio] YouTube sign-in failed:', err);
    }
  });

  content.appendChild(prompt);
}

// Render the citation list (called externally after add/edit/delete)
export function renderCitationList() {
  if (!state.sidebar) return;
  const list = state.sidebar.querySelector('#citelines-studio-list');
  if (!list) return;
  renderCitationListInto(list);

  // Update count
  const count = state.sidebar.querySelector('.citelines-studio-count');
  if (count) count.textContent = state.annotations.length;
}

function renderCitationListInto(list) {
  if (state.annotations.length === 0) {
    list.innerHTML = '<div class="citelines-studio-empty">No citations yet. Use the form above to add one.</div>';
    return;
  }

  // Sort by timestamp
  const sorted = [...state.annotations].sort((a, b) => a.timestamp - b.timestamp);

  list.innerHTML = '';
  for (const ann of sorted) {
    const item = document.createElement('div');
    item.className = 'citelines-studio-citation-item';
    item.dataset.annotationId = ann.id;

    let citationHtml = '';
    if (ann.citation && ann.citation.type) {
      citationHtml = formatCitation(ann.citation, true);
    }

    item.innerHTML = `
      <div class="citelines-studio-citation-top">
        <span class="citelines-studio-citation-time">${escapeHtml(formatTime(ann.timestamp))}</span>
        <div class="citelines-studio-citation-actions">
          <button class="citelines-studio-btn-icon citelines-studio-edit-btn" title="Edit">&#9998;</button>
          <button class="citelines-studio-btn-icon citelines-studio-delete-btn" title="Delete">&times;</button>
        </div>
      </div>
      ${citationHtml}
      ${ann.text ? `<div class="citelines-studio-citation-text">${escapeHtml(ann.text)}</div>` : ''}
      <div class="citelines-studio-citation-meta">${formatCreationTime(ann.createdAt)}</div>
    `;

    // Edit button
    item.querySelector('.citelines-studio-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showEditForm(item, ann);
    });

    // Delete button
    item.querySelector('.citelines-studio-delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this citation?')) return;
      try {
        await deleteAnnotation(ann.id);
        renderCitationList();
        renderStudioMarkers();
      } catch (err) {
        console.error('[Studio] Failed to delete:', err);
        alert('Failed to delete citation.');
      }
    });

    list.appendChild(item);
  }
}

function showEditForm(item, ann) {
  const existing = item.querySelector('.citelines-studio-edit-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'citelines-studio-edit-form';

  const citationType = ann.citation?.type || 'note';
  const fields = CITATION_FIELD_DEFS[citationType] || [];

  let fieldsHtml = '';
  for (const field of fields) {
    if (field.isDate) {
      fieldsHtml += `
        <div class="citelines-studio-field">
          <label class="citelines-studio-label">Date</label>
          <div class="citelines-studio-date-row">
            <input type="text" class="citelines-studio-input" data-edit-field="month" placeholder="Month" value="${escapeHtml(ann.citation?.month || '')}" />
            <input type="text" class="citelines-studio-input" data-edit-field="day" placeholder="Day" value="${escapeHtml(ann.citation?.day || '')}" />
            <input type="text" class="citelines-studio-input" data-edit-field="year" placeholder="Year" value="${escapeHtml(ann.citation?.year || '')}" />
          </div>
        </div>
      `;
    } else {
      const val = ann.citation?.[field.key] || '';
      fieldsHtml += `
        <div class="citelines-studio-field">
          <label class="citelines-studio-label">${escapeHtml(field.label)}</label>
          <input type="text" class="citelines-studio-input" data-edit-field="${field.key}" value="${escapeHtml(val)}" />
        </div>
      `;
    }
  }

  form.innerHTML = `
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Timestamp</label>
      <input type="text" class="citelines-studio-input" data-edit-field="timestamp" value="${escapeHtml(formatTime(ann.timestamp))}" />
    </div>
    ${fieldsHtml}
    <div class="citelines-studio-field">
      <label class="citelines-studio-label">Note</label>
      <textarea class="citelines-studio-textarea" data-edit-field="text" rows="2">${escapeHtml(ann.text || '')}</textarea>
    </div>
    <div class="citelines-studio-edit-actions">
      <button class="citelines-studio-btn citelines-studio-btn-cancel">Cancel</button>
      <button class="citelines-studio-btn citelines-studio-btn-save">Save</button>
    </div>
  `;

  // Stop keyboard events
  form.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('keydown', e => e.stopPropagation());
    el.addEventListener('keyup', e => e.stopPropagation());
    el.addEventListener('keypress', e => e.stopPropagation());
  });

  form.querySelector('.citelines-studio-btn-cancel').addEventListener('click', () => form.remove());

  form.querySelector('.citelines-studio-btn-save').addEventListener('click', async () => {
    const tsInput = form.querySelector('[data-edit-field="timestamp"]');
    const timestamp = parseTimestamp(tsInput.value);
    if (timestamp === null) {
      alert('Invalid timestamp format.');
      return;
    }

    const text = form.querySelector('[data-edit-field="text"]').value.trim();

    const citation = {};
    for (const field of fields) {
      if (field.isDate) {
        citation.month = form.querySelector('[data-edit-field="month"]')?.value.trim() || '';
        citation.day = form.querySelector('[data-edit-field="day"]')?.value.trim() || '';
        citation.year = form.querySelector('[data-edit-field="year"]')?.value.trim() || '';
      } else {
        citation[field.key] = form.querySelector(`[data-edit-field="${field.key}"]`)?.value.trim() || '';
      }
    }

    try {
      const changes = { text, timestamp };
      if (Object.keys(citation).length > 0) {
        changes.citation = { ...ann.citation, ...citation };
      }
      await updateAnnotation(ann.id, changes);
      renderCitationList();
      renderStudioMarkers();
    } catch (err) {
      console.error('[Studio] Failed to update:', err);
      alert('Failed to save changes.');
    }
  });

  item.appendChild(form);
}

function parseTimestamp(str) {
  const parts = str.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

// Collapse sidebar → show circular button in bottom-right
export function collapseSidebar() {
  if (state.sidebar) {
    state.sidebar.style.display = 'none';
  }
  setStudioLayout(false);
  state.setSidebarOpen(false);
  showCollapseButton();
}

// Expand sidebar
export function expandSidebar() {
  if (state.sidebar) {
    state.sidebar.style.display = '';
  }
  setStudioLayout(true);
  state.setSidebarOpen(true);
  showCollapseButton(); // keep button visible, repositioned left of sidebar
}

function toggleSidebar() {
  if (state.sidebarOpen) {
    collapseSidebar();
  } else {
    expandSidebar();
  }
}

const SIDEBAR_WIDTH = 360;
let layoutStyleTag = null;

function setStudioLayout(open) {
  if (open) {
    document.body.classList.add('citelines-studio-open');
    if (!layoutStyleTag) {
      layoutStyleTag = document.createElement('style');
      layoutStyleTag.textContent = `
        body.citelines-studio-open ytcp-entity-page#entity-page {
          right: ${SIDEBAR_WIDTH}px !important;
          width: auto !important;
          left: 0 !important;
        }
        body.citelines-studio-open .nav-and-main-content,
        body.citelines-studio-open main#main {
          overflow-x: hidden !important;
        }
      `;
      document.head.appendChild(layoutStyleTag);
    }
    // Fire resize so Studio recalculates internal layout
    window.dispatchEvent(new Event('resize'));
    // Apply styles directly via JS (CSS doesn't penetrate Polymer scoped styles)
    applyEditorLayout();
    setTimeout(applyEditorLayout, 500);
  } else {
    document.body.classList.remove('citelines-studio-open');
    clearEditorLayout();
    window.dispatchEvent(new Event('resize'));
  }
}

function applyEditorLayout() {
  const editor = document.querySelector('ytcp-video-metadata-editor');
  if (!editor) return;
  editor.style.setProperty('overflow', 'hidden', 'important');
  const wrapperDiv = editor.querySelector(':scope > div');
  if (wrapperDiv) {
    wrapperDiv.style.setProperty('flex-shrink', '1', 'important');
    wrapperDiv.style.setProperty('min-width', '0', 'important');
  }
  const sp = editor.querySelector('ytcp-video-metadata-editor-sidepanel');
  if (sp) {
    sp.style.setProperty('flex-shrink', '0', 'important');
  }
}

function clearEditorLayout() {
  const editor = document.querySelector('ytcp-video-metadata-editor');
  if (!editor) return;
  editor.style.removeProperty('overflow');
  const wrapperDiv = editor.querySelector(':scope > div');
  if (wrapperDiv) {
    wrapperDiv.style.removeProperty('flex-shrink');
    wrapperDiv.style.removeProperty('min-width');
  }
  const sp = editor.querySelector('ytcp-video-metadata-editor-sidepanel');
  if (sp) {
    sp.style.removeProperty('flex-shrink');
  }
}

function showCollapseButton() {
  if (!state.collapseButton) {
    const btn = document.createElement('button');
    btn.className = 'citelines-studio-collapse-btn';
    btn.innerHTML = 'C|';
    btn.addEventListener('click', toggleSidebar);
    document.body.appendChild(btn);
    state.setCollapseButton(btn);
  }
  // Position: when sidebar is open, sit left of it; when closed, bottom-right corner
  if (state.sidebarOpen) {
    state.collapseButton.style.right = `${SIDEBAR_WIDTH + 12}px`;
    state.collapseButton.title = 'Close Citelines sidebar';
  } else {
    state.collapseButton.style.right = '24px';
    state.collapseButton.title = 'Open Citelines sidebar';
  }
}

function removeCollapseButton() {
  if (state.collapseButton) {
    state.collapseButton.remove();
    state.setCollapseButton(null);
  }
}

// Remove sidebar and collapse button
export function removeSidebar() {
  if (state.sidebar) {
    state.sidebar.remove();
    state.setSidebar(null);
  }
  setStudioLayout(false);
  removeCollapseButton();
  state.setSidebarOpen(true);
}
