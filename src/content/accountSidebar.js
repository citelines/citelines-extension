// Account sidebar: login, profile, YouTube verification, sign out

import * as state from './state.js';
import { api, authManager, LoginUI, connectYouTubeChannel } from './globals.js';
import { escapeHtml, getInitials } from './utils.js';
import { isCreatorMode, updateCreatorMode } from './creatorMode.js';
import { refreshMarkerColors, renderMarkers } from './markers.js';
import { fetchAllAnnotations } from './fetchAnnotations.js';
import { toggleSidebar } from './annotationsSidebar.js';

// Populate the login button based on current auth state
export function updateLoginButton() {
  if (!state.loginButton) return;
  const sidebarWasOpen = state.loginButton.classList.contains('sidebar-open');

  if (authManager.isLoggedIn()) {
    const user = authManager.getCurrentUser();
    const initials = getInitials(user.displayName);
    state.loginButton.className = 'yt-annotator-user-badge';
    state.loginButton.innerHTML = `<span class="yt-annotator-user-initials">${escapeHtml(initials)}</span>`;
    state.loginButton.title = `Logged in as ${user.displayName} - Click to logout`;
  } else {
    state.loginButton.className = 'yt-annotator-login-btn';
    state.loginButton.innerHTML = '👤';
    state.loginButton.title = 'Sign in or create account';
  }

  if (sidebarWasOpen) state.loginButton.classList.add('sidebar-open');
}

// Create the login/user button shell immediately, populate after auth init
export function createLoginButton() {
  if (state.loginButton) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const btn = document.createElement('button');
  btn.className = 'yt-annotator-user-badge';
  btn.innerHTML = '';
  btn.title = 'Loading...';

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleLoginButtonClick();
  });

  playerContainer.appendChild(btn);
  state.setLoginButton(btn);
}

// Create the account sidebar
function createAccountSidebar() {
  if (state.accountSidebar) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const sb = document.createElement('div');
  sb.className = 'yt-annotator-account-sidebar';

  sb.addEventListener('keydown', (e) => e.stopPropagation());
  sb.addEventListener('keypress', (e) => e.stopPropagation());
  sb.addEventListener('keyup', (e) => e.stopPropagation());

  playerContainer.appendChild(sb);
  state.setAccountSidebar(sb);
}

