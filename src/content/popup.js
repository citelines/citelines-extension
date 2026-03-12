// Annotation popup: view, edit, delete, suggestions

import * as state from './state.js';
import { api, authManager, UserProfileUI, analytics } from './globals.js';
import { escapeHtml, formatTime, formatCreationTime, formatCitation } from './utils.js';
import { getFieldsForCitation, buildFieldEditorHTML, wireFieldEditorToggle, collectFieldChanges } from './citationFields.js';
import { getVideoId } from './utils.js';
import { getAnnotationsStorageKey } from './storage.js';
import { fetchAllAnnotations } from './fetchAnnotations.js';
import { renderMarkers } from './markers.js';
import { showReportModal, handleSuggestAction } from './modals.js';

// Close any open popup
export function closePopup() {
  if (state.activePopup) {
    state.activePopup.remove();
    state.setActivePopup(null);
  }
  // Remove connector line if it exists
  const connector = document.querySelector('.yt-annotator-popup-connector');
  if (connector) {
    connector.remove();
  }
}

// Position popup near the marker on the progress bar
function positionPopupNearMarker(popup, annotation, video) {
  try {
    if (!video || !video.duration) return;

    const percentage = (annotation.timestamp / video.duration) * 100;
    const progressBar = document.querySelector('.ytp-progress-bar-container');
    const playerContainer = document.querySelector('#movie_player');

    if (!progressBar || !playerContainer) return;

    const progressBarRect = progressBar.getBoundingClientRect();
    const playerRect = playerContainer.getBoundingClientRect();

    const markerAbsoluteX = progressBarRect.left + (percentage / 100) * progressBarRect.width;
    const popupWidth = popup.offsetWidth;

    // Constrain popup to middle 40% of video window (30% to 70%)
    const playerWidth = playerRect.width;
    const minConstraint = playerWidth * 0.30;
    const maxConstraint = playerWidth * 0.70;

    const markerRelativeToPlayer = markerAbsoluteX - playerRect.left;
    let popupLeft = markerRelativeToPlayer - (popupWidth / 2);

    const popupMinLeft = minConstraint - (popupWidth / 2);
    const popupMaxLeft = maxConstraint - (popupWidth / 2);
    popupLeft = Math.max(popupMinLeft, Math.min(popupLeft, popupMaxLeft));

    popup.style.left = `${popupLeft}px`;
    popup.style.transform = 'none';

    // Wait for next frame to get accurate popup position
    requestAnimationFrame(() => {
      try {
        const popupRect = popup.getBoundingClientRect();
        const playerRect = playerContainer.getBoundingClientRect();

        const connector = document.createElement('div');
        connector.className = 'yt-annotator-popup-connector';

        const popupBottom = popupRect.bottom;
        const markerTop = progressBarRect.top - 4;
        const totalHeight = Math.abs(markerTop - popupBottom);

        if (totalHeight >= 10) {
          const popupBorderWidth = popup.offsetWidth;
          const popupCenterX = popupBorderWidth / 2;

          const markerXRelativeToPopup = markerAbsoluteX - popupRect.left;
          const horizontalOffset = markerXRelativeToPopup - popupCenterX;

          const elbowHeight = totalHeight * 0.3;
          const remainingHeight = totalHeight - elbowHeight;

          const horizontalWidth = Math.abs(horizontalOffset) + 2;
          const horizontalLeft = Math.min(markerXRelativeToPopup, popupCenterX) - 1;

          const connectorColor = annotation.isCreatorCitation ? '#ffaa3e'
            : annotation.isOwn ? '#0497a6'
            : '#888888';

          const verticalTop = document.createElement('div');
          verticalTop.className = 'yt-annotator-connector-vertical-top';
          verticalTop.style.cssText = `
            position: absolute;
            top: 0;
            left: ${popupCenterX}px;
            transform: translateX(-50%);
            width: 2px;
            height: ${elbowHeight + 1}px;
            background: ${connectorColor};
          `;

          const horizontal = document.createElement('div');
          horizontal.className = 'yt-annotator-connector-horizontal';
          horizontal.style.cssText = `
            position: absolute;
            top: ${elbowHeight}px;
            left: ${horizontalLeft}px;
            width: ${horizontalWidth}px;
            height: 2px;
            background: ${connectorColor};
          `;

          const verticalBottom = document.createElement('div');
          verticalBottom.className = 'yt-annotator-connector-vertical-bottom';
          verticalBottom.style.cssText = `
            position: absolute;
            top: ${elbowHeight}px;
            left: ${markerXRelativeToPopup}px;
            transform: translateX(-50%);
            width: 2px;
            height: ${remainingHeight}px;
            background: ${connectorColor};
          `;

          connector.appendChild(verticalTop);
          connector.appendChild(horizontal);
          connector.appendChild(verticalBottom);

          connector.style.height = `${totalHeight}px`;
          popup.appendChild(connector);
        }
      } catch (err) {
        console.error('[Connector] Error:', err);
      }
    });
  } catch (error) {
    console.error('[Positioning] Error:', error);
  }
}

