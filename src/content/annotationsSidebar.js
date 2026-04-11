// Annotations/bibliography sidebar

import * as state from './state.js';
import { analytics, UserProfileUI } from './globals.js';
import { escapeHtml, formatTime } from './utils.js';
import { isCreatorMode } from './creatorMode.js';
import { showAnnotationPopup, enterEditMode, handleDeleteAnnotation, closePopup } from './popup.js';
import { showReportModal, handleSuggestAction } from './modals.js';
import { authManager } from './globals.js';

let sidebarTab = 'citations'; // 'citations' or 'bookmarks'

// Create the sidebar toggle button
export function createSidebarButton() {
  if (state.sidebarButton) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const btn = document.createElement('button');
  btn.className = 'yt-annotator-sidebar-btn';
  btn.innerHTML = '≡';
  btn.title = 'View all annotations';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  playerContainer.appendChild(btn);
  state.setSidebarButton(btn);
}

// Toggle sidebar open/closed
export function toggleSidebar() {
  // Close account sidebar if open
  if (state.accountSidebarOpen) {
    state.setAccountSidebarOpen(false);
    if (state.accountSidebar) state.accountSidebar.classList.remove('yt-annotator-sidebar-open');
  }

  state.setSidebarOpen(!state.sidebarOpen);
  if (state.sidebarOpen) {
    if (!state.sidebar) {
      createSidebar();
    }
    state.sidebar.classList.add('yt-annotator-sidebar-open');
    if (isCreatorMode()) state.sidebar.classList.add('creator-mode');
    updateSidebarContent();

    if (state.addButton) state.addButton.classList.add('sidebar-open');
    if (state.sidebarButton) state.sidebarButton.classList.add('sidebar-open');
    if (state.loginButton) state.loginButton.classList.add('sidebar-open');
  } else {
    if (state.sidebar) {
      state.sidebar.classList.remove('yt-annotator-sidebar-open');
    }

    if (state.addButton) state.addButton.classList.remove('sidebar-open');
    if (state.sidebarButton) state.sidebarButton.classList.remove('sidebar-open');
    if (state.loginButton) state.loginButton.classList.remove('sidebar-open');
  }
}

// Create the sidebar panel
function createSidebar() {
  if (state.sidebar) return;
  sidebarTab = 'citations';

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const sb = document.createElement('div');
  sb.className = 'yt-annotator-sidebar';

  const isLoggedIn = authManager && authManager.isLoggedIn();

  sb.innerHTML = `
    <div class="yt-annotator-sidebar-header">
      <h3>Bibliography</h3>
      <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
    </div>
    <div class="yt-annotator-sidebar-tabs">
      <button class="yt-annotator-sidebar-tab active" data-tab="citations">Citations</button>
      <button class="yt-annotator-sidebar-tab${isLoggedIn ? '' : ' disabled'}" data-tab="bookmarks">Bookmarks</button>
    </div>
    <div class="yt-annotator-sidebar-filters">
      <button class="yt-annotator-filter-btn active" data-filter="all">All</button>
      <button class="yt-annotator-filter-btn" data-filter="mine">Mine</button>
      <button class="yt-annotator-filter-btn" data-filter="creator">Creator</button>
      <button class="yt-annotator-filter-btn" data-filter="others">Others</button>
    </div>
    <div class="yt-annotator-sidebar-count"></div>
    <div class="yt-annotator-sidebar-content"></div>
  `;

  sb.querySelector('.yt-annotator-sidebar-close').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSidebar();
  });

  sb.querySelectorAll('.yt-annotator-sidebar-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tab.classList.contains('disabled')) return;
      sidebarTab = tab.dataset.tab;
      sb.querySelectorAll('.yt-annotator-sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === sidebarTab));
      // Show/hide filter buttons (only for citations)
      const filters = sb.querySelector('.yt-annotator-sidebar-filters');
      if (filters) filters.style.display = sidebarTab === 'citations' ? '' : 'none';
      updateSidebarContent();
    });
  });

  sb.querySelectorAll('.yt-annotator-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filter = btn.dataset.filter;
      state.setSidebarFilter(filter);

      sb.querySelectorAll('.yt-annotator-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      updateSidebarContent();
    });
  });

  playerContainer.appendChild(sb);
  state.setSidebar(sb);
}