// Show merge confirmation dialog in the account sidebar.
function showMergeConfirmation(mergeData, sidebar) {
  const body = sidebar.querySelector('.yt-annotator-account-sidebar-body');
  if (!body) return;

  const name = mergeData.secondaryDisplayName || 'YouTube account';
  const count = mergeData.secondaryShareCount || 0;

  const mergeHtml = `
    <div class="yt-annotator-merge-prompt">
      <p style="color:#ccc; font-size:0.85rem; line-height:1.5; margin:0.75rem 0;">
        Your YouTube channel is already linked to another account
        (<strong style="color:#fff;">${escapeHtml(name)}</strong>) with
        <strong style="color:#fff;">${count}</strong> citation${count !== 1 ? 's' : ''}.
        Merge into this account?
      </p>
      <div style="display:flex; gap:8px; margin-top:0.75rem;">
        <button class="yt-annotator-merge-confirm"
          style="flex:1; background:#0497a6; color:#000; border:none; border-radius:6px;
                 padding:8px 12px; font-size:0.82rem; font-weight:600; cursor:pointer;">
          Merge Accounts
        </button>
        <button class="yt-annotator-merge-cancel"
          style="flex:1; background:transparent; color:#aaa; border:1px solid #555;
                 border-radius:6px; padding:8px 12px; font-size:0.82rem; cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;

  const connectBtn = body.querySelector('.yt-annotator-connect-yt-btn');
  if (connectBtn) {
    connectBtn.insertAdjacentHTML('afterend', mergeHtml);
    connectBtn.remove();
  } else {
    body.insertAdjacentHTML('beforeend', mergeHtml);
  }

  body.querySelector('.yt-annotator-merge-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    updateAccountSidebarContent();
  });

  body.querySelector('.yt-annotator-merge-confirm').addEventListener('click', async (e) => {
    e.stopPropagation();
    const btn = e.target;
    btn.textContent = 'Merging...';
    btn.disabled = true;

    try {
      await authManager.mergeWithYouTube(mergeData._accessToken);
      updateAccountSidebarContent();
      if (state.currentVideoId) fetchAllAnnotations(state.currentVideoId);
    } catch (err) {
      console.error('[Auth] Merge failed:', err);
      btn.textContent = 'Merge failed';
      btn.style.background = '#f44336';
      btn.style.color = '#fff';
      setTimeout(() => updateAccountSidebarContent(), 2000);
    }
  });
}

// Populate account sidebar based on auth state
export function updateAccountSidebarContent() {
  if (!state.accountSidebar) return;

  if (authManager.isLoggedIn()) {
    const user = authManager.getCurrentUser();
    const initials = getInitials(user.displayName);

    const ytVerified = authManager.isYouTubeVerified();
    const ytTitle = user.youtubeChannelTitle || '';
    const ytSection = ytVerified
      ? `<div class="yt-annotator-yt-status">&#10003; YouTube: ${escapeHtml(ytTitle)}</div>`
      : `<button class="yt-annotator-connect-yt-btn">Verify as YouTube Creator</button>`;

    const bannedBanner = authManager.isBanned()
      ? `<div style="background: #f44336; color: white; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 10px; text-align: center;">Your account is suspended. You can view citations but cannot create or edit them.</div>`
      : '';

    state.accountSidebar.innerHTML = `
      <div class="yt-annotator-sidebar-header">
        <h3>Account</h3>
        <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
      </div>
      <div class="yt-annotator-account-sidebar-body">
        ${bannedBanner}
        <div class="yt-annotator-account-avatar">${escapeHtml(initials)}</div>
        <div class="yt-annotator-account-name">${escapeHtml(user.displayName)}</div>
        <div class="yt-annotator-account-email">${escapeHtml(user.email || '')}</div>
        ${ytSection}
        <div class="yt-annotator-account-stats">
          <div class="yt-annotator-account-stats-joined">Contributor since —</div>
          <div class="yt-annotator-account-stats-row">
            <div class="yt-annotator-account-stat"><span class="yt-annotator-account-stat-num">—</span> Citations</div>
            <div class="yt-annotator-account-stat"><span class="yt-annotator-account-stat-num">—</span> Videos</div>
          </div>
        </div>
        <a class="yt-annotator-account-settings-link" href="https://www.citelines.org/my-dashboard" target="_blank">My Dashboard</a>
        <a class="yt-annotator-account-settings-link" href="https://www.citelines.org/account-settings" target="_blank">Account Settings</a>
        <button class="yt-annotator-account-signout">Sign Out</button>
      </div>
    `;

    state.accountSidebar.querySelector('.yt-annotator-account-signout').addEventListener('click', async (e) => {
      e.stopPropagation();
      await authManager.logout();
      state.setUserShareId(null);
      toggleAccountSidebar();
      updateLoginButton();
      refreshMarkerColors();
      updateCreatorMode();
      if (state.currentVideoId) fetchAllAnnotations(state.currentVideoId);
    });

    // Fetch and populate usage stats
    const userId = user.id;
    if (userId) {
      fetch(`https://citelines-extension-production.up.railway.app/api/users/${userId}/profile`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(profile => {
          const joinedEl = state.accountSidebar?.querySelector('.yt-annotator-account-stats-joined');
          const statNums = state.accountSidebar?.querySelectorAll('.yt-annotator-account-stat-num');
          if (joinedEl && profile.accountCreated) {
            const d = new Date(profile.accountCreated);
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            joinedEl.textContent = `Contributor since ${months[d.getMonth()]} ${d.getFullYear()}`;
          }
          if (statNums && statNums.length >= 2) {
            statNums[0].textContent = profile.stats?.totalCitations ?? 0;
            statNums[1].textContent = profile.stats?.totalVideos ?? 0;
          }
        })
        .catch(() => {}); // silently fail — stats are non-critical
    }

    if (!ytVerified) {
      state.accountSidebar.querySelector('.yt-annotator-connect-yt-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const result = await connectYouTubeChannel(api, authManager, (msg) => {
            const statusEl = state.accountSidebar.querySelector('.yt-annotator-connect-yt-btn');
            if (statusEl) statusEl.textContent = msg;
          });

          if (result.needsMerge) {
            showMergeConfirmation(result, state.accountSidebar);
            return;
          }

          updateAccountSidebarContent();
          if (state.currentVideoId) fetchAllAnnotations(state.currentVideoId);
        } catch (err) {
          console.error('[Auth] YouTube connect failed:', err);
          const btn = state.accountSidebar.querySelector('.yt-annotator-connect-yt-btn');
          if (btn) btn.textContent = 'Connect YouTube Channel';
          alert(err.message || 'Failed to connect YouTube channel');
        }
      });
    }
  } else {
    state.accountSidebar.innerHTML = `
      <div class="yt-annotator-sidebar-header">
        <h3>Account</h3>
        <button class="yt-annotator-sidebar-close" title="Close">&times;</button>
      </div>
      <div class="yt-annotator-account-auth-body"></div>
    `;

    if (!state.loginUI) {
      state.setLoginUI(new LoginUI(authManager, handleLoginSuccess, toggleAccountSidebar));
    }
    state.loginUI.show(state.accountSidebar.querySelector('.yt-annotator-account-auth-body'), 'login');
  }

  state.accountSidebar.querySelector('.yt-annotator-sidebar-close').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAccountSidebar();
  });
}

