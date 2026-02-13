/**
 * YouTube Annotator User Profile UI
 * Modal displaying user statistics and activity
 */

class UserProfileUI {
  constructor() {
    this.modal = null;
  }

  /**
   * Show user profile modal
   * @param {string} userId - User ID to fetch profile for
   * @param {string} displayName - Display name (for immediate display)
   * @param {boolean} isOwn - Whether this is the current user's profile
   */
  async show(userId, displayName, isOwn = false) {
    this.isOwn = isOwn;
    const headerName = isOwn ? `YOU - ${displayName}` : displayName;
    this.createModal(headerName);
    document.body.appendChild(this.modal);
    this.modal.style.display = 'flex';

    // Fetch user profile data
    await this.loadProfileData(userId);
  }

  /**
   * Hide and remove the modal
   */
  hide() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }

  /**
   * Create the modal HTML with loading state
   */
  createModal(displayName) {
    const modal = document.createElement('div');
    modal.className = 'yt-annotator-user-profile-modal';
    modal.innerHTML = `
      <div class="yt-annotator-user-profile-content">
        <button class="yt-annotator-user-profile-close">&times;</button>

        <div class="yt-annotator-user-profile-header">
          <h2 id="yt-annotator-profile-name">${this.escapeHtml(displayName)}</h2>
          <p class="yt-annotator-profile-subtitle">Loading profile...</p>
        </div>

        <div id="yt-annotator-profile-body" class="yt-annotator-profile-loading">
          <div class="yt-annotator-spinner"></div>
        </div>
      </div>
    `;

    this.modal = modal;
    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.modal.querySelector('.yt-annotator-user-profile-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Escape key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.hide();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  /**
   * Load user profile data from API
   */
  async loadProfileData(userId) {
    try {
      const response = await fetch(`https://youtube-annotator-production.up.railway.app/api/users/${userId}/profile`);

      if (!response.ok) {
        throw new Error('Failed to load profile');
      }

      const profile = await response.json();
      this.renderProfile(profile);
    } catch (error) {
      console.error('[Profile] Failed to load:', error);
      this.renderError('Failed to load user profile');
    }
  }

  /**
   * Render profile data
   */
  renderProfile(profile) {
    const nameElement = this.modal.querySelector('#yt-annotator-profile-name');
    const subtitle = this.modal.querySelector('.yt-annotator-profile-subtitle');
    const body = this.modal.querySelector('#yt-annotator-profile-body');

    // Update name with profile data
    if (profile.displayName) {
      const displayName = this.isOwn ? `YOU - ${profile.displayName}` : profile.displayName;
      nameElement.textContent = displayName;

      // Apply grey color for other users
      if (!this.isOwn) {
        nameElement.style.color = '#888';
      }
    }

    // Update subtitle
    const accountType = profile.authType === 'password' ? 'Registered' : 'Temporary account';
    const joinDate = this.formatJoinDate(profile.accountCreated);
    subtitle.textContent = `${accountType} • Contributor since ${joinDate}`;

    // Render stats
    body.className = 'yt-annotator-profile-body';
    body.innerHTML = `
      <div class="yt-annotator-profile-stats">
        <div class="yt-annotator-profile-stat">
          <div class="yt-annotator-profile-stat-value">${profile.stats.totalCitations}</div>
          <div class="yt-annotator-profile-stat-label">Citations</div>
        </div>
        <div class="yt-annotator-profile-stat">
          <div class="yt-annotator-profile-stat-value">${profile.stats.totalVideos}</div>
          <div class="yt-annotator-profile-stat-label">Videos</div>
        </div>
      </div>

      ${profile.videos && profile.videos.length > 0 ? `
        <div class="yt-annotator-profile-section">
          <h3>Recent Videos</h3>
          <div class="yt-annotator-profile-videos">
            ${profile.videos.map(video => `
              <a href="https://youtube.com/watch?v=${video.videoId}"
                 class="yt-annotator-profile-video"
                 target="_blank"
                 rel="noopener noreferrer">
                <div class="yt-annotator-profile-video-title">${this.escapeHtml(video.title || 'YouTube Video')}</div>
                <div class="yt-annotator-profile-video-stats">${video.citationCount} citation${video.citationCount !== 1 ? 's' : ''}</div>
              </a>
            `).join('')}
          </div>
        </div>
      ` : '<p class="yt-annotator-profile-empty">No citations yet</p>'}

      ${profile.karma !== null || profile.approvalRate !== null ? `
        <div class="yt-annotator-profile-section">
          <h3>Reputation</h3>
          <div class="yt-annotator-profile-reputation">
            ${profile.karma !== null ? `
              <div class="yt-annotator-profile-karma">
                <span class="yt-annotator-profile-karma-label">Karma:</span>
                <span class="yt-annotator-profile-karma-value">${profile.karma}</span>
              </div>
            ` : ''}
            ${profile.approvalRate !== null ? `
              <div class="yt-annotator-profile-approval">
                <span class="yt-annotator-profile-approval-label">Approval Rate:</span>
                <span class="yt-annotator-profile-approval-value">${profile.approvalRate}%</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * Render error state
   */
  renderError(message) {
    const body = this.modal.querySelector('#yt-annotator-profile-body');
    body.className = 'yt-annotator-profile-error';
    body.innerHTML = `<p>${this.escapeHtml(message)}</p>`;
  }

  /**
   * Format join date as "Month Year"
   */
  formatJoinDate(createdAt) {
    const created = new Date(createdAt);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[created.getMonth()]} ${created.getFullYear()}`;
  }

  /**
   * Calculate account age
   */
  getAccountAge(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Less than a day';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 60) return '1 month';
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    if (diffDays < 730) return '1 year';
    return `${Math.floor(diffDays / 365)} years`;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