// Show popup for viewing/editing annotation
export function showAnnotationPopup(annotation, video, isShared = false) {
  closePopup();

  // Admin-deleted annotations: show removal notice instead of full popup
  if (annotation.adminDeleted) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const popup = document.createElement('div');
  popup.className = 'yt-annotator-popup';

  const creatorName = annotation.creatorDisplayName || 'Anonymous';
  let badge;
  if (annotation.isCreatorCitation) {
    const ownSuffix = !isShared ? ' (YOU)' : '';
    badge = `<span style="background: #ffaa3e; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px;">Creator${ownSuffix} - ${escapeHtml(creatorName)}</span>`;
  } else if (!isShared) {
    badge = `<span style="background: #0497a6; color: #000; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: 600; margin-left: 8px; border: 2px solid #3a3a3a;">YOU - ${escapeHtml(creatorName)}</span>`;
  } else {
    badge = `<span style="background: #3a3a3a; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px;">${escapeHtml(creatorName)}</span>`;
  }

  const citationHTML = formatCitation(annotation.citation, !isShared);
  const creationTime = formatCreationTime(annotation.createdAt);
  const creationTimeHTML = creationTime ? `<div class="yt-annotator-creation-time">Created ${creationTime}</div>` : '';
  const editedTimeHTML = annotation.editedAt ? `<div class="yt-annotator-edited-time">Edited ${formatCreationTime(annotation.editedAt)}</div>` : '';

  const suggestionCount = annotation.suggestionCount || 0;
  const suggestionBadgeHTML = (!isShared && suggestionCount > 0)
    ? `<div class="yt-annotator-suggestion-badge" title="View suggestions">&#128161; ${suggestionCount} suggestion${suggestionCount !== 1 ? 's' : ''}</div>`
    : '';

  popup.innerHTML = `
    <div class="yt-annotator-popup-header">
      <span class="yt-annotator-popup-timestamp">${formatTime(annotation.timestamp)}${badge}</span>
      <div style="display: flex; align-items: center; gap: 4px;">
        <button class="yt-annotator-actions-btn" title="Actions">&#8942;</button>
        <button class="yt-annotator-popup-close">&times;</button>
      </div>
    </div>
    ${citationHTML}
    <div class="yt-annotator-popup-content">${escapeHtml(annotation.text)}</div>
    ${creationTimeHTML}
    ${editedTimeHTML}
    ${suggestionBadgeHTML}
    <div class="yt-annotator-suggestion-detail" style="display: none;"></div>
    <div class="yt-annotator-popup-actions">
      <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="goto">Go to</button>
    </div>
  `;

  // Event listeners
  popup.querySelector('.yt-annotator-popup-close').addEventListener('click', closePopup);

  // Suggestion badge click handler (owner view)
  const suggestionBadge = popup.querySelector('.yt-annotator-suggestion-badge');
  if (suggestionBadge) {
    suggestionBadge.addEventListener('click', async (e) => {
      e.stopPropagation();
      const detailDiv = popup.querySelector('.yt-annotator-suggestion-detail');
      if (!detailDiv) return;

      if (detailDiv.style.display !== 'none') {
        detailDiv.style.display = 'none';
        return;
      }

      detailDiv.style.display = 'block';
      detailDiv.innerHTML = '<div style="color: #aaa; font-size: 12px; padding: 8px;">Loading suggestions...</div>';

      try {
        const result = await api.getSuggestions(annotation.shareToken);
        const suggestions = (result.suggestions || []).filter(s => s.annotationId === annotation.id);

        if (suggestions.length === 0) {
          detailDiv.innerHTML = '<div style="color: #aaa; font-size: 12px; padding: 8px;">No suggestions found.</div>';
          return;
        }

        detailDiv.innerHTML = suggestions.map(s => {
          let changesHTML = '';
          try {
            const changes = JSON.parse(s.suggestedText);
            if (changes.text) {
              changesHTML += `<div class="yt-annotator-suggestion-diff"><span class="yt-annotator-suggestion-diff-label">Note:</span> <span class="yt-annotator-suggestion-diff-old">${escapeHtml(annotation.text || '')}</span> <span class="yt-annotator-suggestion-diff-arrow">&rarr;</span> <span class="yt-annotator-suggestion-diff-new">${escapeHtml(changes.text)}</span></div>`;
            }
            if (changes.citation) {
              for (const [key, val] of Object.entries(changes.citation)) {
                const origVal = (annotation.citation || {})[key] || '';
                changesHTML += `<div class="yt-annotator-suggestion-diff"><span class="yt-annotator-suggestion-diff-label">${escapeHtml(key)}:</span> <span class="yt-annotator-suggestion-diff-old">${escapeHtml(origVal)}</span> <span class="yt-annotator-suggestion-diff-arrow">&rarr;</span> <span class="yt-annotator-suggestion-diff-new">${escapeHtml(val)}</span></div>`;
              }
            }
          } catch (e) {
            changesHTML = `<div style="color: #aaa;">${escapeHtml(s.suggestedText)}</div>`;
          }
          const reasonHTML = s.reason ? `<div class="yt-annotator-suggestion-reason">Reason: ${escapeHtml(s.reason)}</div>` : '';
          return `<div class="yt-annotator-suggestion-item" data-suggestion-id="${s.id}">
            <div class="yt-annotator-suggestion-item-header">${escapeHtml(s.reporterDisplayName || 'Anonymous')}</div>
            ${changesHTML}${reasonHTML}
            <div class="yt-annotator-suggestion-actions">
              <button class="yt-annotator-btn yt-annotator-suggestion-accept" data-suggestion-id="${s.id}">Accept</button>
              <button class="yt-annotator-btn yt-annotator-suggestion-dismiss" data-suggestion-id="${s.id}">Dismiss</button>
            </div>
          </div>`;
        }).join('');

        // Wire up accept/dismiss handlers
        detailDiv.querySelectorAll('.yt-annotator-suggestion-accept').forEach(btn => {
          btn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const sid = btn.dataset.suggestionId;
            btn.disabled = true;
            btn.textContent = 'Accepting...';
            try {
              await api.acceptSuggestion(sid);
              const card = detailDiv.querySelector(`.yt-annotator-suggestion-item[data-suggestion-id="${sid}"]`);
              if (card) {
                card.innerHTML = '<div style="color: #4caf50; font-size: 12px; padding: 4px;">Accepted and applied.</div>';
              }
              if (state.currentVideoId) fetchAllAnnotations(state.currentVideoId);
            } catch (error) {
              console.error('Failed to accept suggestion:', error);
              btn.disabled = false;
              btn.textContent = 'Accept';
            }
          });
        });

        detailDiv.querySelectorAll('.yt-annotator-suggestion-dismiss').forEach(btn => {
          btn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            const sid = btn.dataset.suggestionId;
            btn.disabled = true;
            btn.textContent = 'Dismissing...';
            try {
              await api.dismissSuggestion(sid);
              const card = detailDiv.querySelector(`.yt-annotator-suggestion-item[data-suggestion-id="${sid}"]`);
              if (card) card.remove();
              const remaining = detailDiv.querySelectorAll('.yt-annotator-suggestion-item').length;
              if (remaining === 0) {
                detailDiv.style.display = 'none';
                const badge = popup.querySelector('.yt-annotator-suggestion-badge');
                if (badge) badge.remove();
              }
              if (suggestionBadge && remaining > 0) {
                suggestionBadge.innerHTML = `&#128161; ${remaining} suggestion${remaining !== 1 ? 's' : ''}`;
              }
              annotation.suggestionCount = remaining;
            } catch (error) {
              console.error('Failed to dismiss suggestion:', error);
              btn.disabled = false;
              btn.textContent = 'Dismiss';
            }
          });
        });
      } catch (error) {
        console.error('Failed to load suggestions:', error);
        detailDiv.innerHTML = '<div style="color: #f44; font-size: 12px; padding: 8px;">Failed to load suggestions.</div>';
      }
    });
  }

  // Three-dots menu
  const actionsBtn = popup.querySelector('.yt-annotator-actions-btn');
  actionsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const existing = popup.querySelector('.yt-annotator-actions-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.className = 'yt-annotator-actions-menu';

    if (!isShared) {
      menu.innerHTML = `
        <button class="yt-annotator-actions-menu-item" data-menu-action="edit">
          <span class="yt-annotator-actions-menu-icon">&#9998;</span> Edit
        </button>
        <button class="yt-annotator-actions-menu-item danger" data-menu-action="delete">
          <span class="yt-annotator-actions-menu-icon">&#128465;</span> Delete
        </button>
      `;
    } else {
      const suggestLabel = annotation.userHasSuggestion ? 'View My Suggestion' : 'Suggest a Change';
      menu.innerHTML = `
        <button class="yt-annotator-actions-menu-item" data-menu-action="report">
          <span class="yt-annotator-actions-menu-icon">&#9873;</span> Report
        </button>
        <button class="yt-annotator-actions-menu-item" data-menu-action="suggest">
          <span class="yt-annotator-actions-menu-icon">&#9998;</span> ${suggestLabel}
        </button>
      `;
    }

    const header = popup.querySelector('.yt-annotator-popup-header');
    header.appendChild(menu);

    menu.querySelectorAll('.yt-annotator-actions-menu-item').forEach(item => {
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const action = item.dataset.menuAction;
        menu.remove();

        if (action === 'edit') {
          enterEditMode(popup, annotation, video);
        } else if (action === 'delete') {
          handleDeleteAnnotation(annotation);
        } else if (action === 'report') {
          showReportModal(annotation);
        } else if (action === 'suggest') {
          handleSuggestAction(annotation);
        }
      });
    });

    const closeMenu = (ev) => {
      if (!menu.contains(ev.target) && ev.target !== actionsBtn) {
        menu.remove();
        document.removeEventListener('click', closeMenu, true);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
  });

  // Badge click handler - show user profile
  const badgeElement = popup.querySelector('.yt-annotator-popup-header span');
  if (badgeElement && annotation.creatorUserId) {
    badgeElement.style.cursor = 'pointer';
    badgeElement.addEventListener('click', (e) => {
      e.stopPropagation();
      const userProfileUI = new UserProfileUI();
      userProfileUI.show(annotation.creatorUserId, annotation.creatorDisplayName || 'User', annotation.isOwn);
    });
  }

  popup.querySelector('[data-action="goto"]').addEventListener('click', () => {
    video.currentTime = annotation.timestamp;
    closePopup();
  });

  playerContainer.appendChild(popup);
  state.setActivePopup(popup);

  positionPopupNearMarker(popup, annotation, video);
}