// Toggle the account sidebar open/closed
export function toggleAccountSidebar() {
  // Close bibliography sidebar if open
  if (state.sidebarOpen) toggleSidebar();

  state.setAccountSidebarOpen(!state.accountSidebarOpen);

  if (state.accountSidebarOpen) {
    createAccountSidebar();
    updateAccountSidebarContent();
    if (isCreatorMode()) state.accountSidebar.classList.add('creator-mode');
    state.accountSidebar.classList.add('yt-annotator-sidebar-open');
    if (state.addButton) state.addButton.classList.add('sidebar-open');
    if (state.sidebarButton) state.sidebarButton.classList.add('sidebar-open');
    if (state.loginButton) state.loginButton.classList.add('sidebar-open');
  } else {
    if (state.accountSidebar) state.accountSidebar.classList.remove('yt-annotator-sidebar-open');
    if (state.addButton) state.addButton.classList.remove('sidebar-open');
    if (state.sidebarButton) state.sidebarButton.classList.remove('sidebar-open');
    if (state.loginButton) state.loginButton.classList.remove('sidebar-open');
  }
}

// Handle login button click — always opens the account sidebar
function handleLoginButtonClick() {
  toggleAccountSidebar();
}

// Handle successful login
export async function handleLoginSuccess() {
  console.log('[Auth] Login successful, refreshing UI...');

  updateLoginButton();
  refreshMarkerColors();
  updateCreatorMode();
  if (state.accountSidebarOpen) toggleAccountSidebar();
  if (state.currentVideoId) fetchAllAnnotations(state.currentVideoId);

  if (state.currentVideoId) {
    await fetchAllAnnotations(state.currentVideoId);
  }
}

// Check and show expiry warning if needed
export async function checkExpiryWarning() {
  if (authManager.isLoggedIn()) return;

  try {
    const expiryInfo = await authManager.getExpiryInfo();
    if (expiryInfo && expiryInfo.daysUntilExpiry !== null && expiryInfo.daysUntilExpiry <= 10) {
      showExpiryWarning(expiryInfo.daysUntilExpiry);
    }
  } catch (error) {
    console.error('[Auth] Failed to check expiry:', error);
  }
}

// Show expiry warning banner
function showExpiryWarning(daysLeft) {
  if (state.expiryWarning) return;

  const playerContainer = document.querySelector('#movie_player');
  if (!playerContainer) return;

  const warning = document.createElement('div');
  warning.className = 'yt-annotator-expiry-warning';
  warning.innerHTML = `
    <div class="yt-annotator-expiry-warning-text">
      ⚠️ Your account expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.
      Create an account to preserve your citations permanently.
    </div>
    <button>Sign Up</button>
  `;

  warning.querySelector('button').addEventListener('click', () => {
    if (!state.loginUI) {
      state.setLoginUI(new LoginUI(authManager, handleLoginSuccess));
    }
    state.loginUI.show('register');
  });

  playerContainer.appendChild(warning);
  state.setExpiryWarning(warning);
}
