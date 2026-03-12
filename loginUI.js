/**
 * YouTube Annotator Login/Register UI
 * Renders auth forms into a provided container element (the account sidebar)
 */

class LoginUI {
  constructor(authManager, onLoginSuccess, onClose) {
    this.authManager = authManager;
    this.onLoginSuccess = onLoginSuccess;
    this.onClose = onClose;
    this.container = null;
    this.currentMode = 'login';
  }

  /**
   * Render the auth form into a container element
   * @param {HTMLElement} container - Element to render into
   * @param {string} mode - 'login' or 'register'
   */
  show(container, mode = 'login') {
    this.container = container;
    this.currentMode = mode;
    this.render();
  }

  /**
   * Signal close (called by the sidebar close button)
   */
  hide() {
    this.container = null;
    if (this.onClose) this.onClose();
  }

  /**
   * Render form HTML into the container
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="yt-annotator-auth-header">
        <h2 id="yt-annotator-auth-title">
          ${this.currentMode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
        <p class="yt-annotator-auth-subtitle">
          ${this.currentMode === 'login'
            ? 'Sign in to sync your citations across devices'
            : 'Create an account to preserve your citations permanently'}
        </p>
      </div>

      <div id="yt-annotator-auth-message" class="yt-annotator-auth-message" style="display: none;"></div>

      <!-- Login Form -->
      <form id="yt-annotator-login-form" style="display: ${this.currentMode === 'login' ? 'block' : 'none'};">
        <button type="button" id="yt-oauth-login-btn" class="yt-annotator-youtube-auth-button">&#9654; Continue with YouTube</button>
        <p class="yt-annotator-youtube-auth-hint">Sign in with YouTube to add citations to videos you own, visible to all Citelines users.</p>
        <div class="yt-annotator-auth-divider">or</div>
        <div class="yt-annotator-form-group">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="your@email.com" required autocomplete="email">
        </div>
        <div class="yt-annotator-form-group">
          <label>Password</label>
          <input type="password" id="login-password" placeholder="Enter password" required autocomplete="current-password">
        </div>
        <button type="submit" class="yt-annotator-auth-button">Sign In</button>
        <div class="yt-annotator-auth-links">
          <a href="#" id="yt-annotator-forgot-password">Forgot password?</a>
          <a href="#" id="yt-annotator-switch-to-register">Create account</a>
        </div>
      </form>

      <!-- Register Form -->
      <form id="yt-annotator-register-form" style="display: ${this.currentMode === 'register' ? 'block' : 'none'};">
        <button type="button" id="yt-oauth-register-btn" class="yt-annotator-youtube-auth-button">&#9654; Continue with YouTube</button>
        <p class="yt-annotator-youtube-auth-hint">Sign in with YouTube to add citations to videos you own, visible to all Citelines users.</p>
        <div class="yt-annotator-auth-divider">or</div>
        <div class="yt-annotator-form-group">
          <label>Display Name</label>
          <input type="text" id="register-name" placeholder="How should we call you?" required minlength="2" maxlength="50">
        </div>
        <div class="yt-annotator-form-group">
          <label>Email</label>
          <input type="email" id="register-email" placeholder="your@email.com" required autocomplete="email">
        </div>
        <div class="yt-annotator-form-group">
          <label>Password</label>
          <input type="password" id="register-password" placeholder="At least 8 characters" required minlength="8" autocomplete="new-password">
          <small>Must include uppercase, lowercase, and numbers</small>
        </div>
        <div class="yt-annotator-form-group">
          <label>Confirm Password</label>
          <input type="password" id="register-password-confirm" placeholder="Re-enter password" required minlength="8" autocomplete="new-password">
        </div>
        <button type="submit" class="yt-annotator-auth-button">Create Account</button>
        <div class="yt-annotator-auth-links">
          <a href="#" id="yt-annotator-switch-to-login">Already have an account?</a>
        </div>
      </form>
    `;

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const q = (sel) => this.container.querySelector(sel);

    q('#yt-annotator-switch-to-register').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchMode('register');
    });

    q('#yt-annotator-switch-to-login').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchMode('login');
    });

    q('#yt-annotator-login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    q('#yt-annotator-register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    q('#yt-annotator-forgot-password').addEventListener('click', (e) => {
      e.preventDefault();
      this.handleForgotPassword();
    });

    q('#yt-oauth-login-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.handleYouTubeAuth();
    });

    q('#yt-oauth-register-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this.handleYouTubeAuth();
    });
  }

  /**
   * Switch between login and register forms
   */
  switchMode(mode) {
    this.currentMode = mode;
    const q = (sel) => this.container.querySelector(sel);

    if (mode === 'login') {
      q('#yt-annotator-login-form').style.display = 'block';
      q('#yt-annotator-register-form').style.display = 'none';
      q('#yt-annotator-auth-title').textContent = 'Sign In';
      q('.yt-annotator-auth-subtitle').textContent = 'Sign in to sync your citations across devices';
    } else {
      q('#yt-annotator-login-form').style.display = 'none';
      q('#yt-annotator-register-form').style.display = 'block';
      q('#yt-annotator-auth-title').textContent = 'Create Account';
      q('.yt-annotator-auth-subtitle').textContent = 'Create an account to preserve your citations permanently';
    }

    this.hideMessage();
  }