// Delete annotation handler
export async function handleDeleteAnnotation(annotation) {
  const videoId = getVideoId();
  const shareToken = annotation.shareToken;
  if (!shareToken) return;

  try {
    const shareData = await api.getShare(shareToken);
    const updatedAnnotations = shareData.annotations.filter(a => a.id !== annotation.id);

    if (updatedAnnotations.length === 0) {
      await api.deleteShare(shareToken);
    } else {
      await api.updateShare(shareToken, { annotations: updatedAnnotations });
    }

    state.annotations[videoId] = updatedAnnotations;
    const storageKey = getAnnotationsStorageKey(videoId);
    await chrome.storage.local.set({ [storageKey]: updatedAnnotations });
    await fetchAllAnnotations(videoId);
  } catch (error) {
    console.error('Failed to delete annotation:', error);
  }

  closePopup();
}

// Enter inline edit mode in popup
export function enterEditMode(popup, annotation, video) {
  const citation = annotation.citation || {};
  const citationType = citation.type || 'note';
  const isStructured = citationType !== 'note';

  if (isStructured) {
    enterStructuredEditMode(popup, annotation, video);
  } else {
    enterSimpleEditMode(popup, annotation, video);
  }
}

// Simple edit mode: plain textarea for note-type citations
function enterSimpleEditMode(popup, annotation, video) {
  const contentDiv = popup.querySelector('.yt-annotator-popup-content');
  const actionsDiv = popup.querySelector('.yt-annotator-popup-actions');
  const actionsBtn = popup.querySelector('.yt-annotator-actions-btn');

  if (actionsBtn) actionsBtn.style.display = 'none';

  const originalText = annotation.text || '';
  contentDiv.innerHTML = `<textarea class="yt-annotator-edit-textarea">${escapeHtml(originalText)}</textarea>`;
  const textarea = contentDiv.querySelector('textarea');
  textarea.addEventListener('keydown', (e) => e.stopPropagation());
  textarea.addEventListener('keyup', (e) => e.stopPropagation());
  textarea.addEventListener('keypress', (e) => e.stopPropagation());
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  actionsDiv.innerHTML = `
    <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel-edit">Cancel</button>
    <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save-edit">Save</button>
  `;

  actionsDiv.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => {
    showAnnotationPopup(annotation, video, false);
  });

  actionsDiv.querySelector('[data-action="save-edit"]').addEventListener('click', async () => {
    const newText = textarea.value.trim();
    if (!newText) return;
    if (newText === originalText) {
      showAnnotationPopup(annotation, video, false);
      return;
    }

    try {
      await api.editAnnotation(annotation.shareToken, annotation.id, { text: newText });

      const videoId = getVideoId();
      await fetchAllAnnotations(videoId);

      const updated = state.sharedAnnotations.find(a => a.id === annotation.id);
      if (updated) {
        showAnnotationPopup(updated, video, false);
      } else {
        closePopup();
      }
    } catch (error) {
      console.error('Failed to edit annotation:', error);
      textarea.style.borderColor = '#f44336';
    }
  });
}

