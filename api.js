/**
 * YouTube Annotator API Client
 * Handles communication with the backend API
 */

class AnnotatorAPI {
  constructor() {
    // Production Railway backend
    this.baseUrl = 'https://youtube-annotator-production.up.railway.app/api';
    this.anonymousId = null;
  }

  /**
   * Initialize the API client - get or create anonymous ID
   * @returns {Promise<string>} Anonymous ID
   */
  async initialize() {
    if (this.anonymousId) {
      return this.anonymousId;
    }

    // Try to get existing anonymous ID from storage
    const result = await chrome.storage.local.get(['anonymousId']);

    if (result.anonymousId) {
      this.anonymousId = result.anonymousId;
      console.log('[DEBUG] Using existing anonymous ID:', this.anonymousId.substring(0, 8) + '...');
      return this.anonymousId;
    }

    // Register new anonymous user
    try {
      const data = await this.registerAnonymousUser();
      this.anonymousId = data.anonymousId;

      // Save to storage
      await chrome.storage.local.set({ anonymousId: this.anonymousId });
      console.log('[DEBUG] Registered new anonymous user:', this.anonymousId.substring(0, 8) + '...');

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
    await this.initialize();

    const response = await fetch(`${this.baseUrl}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Anonymous-ID': this.anonymousId
      },
      body: JSON.stringify({
        videoId,
        title,
        annotations,
        isPublic: true
      })
    });

    if (!response.ok) {
      const error = await response.json();
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
    await this.initialize();

    const response = await fetch(`${this.baseUrl}/shares/${shareToken}`, {
      headers: {
        'X-Anonymous-ID': this.anonymousId
      }
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
    await this.initialize();

    const response = await fetch(
      `${this.baseUrl}/shares/me?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'X-Anonymous-ID': this.anonymousId
        }
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
    await this.initialize();

    const response = await fetch(`${this.baseUrl}/shares/${shareToken}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Anonymous-ID': this.anonymousId
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();
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
    await this.initialize();

    const response = await fetch(`${this.baseUrl}/shares/${shareToken}`, {
      method: 'DELETE',
      headers: {
        'X-Anonymous-ID': this.anonymousId
      }
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