  /**
   * Handle login form submission
   */
  async handleLogin() {
    const q = (sel) => this.container.querySelector(sel);
    const email = q('#login-email').value;
    const password = q('#login-password').value;

    this.showMessage('Signing in...', 'info');

    try {
      await this.authManager.login(email, password);
      this.showMessage('Login successful!', 'success');
      setTimeout(() => {
        if (this.onLoginSuccess) this.onLoginSuccess();
      }, 800);
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Handle register form submission
   */
  async handleRegister() {
    const q = (sel) => this.container.querySelector(sel);
    const name = q('#register-name').value;
    const email = q('#register-email').value;
    const password = q('#register-password').value;
    const confirmPassword = q('#register-password-confirm').value;

    if (password !== confirmPassword) {
      this.showMessage('Passwords do not match', 'error');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      this.showMessage('Password must include uppercase, lowercase, and numbers', 'error');
      return;
    }

    this.showMessage('Creating account...', 'info');

    try {
      const anonymousId = await api.initialize();
      await this.authManager.register({ email, password, displayName: name, anonymousId });
      this.showRegistrationSuccess(email);
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Handle forgot password
   */
  async handleForgotPassword() {
    const email = prompt('Enter your email address:');
    if (!email) return;

    try {
      await this.authManager.forgotPassword(email);
      this.showMessage('If that email is registered, you will receive a password reset link.', 'success');
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Handle YouTube OAuth button click
   */
  async handleYouTubeAuth() {
    this.showMessage('Opening YouTube sign-in...', 'info');

    try {
      const anonymousId = await api.initialize();
      await loginWithYouTube(api, this.authManager, null, anonymousId, (msg) => this.showMessage(msg, 'info'));
      this.showMessage('Signed in!', 'success');
      setTimeout(() => {
        if (this.onLoginSuccess) this.onLoginSuccess();
      }, 800);
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Show a YouTube name picker inline and resolve with the chosen name
   * Called by youtubeAuth.js when needsDisplayName is true
   * @param {string} suggestedName
   * @returns {Promise<string>} Chosen display name
   */
  promptDisplayName(suggestedName) {
    return new Promise((resolve, reject) => {
      if (!this.container) return reject(new Error('No container'));

      const pickerId = 'yt-annotator-name-picker';
      const existing = this.container.querySelector(`#${pickerId}`);
      if (existing) existing.remove();

      const picker = document.createElement('div');
      picker.id = pickerId;
      picker.style.cssText = 'margin-bottom: 16px;';
      picker.innerHTML = `
        <label style="display:block; font-size:13px; color:#ccc; margin-bottom:6px; font-weight:500;">
          Choose a display name
        </label>
        <div style="display:flex; gap:8px;">
          <input type="text" id="yt-name-input" value="${suggestedName.replace(/"/g, '&quot;')}"
            maxlength="50" style="flex:1; background:#2a2a2a; border:1px solid #444; border-radius:6px;
            padding:8px 10px; color:#fff; font-size:14px; box-sizing:border-box;">
          <button id="yt-name-confirm" style="background:#0497a6; color:#000; border:none;
            border-radius:6px; padding:8px 14px; font-size:14px; font-weight:600; cursor:pointer;">
            OK
          </button>
        </div>
      `;

      const authBody = this.container.querySelector('#yt-annotator-auth-message');
      if (authBody) {
        authBody.after(picker);
      } else {
        this.container.prepend(picker);
      }

      const input = picker.querySelector('#yt-name-input');
      const confirmBtn = picker.querySelector('#yt-name-confirm');

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); confirmBtn.click(); }
      });
      input.addEventListener('keyup', (e) => e.stopPropagation());
      input.focus();

      confirmBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (!name || name.length < 2) {
          input.style.borderColor = '#f44336';
          return;
        }
        picker.remove();
        resolve(name);
      });
    });
  }

  /**
   * Show a status message
   */
  showMessage(text, type = 'info') {
    if (!this.container) return;
    const messageEl = this.container.querySelector('#yt-annotator-auth-message');
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.className = `yt-annotator-auth-message yt-annotator-auth-message-${type}`;
    messageEl.style.display = 'block';
  }

  /**
   * Hide the status message
   */
  hideMessage() {
    const messageEl = this.container?.querySelector('#yt-annotator-auth-message');
    if (messageEl) messageEl.style.display = 'none';
  }

  /**
   * Replace form content with a registration success screen
   */
  showRegistrationSuccess(email) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0;">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">✉️</div>
        <h2 style="margin: 0 0 0.75rem; color: #0497a6;">Check your email</h2>
        <p style="color: #ccc; margin: 0 0 1.5rem; line-height: 1.5;">
          We sent a verification link to<br><strong style="color: #fff;">${email}</strong>
        </p>
        <p style="color: #aaa; font-size: 0.85rem; margin: 0;">
          Click the link in the email to activate your account, then sign in.
        </p>
      </div>
    `;
  }
}
window.LoginUI = LoginUI;