// Structured edit mode: field-by-field editor for movie/article/youtube citations
function enterStructuredEditMode(popup, annotation, video) {
  const contentDiv = popup.querySelector('.yt-annotator-popup-content');
  const actionsDiv = popup.querySelector('.yt-annotator-popup-actions');
  const actionsBtn = popup.querySelector('.yt-annotator-actions-btn');

  if (actionsBtn) actionsBtn.style.display = 'none';

  const citation = annotation.citation || {};
  const citationType = citation.type || 'note';
  const originalText = annotation.text || '';
  const fields = getFieldsForCitation(citationType);

  contentDiv.innerHTML = buildFieldEditorHTML(fields, citation, originalText);
  wireFieldEditorToggle(contentDiv);

  actionsDiv.innerHTML = `
    <button class="yt-annotator-btn yt-annotator-btn-secondary" data-action="cancel-edit">Cancel</button>
    <button class="yt-annotator-btn yt-annotator-btn-primary" data-action="save-edit">Save</button>
  `;

  actionsDiv.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => {
    showAnnotationPopup(annotation, video, false);
  });

  actionsDiv.querySelector('[data-action="save-edit"]').addEventListener('click', async () => {
    const changes = collectFieldChanges(contentDiv, fields, citation, originalText);
    if (Object.keys(changes).length === 0) {
      showAnnotationPopup(annotation, video, false);
      return;
    }

    try {
      await api.editAnnotation(annotation.shareToken, annotation.id, changes);

      const videoId = getVideoId();
      await fetchAllAnnotations(videoId);

      const updated = state.sharedAnnotations.find(a => a.id === annotation.id);
      if (updated) {
        showAnnotationPopup(updated, video, false);
      } else {
        closePopup();
      }
    } catch (error) {
      console.error('Failed to edit annotation:', error);
    }
  });
}