// Update sidebar content with annotations
export function updateSidebarContent() {
  if (!state.sidebar) return;

  const contentDiv = state.sidebar.querySelector('.yt-annotator-sidebar-content');
  const countDiv = state.sidebar.querySelector('.yt-annotator-sidebar-count');

  let filtered;
  if (sidebarTab === 'bookmarks') {
    filtered = state.sharedAnnotations.filter(a => a.isBookmark);
  } else {
    // Citations tab — exclude bookmarks
    const citations = state.sharedAnnotations.filter(a => !a.isBookmark);
    if (state.sidebarFilter === 'mine') {
      filtered = citations.filter(a => a.isOwn);
    } else if (state.sidebarFilter === 'creator') {
      filtered = citations.filter(a => a.isCreatorCitation);
    } else if (state.sidebarFilter === 'others') {
      filtered = citations.filter(a => !a.isOwn && !a.isCreatorCitation);
    } else {
      filtered = citations;
    }
  }

  filtered = [...filtered].sort((a, b) => a.timestamp - b.timestamp);

  const label = sidebarTab === 'bookmarks' ? 'bookmark' : 'annotation';
  countDiv.textContent = `${filtered.length} ${label}${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    contentDiv.innerHTML = '<div class="yt-annotator-sidebar-empty">No annotations yet</div>';
    return;
  }

  const listHTML = filtered.map(annotation => {
    const citationPreview = annotation.citation ?
      `<div class="yt-annotator-sidebar-citation">
        ${annotation.citation.type === 'youtube' ? '🎥' : annotation.citation.type === 'movie' ? '🎬' : '📄'}
        ${escapeHtml(annotation.citation.title || '')}
      </div>` : '';

    const textPreview = annotation.text ?
      `<div class="yt-annotator-sidebar-text">${escapeHtml(annotation.text.substring(0, 100))}${annotation.text.length > 100 ? '...' : ''}</div>` : '';

    let ownerClass, ownerBadge;
    if (annotation.isBookmark) {
      ownerClass = 'bookmark';
      ownerBadge = `<span class="yt-annotator-sidebar-badge bookmark">Bookmark</span>`;
    } else if (annotation.isCreatorCitation) {
      ownerClass = 'creator-citation';
      const creatorName = annotation.creatorDisplayName || 'Anonymous';
      const ownSuffix = annotation.isOwn ? ' (YOU)' : '';
      ownerBadge = `<span class="yt-annotator-sidebar-badge creator">Creator${ownSuffix} - ${escapeHtml(creatorName)}</span>`;
    } else if (annotation.isOwn) {
      ownerClass = 'own';
      const creatorName = annotation.creatorDisplayName || 'Anonymous';
      ownerBadge = `<span class="yt-annotator-sidebar-badge own">YOU - ${escapeHtml(creatorName)}</span>`;
    } else {
      ownerClass = 'other';
      const creatorName = annotation.creatorDisplayName || 'Anonymous';
      ownerBadge = `<span class="yt-annotator-sidebar-badge other">${escapeHtml(creatorName)}</span>`;
    }

    const sidebarSuggestionIndicator = (annotation.isOwn && annotation.suggestionCount > 0)
      ? `<span class="yt-annotator-suggestion-badge-small" title="${annotation.suggestionCount} suggestion${annotation.suggestionCount !== 1 ? 's' : ''}">&#128161; ${annotation.suggestionCount}</span>`
      : '';

    return `
      <div class="yt-annotator-sidebar-item ${ownerClass}" data-timestamp="${annotation.timestamp}">
        <div class="yt-annotator-sidebar-item-header">
          <span class="yt-annotator-sidebar-time">${formatTime(annotation.timestamp)}</span>
          ${ownerBadge}
          ${sidebarSuggestionIndicator}
          <button class="yt-annotator-actions-btn" title="Actions">&#8942;</button>
        </div>
        ${citationPreview}
        ${textPreview}
      </div>
    `;
  }).join('');

  contentDiv.innerHTML = listHTML;

  contentDiv.querySelectorAll('.yt-annotator-sidebar-item').forEach((item, index) => {
    const annotation = filtered[index];

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('yt-annotator-sidebar-badge') ||
          e.target.classList.contains('yt-annotator-actions-btn')) {
        return;
      }
      e.stopPropagation();
      if (typeof analytics !== 'undefined' && !annotation.isBookmark) analytics.track('citation_clicked', { videoId: state.currentVideoId, source: 'sidebar' });
      const video = document.querySelector('video');
      if (video && annotation) {
        showAnnotationPopup(annotation, video, !annotation.isOwn);
      }
    });

    const badge = item.querySelector('.yt-annotator-sidebar-badge');
    if (badge && annotation.creatorUserId) {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const userProfileUI = new UserProfileUI();
        userProfileUI.show(annotation.creatorUserId, annotation.creatorDisplayName || 'User', annotation.isOwn);
      });
    }

    const sidebarActionsBtn = item.querySelector('.yt-annotator-actions-btn');
    if (sidebarActionsBtn) {
      sidebarActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.sidebar.querySelectorAll('.yt-annotator-actions-menu').forEach(m => m.remove());
        state.sidebar.querySelectorAll('.menu-open').forEach(el => el.classList.remove('menu-open'));

        const menu = document.createElement('div');
        menu.className = 'yt-annotator-actions-menu';

        if (annotation.isBookmark || annotation.isOwn) {
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

        const header = item.querySelector('.yt-annotator-sidebar-item-header');
        header.appendChild(menu);
        item.classList.add('menu-open');

        menu.querySelectorAll('.yt-annotator-actions-menu-item').forEach(menuItem => {
          menuItem.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const action = menuItem.dataset.menuAction;
            menu.remove();
            item.classList.remove('menu-open');

            if (action === 'edit') {
              const video = document.querySelector('video');
              if (video) {
                showAnnotationPopup(annotation, video, false);
                setTimeout(() => {
                  if (state.activePopup) enterEditMode(state.activePopup, annotation, video);
                }, 50);
              }
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
          if (!menu.contains(ev.target) && ev.target !== sidebarActionsBtn) {
            menu.remove();
            item.classList.remove('menu-open');
            document.removeEventListener('click', closeMenu, true);
          }
        };
        setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
      });
    }
  });
}
