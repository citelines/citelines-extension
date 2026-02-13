/**
 * YouTube Annotator Login/Register UI
 * Modal interface for authentication
 */

class LoginUI {
  constructor(authManager, onLoginSuccess) {
    this.authManager = authManager;
    this.onLoginSuccess = onLoginSuccess;
    this.modal = null;
    this.currentMode = 'login'; // 'login' or 'register'
  }

  /**
   * Show the login/register modal
   * @param {string} mode - 'login' or 'register'
   */
  show(mode = 'login') {
    this.currentMode = mode;
    this.createModal();
    document.body.appendChild(this.modal);
    this.modal.style.display = 'flex';
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
   * Create the modal HTML
   */
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'yt-annotator-auth-modal';
    modal.innerHTML = `
      <div class="yt-annotator-auth-content">
        <button class="yt-annotator-auth-close">&times;</button>

        <div class="yt-annotator-auth-header">
          <h2 id="yt-annotator-auth-title">
            ${this.currentMode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <p class="yt-annotator-auth-subtitle">
            ${this.currentMode === 'login'
              ? 'Placeholder - Does Not Work Yet (2/12/2026)'
              : 'Create an account to preserve your citations permanently'}
          </p>
        </div>

        <div id="yt-annotator-auth-message" class="yt-annotator-auth-message" style="display: none;"></div>

        <!-- Login Form -->
        <form id="yt-annotator-login-form" style="display: ${this.currentMode === 'login' ? 'block' : 'none'};">
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
      </div>
    `;

    this.modal = modal;
    this.attachEventListeners();
  }

  /**
   * Attach event listeners to modal elements
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.modal.querySelector('.yt-annotator-auth-close');
    closeBtn.addEventListener('click', () => this.hide());

    // Click outside to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // Form switches
    const switchToRegister = this.modal.querySelector('#yt-annotator-switch-to-register');
    switchToRegister.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchMode('register');
    });

    const switchToLogin = this.modal.querySelector('#yt-annotator-switch-to-login');
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      this.switchMode('login');
    });

    // Login form
    const loginForm = this.modal.querySelector('#yt-annotator-login-form');
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Register form
    const registerForm = this.modal.querySelector('#yt-annotator-register-form');
    registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Forgot password
    const forgotPassword = this.modal.querySelector('#yt-annotator-forgot-password');
    forgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleForgotPassword();
    });
  }

  /**
   * Switch between login and register forms
   */
  switchMode(mode) {
    this.currentMode = mode;
    const loginForm = this.modal.querySelector('#yt-annotator-login-form');
    const registerForm = this.modal.querySelector('#yt-annotator-register-form');
    const title = this.modal.querySelector('#yt-annotator-auth-title');
    const subtitle = this.modal.querySelector('.yt-annotator-auth-subtitle');

    if (mode === 'login') {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      title.textContent = 'Sign In';
      subtitle.textContent = 'Sign in to sync your citations across devices';
    } else {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      title.textContent = 'Create Account';
      subtitle.textContent = 'Create an account to preserve your citations permanently';
    }

    this.hideMessage();
  }

  /**
   * Handle login form submission
   */
  async handleLogin() {
    const email = this.modal.querySelector('#login-email').value;
    const password = this.modal.querySelector('#login-password').value;

    this.showMessage('Signing in...', 'info');

    try {
      await this.authManager.login(email, password);
      this.showMessage('Login successful!', 'success');

      setTimeout(() => {
        this.hide();
        if (this.onLoginSuccess) {
          this.onLoginSuccess();
        }
      }, 1000);
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Handle register form submission
   */
  async handleRegister() {
    const name = this.modal.querySelector('#register-name').value;
    const email = this.modal.querySelector('#register-email').value;
    const password = this.modal.querySelector('#register-password').value;
    const confirmPassword = this.modal.querySelector('#register-password-confirm').value;

    // Validate password match
    if (password !== confirmPassword) {
      this.showMessage('Passwords do not match', 'error');
      return;
    }

    // Validate password strength
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      this.showMessage('Password must include uppercase, lowercase, and numbers', 'error');
      return;
    }

    this.showMessage('Creating account...', 'info');

    try {
      // Get anonymous ID to preserve citations
      const anonymousId = await api.initialize();

      const result = await this.authManager.register({
        email,
        password,
        displayName: name,
        anonymousId // This upgrades the anonymous account
      });

      this.showMessage(
        `Account created! Check your email (${email}) to verify. The verification link was logged to the server console in dev mode.`,
        'success'
      );

      // Note: User needs to verify email before they can log in
      // In production, they would receive an email
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
      this.showMessage(
        'If that email is registered, you will receive a password reset link. Check the server console in dev mode.',
        'success'
      );
    } catch (error) {
      this.showMessage(error.message, 'error');
    }
  }

  /**
   * Show a message in the modal
   */
  showMessage(text, type = 'info') {
    const messageEl = this.modal.querySelector('#yt-annotator-auth-message');
    messageEl.textContent = text;
    messageEl.className = `yt-annotator-auth-message yt-annotator-auth-message-${type}`;
    messageEl.style.display = 'block';
  }

  /**
   * Hide the message
   */
  hideMessage() {
    const messageEl = this.modal?.querySelector('#yt-annotator-auth-message');
    if (messageEl) {
      messageEl.style.display = 'none';
    }
  }
}
