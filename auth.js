/**
 * YouTube Annotator Authentication Manager
 * Handles JWT token storage and user authentication
 */

class AuthManager {
  constructor() {
    this.token = null;
    this.user = null;
    this.baseUrl = 'https://youtube-annotator-production.up.railway.app/api';
  }

  /**
   * Initialize auth manager - load token from storage
   * @returns {Promise<boolean>} True if user is logged in
   */
  async initialize() {
    const result = await chrome.storage.local.get(['jwtToken', 'currentUser']);

    if (result.jwtToken && result.currentUser) {
      this.token = result.jwtToken;
      this.user = result.currentUser;

      // Verify token is still valid
      const isValid = await this.verifyToken();
      if (isValid) {
        console.log('[Auth] Logged in as:', this.user.displayName);
        return true;
      } else {
        // Token expired, clear it
        await this.logout();
        return false;
      }
    }

    return false;
  }

  /**
   * Check if user is currently logged in
   * @returns {boolean}
   */
  isLoggedIn() {
    return this.token !== null && this.user !== null;
  }

  /**
   * Get current user info
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Get JWT token
   * @returns {string|null}
   */
  getToken() {
    return this.token;
  }

  /**
   * Register a new account (or upgrade anonymous account)
   * @param {Object} params - { email, password, displayName, anonymousId? }
   * @returns {Promise<Object>} Registration result
   */
  async register({ email, password, displayName, anonymousId = null }) {
    const response = await fetch(`${this.baseUrl}/auth/register-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        anonymousId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Registration failed');
    }

    const data = await response.json();
    return data;
  }

  /**
   * Verify email with token
   * @param {string} token - Verification token from email
   * @returns {Promise<Object>}
   */
  async verifyEmail(token) {
    const response = await fetch(`${this.baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Verification failed');
    }

    return await response.json();
  }

  /**
   * Login with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>} User data and token
   */
  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Login failed');
    }

    const data = await response.json();

    // Store token and user info
    this.token = data.token;
    this.user = data.user;

    await chrome.storage.local.set({
      jwtToken: this.token,
      currentUser: this.user
    });

    console.log('[Auth] Logged in successfully as:', this.user.displayName);
    return data;
  }

  /**
   * Logout - clear token and user data
   * @returns {Promise<void>}
   */
  async logout() {
    this.token = null;
    this.user = null;

    await chrome.storage.local.remove(['jwtToken', 'currentUser']);
    console.log('[Auth] Logged out');
  }

  /**
   * Request password reset
   * @param {string} email
   * @returns {Promise<Object>}
   */
  async forgotPassword(email) {
    const response = await fetch(`${this.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Request failed');
    }

    return await response.json();
  }

  /**
   * Reset password with token
   * @param {string} token
   * @param {string} newPassword
   * @returns {Promise<Object>}
   */
  async resetPassword(token, newPassword) {
    const response = await fetch(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token, newPassword })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.message || 'Reset failed');
    }

    return await response.json();
  }

  /**
   * Verify current token is still valid
   * @returns {Promise<boolean>}
   */
  async verifyToken() {
    if (!this.token) return false;

    try {
      const response = await fetch(`${this.baseUrl}/shares/me?limit=1`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      // Only treat an explicit 401 as an invalid token — not network errors
      if (response.status === 401) return false;
      return true;
    } catch (error) {
      // Network error — assume token is still valid to avoid spurious logouts
      console.warn('[Auth] Token verification request failed, assuming valid:', error);
      return true;
    }
  }

  /**
   * Get account expiry information
   * @returns {Promise<Object|null>} Expiry info or null if logged in
   */
  async getExpiryInfo() {
    // Only relevant for anonymous users
    if (this.isLoggedIn()) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/expiry-info`, {
        headers: {
          'X-Anonymous-ID': await api.initialize()
        }
      });

      if (!response.ok) return null;

      return await response.json();
    } catch (error) {
      console.error('[Auth] Failed to get expiry info:', error);
      return null;
    }
  }
}

// Create singleton instance
const authManager = new AuthManager();
