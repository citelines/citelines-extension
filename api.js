/**
 * YouTube Annotator API Client
 * Handles communication with the backend API
 */

class AnnotatorAPI {
  constructor() {
    // Production Railway backend
    this.baseUrl = 'https://youtube-annotator-production.up.railway.app/api';
    this.anonymousId = null;
    this.authManager = null; // Will be set after authManager is initialized
  }

  /**
   * Set auth manager reference
   * @param {AuthManager} manager
   */
  setAuthManager(manager) {
    this.authManager = manager;
  }

  /**
   * Get authentication headers (JWT or anonymous ID)
   * @returns {Promise<Object>} Headers object
   */
  async getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    // Priority 1: Use JWT token if logged in
    if (this.authManager && this.authManager.isLoggedIn()) {
      headers['Authorization'] = `Bearer ${this.authManager.getToken()}`;
      return headers;
    }

    // Priority 2: Use anonymous ID
    await this.initialize();
    if (this.anonymousId) {
      headers['X-Anonymous-ID'] = this.anonymousId;
    }

    return headers;
  }

  /**
   * Get storage key for anonymous ID (different for incognito mode)
   * @returns {string} Storage key
   */
  getStorageKey() {
    // Use different storage keys for incognito vs regular mode
    // This ensures each context has its own anonymous ID
    const isIncognito = chrome.extension.inIncognitoContext;
    return isIncognito ? 'anonymousId_incognito' : 'anonymousId';
  }

  /**
   * Initialize the API client - get or create anonymous ID
   * @returns {Promise<string>} Anonymous ID
   */
  async initialize() {
    if (this.anonymousId) {
      return this.anonymousId;
    }

    const storageKey = this.getStorageKey();
    const isIncognito = chrome.extension.inIncognitoContext;

    // Try to get existing anonymous ID from storage
    const result = await chrome.storage.local.get([storageKey]);

    if (result[storageKey]) {
      this.anonymousId = result[storageKey];
      console.log(`[DEBUG] Using existing anonymous ID (${isIncognito ? 'incognito' : 'regular'}):`, this.anonymousId.substring(0, 8) + '...');
      return this.anonymousId;
    }

    // Register new anonymous user
    try {
      const data = await this.registerAnonymousUser();
      this.anonymousId = data.anonymousId;

      // Save to storage with appropriate key
      await chrome.storage.local.set({ [storageKey]: this.anonymousId });
      console.log(`[DEBUG] Registered new anonymous user (${isIncognito ? 'incognito' : 'regular'}):`, this.anonymousId.substring(0, 8) + '...');

      return this.anonymousId;
    } catch (error) {
      console.error('Failed to initialize API:', error);
      throw error;
    }
  }

  /**
   * Register a new anonymous user
   * @returns {Promise<Object>} User data
   */
  async registerAnonymousUser() {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to register user');
    }

    return await response.json();
  }

  /**
   * Create a share
   * @param {string} videoId - YouTube video ID
   * @param {Array} annotations - Array of annotation objects
   * @param {string} title - Optional title
   * @returns {Promise<Object>} Share data with token and URL
   */
  async createShare(videoId, annotations, title = null) {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.baseUrl}/shares`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        videoId,
        title,
        annotations,
        isPublic: true
      })
    });

    if (!response.ok) {
      const error = await response.json();

      // If user not found (401), re-register and retry
      if (response.status === 401 && error.message && error.message.includes('User not found')) {
        console.log('[DEBUG] User not found in database, re-registering...');

        // Clear old anonymous ID and re-register
        const storageKey = this.getStorageKey();
        await chrome.storage.local.remove([storageKey]);
        this.anonymousId = null;

        // Re-initialize (will register new user)
        await this.initialize();

        // Retry the create share request
        return this.createShare(videoId, annotations, title);
      }

      // Handle suspension/block errors
      if (response.status === 403 && (error.suspended || error.blocked)) {
        const customError = new Error(error.message || 'Account suspended or blocked');
        customError.suspended = error.suspended;
        customError.blocked = error.blocked;
        customError.suspendedUntil = error.suspendedUntil;
        throw customError;
      }

      throw new Error(error.message || 'Failed to create share');
    }

    return await response.json();
  }

  /**
   * Get shared annotations by token
   * @param {string} shareToken - Share token from URL
   * @returns {Promise<Object>} Share data with annotations
   */
  async getShare(shareToken) {
    const headers = await this.getAuthHeaders();
    delete headers['Content-Type']; // Not needed for GET

    const response = await fetch(`${this.baseUrl}/shares/${shareToken}`, {
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get share');
    }

    return await response.json();
  }

  /**
   * Get shares for a video
   * @param {string} videoId - YouTube video ID
   * @param {number} limit - Max results
   * @param {number} offset - Pagination offset
   * @returns {Promise<Object>} List of shares
   */
  async getSharesForVideo(videoId, limit = 50, offset = 0) {
    const response = await fetch(
      `${this.baseUrl}/shares/video/${videoId}?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get shares');
    }

    return await response.json();
  }

  /**
   * Get current user's shares
   * @param {number} limit - Max results
   * @param {number} offset - Pagination offset
   * @returns {Promise<Object>} List of user's shares
   */
  async getMyShares(limit = 50, offset = 0) {
    const headers = await this.getAuthHeaders();
    delete headers['Content-Type']; // Not needed for GET

    const response = await fetch(
      `${this.baseUrl}/shares/me?limit=${limit}&offset=${offset}`,
      {
        headers
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get shares');
    }

    return await response.json();
  }

  /**
   * Update a share
   * @param {string} shareToken - Share token
   * @param {Object} updates - Fields to update (title, annotations, isPublic)
   * @returns {Promise<Object>} Updated share data
   */
  async updateShare(shareToken, updates) {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.baseUrl}/shares/${shareToken}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();

      // Handle suspension/block errors
      if (response.status === 403 && (error.suspended || error.blocked)) {
        const customError = new Error(error.message || 'Account suspended or blocked');
        customError.suspended = error.suspended;
        customError.blocked = error.blocked;
        customError.suspendedUntil = error.suspendedUntil;
        throw customError;
      }

      throw new Error(error.message || 'Failed to update share');
    }

    return await response.json();
  }

  /**
   * Delete a share
   * @param {string} shareToken - Share token
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteShare(shareToken) {
    const headers = await this.getAuthHeaders();
    delete headers['Content-Type']; // Not needed for DELETE

    const response = await fetch(`${this.baseUrl}/shares/${shareToken}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete share');
    }

    return await response.json();
  }

  /**
   * Check API health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    const response = await fetch(`${this.baseUrl}/health`);

    if (!response.ok) {
      throw new Error('API health check failed');
    }

    return await response.json();
  }
}

// Create singleton instance
const api = new AnnotatorAPI();
