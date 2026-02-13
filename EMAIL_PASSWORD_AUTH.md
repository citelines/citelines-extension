# Email/Password Authentication Implementation

## Architecture Overview

```
Regular Users:           YouTube Creators (Future):
Email/Password    →      Email/Password + Google OAuth
↓                        ↓
Basic features           Basic features + Creator tools
                         (verified badge, analytics, moderation)
```

---

## Database Schema

### Migration 004: Add Email/Password Auth

```sql
-- Update users table
ALTER TABLE users
  ADD COLUMN email VARCHAR(255) UNIQUE,
  ADD COLUMN password_hash VARCHAR(255),  -- bcrypt hash
  ADD COLUMN display_name VARCHAR(100),
  ADD COLUMN email_verified BOOLEAN DEFAULT false,
  ADD COLUMN email_verification_token VARCHAR(255),
  ADD COLUMN email_verification_expires TIMESTAMP,
  ADD COLUMN password_reset_token VARCHAR(255),
  ADD COLUMN password_reset_expires TIMESTAMP,
  ADD COLUMN linked_anonymous_id VARCHAR(255),  -- For account migration

  -- Future: Google OAuth for creators
  ADD COLUMN google_id VARCHAR(255) UNIQUE,
  ADD COLUMN is_youtube_creator BOOLEAN DEFAULT false,
  ADD COLUMN youtube_channel_id VARCHAR(255),
  ADD COLUMN creator_verified_at TIMESTAMP;

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);

-- Sessions table (for JWT alternative)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

---

## Backend Dependencies

```json
// package.json additions
{
  "dependencies": {
    "bcrypt": "^5.1.1",           // Password hashing
    "jsonwebtoken": "^9.0.2",     // JWT tokens (or use sessions)
    "validator": "^13.11.0",      // Email validation
    "resend": "^3.0.0"            // Email service (or SendGrid, etc.)
  }
}
```

---

## Backend Code

### 1. Password Utilities

```javascript
// backend/src/utils/password.js

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;  // Higher = more secure but slower

async function hashPassword(password) {
  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  // Check for common patterns (optional but recommended)
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumber) {
    throw new Error('Password must contain uppercase, lowercase, and numbers');
  }

  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateToken(length = 32) {
  // For email verification and password reset tokens
  return require('crypto')
    .randomBytes(length)
    .toString('base64url');
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken
};
```

### 2. Email Service

```javascript
// backend/src/services/email.js

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'YouTube Annotator <noreply@yourdomain.com>';
const APP_URL = process.env.APP_URL || 'https://youtube-annotator-production.up.railway.app';

async function sendVerificationEmail(email, token, displayName) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your YouTube Annotator account',
    html: `
      <h2>Welcome to YouTube Annotator, ${displayName}!</h2>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create this account, you can safely ignore this email.</p>
    `
  });
}

async function sendPasswordResetEmail(email, token, displayName) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your password',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${displayName},</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `
  });
}

async function sendWelcomeEmail(email, displayName, citationCount) {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to YouTube Annotator!',
    html: `
      <h2>Welcome, ${displayName}!</h2>
      <p>Your account has been verified successfully.</p>
      ${citationCount > 0 ? `
        <p>We've linked your ${citationCount} existing citations to your new account.</p>
      ` : ''}
      <p>Start annotating YouTube videos with the community!</p>
    `
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
};
```

### 3. Auth Routes

```javascript
// backend/src/routes/auth.js (expand existing)

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { hashPassword, verifyPassword, generateToken } = require('../utils/password');
const { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } = require('../services/email');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30d';  // 30 days

// ==================== REGISTRATION ====================

router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    // Validate email
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Validate display name
    if (!displayName || displayName.trim().length < 2) {
      return res.status(400).json({ error: 'Display name must be at least 2 characters' });
    }

    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password (throws if weak)
    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await User.createWithPassword({
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName.trim(),
      emailVerificationToken: verificationToken,
      emailVerificationExpires: verificationExpires
    });

    // Send verification email (async, don't wait)
    sendVerificationEmail(email, verificationToken, displayName).catch(err => {
      console.error('Failed to send verification email:', err);
    });

    res.status(201).json({
      message: 'Account created! Check your email to verify.',
      userId: user.id,
      email: user.email,
      displayName: user.display_name
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// ==================== EMAIL VERIFICATION ====================

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    const user = await User.findByVerificationToken(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token expired
    if (new Date(user.email_verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Verification token expired. Please request a new one.' });
    }

    // Verify email
    await User.verifyEmail(user.id);

    // Send welcome email
    sendWelcomeEmail(user.email, user.display_name, 0).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.json({
      message: 'Email verified successfully! You can now sign in.',
      email: user.email
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ==================== LOGIN ====================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user by email
    const user = await User.findByEmail(email.toLowerCase());

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email before signing in'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        authType: 'password'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        citationsCount: user.citations_count || 0
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==================== PASSWORD RESET ====================

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const user = await User.findByEmail(email.toLowerCase());

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return res.json({
        message: 'If that email is registered, you will receive a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.setPasswordResetToken(user.id, resetToken, resetExpires);

    // Send reset email
    sendPasswordResetEmail(user.email, resetToken, user.display_name).catch(err => {
      console.error('Failed to send password reset email:', err);
    });

    res.json({
      message: 'If that email is registered, you will receive a password reset link.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password required' });
    }

    const user = await User.findByPasswordResetToken(token);

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token expired
    if (new Date(user.password_reset_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset token expired. Please request a new one.' });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await User.updatePassword(user.id, passwordHash);

    res.json({
      message: 'Password reset successfully! You can now sign in.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message || 'Password reset failed' });
  }
});

// ==================== LINK ANONYMOUS ACCOUNT ====================

router.post('/link-anonymous', authenticateUser, async (req, res) => {
  try {
    const { anonymousId } = req.body;

    if (!anonymousId) {
      return res.status(400).json({ error: 'Anonymous ID required' });
    }

    // Find anonymous user
    const anonymousUser = await User.findByAnonymousId(anonymousId);

    if (!anonymousUser) {
      return res.status(404).json({ error: 'Anonymous account not found' });
    }

    // Transfer all citations from anonymous to logged-in account
    const transferredCount = await User.linkAnonymousAccount(req.user.id, anonymousId);

    res.json({
      message: `Linked ${transferredCount} citations to your account`,
      citationsTransferred: transferredCount
    });

  } catch (error) {
    console.error('Link anonymous error:', error);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

module.exports = router;
```

### 4. Updated User Model

```javascript
// backend/src/models/User.js (additions)

class User {
  // ... existing methods ...

  static async createWithPassword({ email, passwordHash, displayName, emailVerificationToken, emailVerificationExpires }) {
    const result = await db.query(
      `INSERT INTO users
        (email, password_hash, display_name, email_verification_token, email_verification_expires, auth_type, email_verified)
       VALUES ($1, $2, $3, $4, $5, 'password', false)
       RETURNING *`,
      [email, passwordHash, displayName, emailVerificationToken, emailVerificationExpires]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findByVerificationToken(token) {
    const result = await db.query(
      'SELECT * FROM users WHERE email_verification_token = $1',
      [token]
    );
    return result.rows[0];
  }

  static async verifyEmail(userId) {
    await db.query(
      `UPDATE users
       SET email_verified = true,
           email_verification_token = NULL,
           email_verification_expires = NULL
       WHERE id = $1`,
      [userId]
    );
  }

  static async setPasswordResetToken(userId, token, expires) {
    await db.query(
      `UPDATE users
       SET password_reset_token = $1,
           password_reset_expires = $2
       WHERE id = $1`,
      [userId, token, expires]
    );
  }

  static async findByPasswordResetToken(token) {
    const result = await db.query(
      'SELECT * FROM users WHERE password_reset_token = $1',
      [token]
    );
    return result.rows[0];
  }

  static async updatePassword(userId, passwordHash) {
    await db.query(
      `UPDATE users
       SET password_hash = $1,
           password_reset_token = NULL,
           password_reset_expires = NULL
       WHERE id = $1`,
      [userId, passwordHash]
    );
  }

  static async linkAnonymousAccount(loggedInUserId, anonymousId) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Transfer all shares
      const result = await client.query(
        `UPDATE shares
         SET user_id = $1
         WHERE user_id = (SELECT id FROM users WHERE anonymous_id = $2)
         RETURNING id`,
        [loggedInUserId, anonymousId]
      );

      const transferredCount = result.rowCount;

      // Mark anonymous account as linked
      await client.query(
        `UPDATE users
         SET linked_anonymous_id = $2
         WHERE id = $1`,
        [loggedInUserId, anonymousId]
      );

      // Delete anonymous account
      await client.query(
        'DELETE FROM users WHERE anonymous_id = $1',
        [anonymousId]
      );

      await client.query('COMMIT');
      return transferredCount;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

---

## Frontend (Extension) Changes

### 1. Update manifest.json

```json
{
  "permissions": [
    "storage"
    // No "identity" needed for email/password
  ],
  "host_permissions": [
    "https://youtube-annotator-production.up.railway.app/*"
  ]
}
```

### 2. Create auth.js

```javascript
// Extension: auth.js

const API_URL = 'https://youtube-annotator-production.up.railway.app';

class AuthManager {
  constructor() {
    this.token = null;
    this.user = null;
  }

  async register(email, password, displayName) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    return response.json();
  }

  async login(email, password) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    // Store token and user
    await chrome.storage.local.set({
      authToken: data.token,
      user: data.user
    });

    this.token = data.token;
    this.user = data.user;

    return data.user;
  }

  async logout() {
    await chrome.storage.local.remove(['authToken', 'user']);
    this.token = null;
    this.user = null;
  }

  async getCurrentUser() {
    if (this.user) return this.user;

    const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
    if (authToken && user) {
      this.token = authToken;
      this.user = user;
      return user;
    }

    return null;
  }

  async linkAnonymousAccount() {
    const { anonymousId } = await chrome.storage.local.get('anonymousId');

    const response = await fetch(`${API_URL}/api/auth/link-anonymous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ anonymousId })
    });

    return response.json();
  }

  async requestPasswordReset(email) {
    const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    return response.json();
  }
}
```

### 3. Create Login/Register UI

```javascript
// Extension: loginUI.js

function createAuthModal() {
  const modal = document.createElement('div');
  modal.className = 'yt-annotator-auth-modal';
  modal.innerHTML = `
    <div class="auth-modal-content">
      <h2>YouTube Annotator</h2>

      <!-- Login Form -->
      <div id="login-form" style="display: block;">
        <input type="email" id="login-email" placeholder="Email">
        <input type="password" id="login-password" placeholder="Password">
        <button id="login-btn">Sign In</button>
        <a href="#" id="show-register">Create account</a>
        <a href="#" id="forgot-password">Forgot password?</a>
      </div>

      <!-- Register Form -->
      <div id="register-form" style="display: none;">
        <input type="text" id="register-name" placeholder="Display Name">
        <input type="email" id="register-email" placeholder="Email">
        <input type="password" id="register-password" placeholder="Password">
        <button id="register-btn">Create Account</button>
        <a href="#" id="show-login">Already have an account?</a>
      </div>

      <div id="auth-message"></div>
    </div>
  `;

  // Event listeners
  modal.querySelector('#login-btn').onclick = async () => {
    const email = modal.querySelector('#login-email').value;
    const password = modal.querySelector('#login-password').value;

    try {
      const authManager = new AuthManager();
      const user = await authManager.login(email, password);

      // Offer to link anonymous annotations
      const { anonymousId } = await chrome.storage.local.get('anonymousId');
      if (anonymousId) {
        if (confirm(`Welcome back, ${user.displayName}! Link your existing annotations?`)) {
          await authManager.linkAnonymousAccount();
        }
      }

      modal.remove();
      location.reload();  // Refresh to show logged-in state

    } catch (error) {
      modal.querySelector('#auth-message').textContent = error.message;
    }
  };

  modal.querySelector('#register-btn').onclick = async () => {
    const name = modal.querySelector('#register-name').value;
    const email = modal.querySelector('#register-email').value;
    const password = modal.querySelector('#register-password').value;

    try {
      const authManager = new AuthManager();
      await authManager.register(email, password, name);

      modal.querySelector('#auth-message').textContent =
        'Account created! Check your email to verify.';

    } catch (error) {
      modal.querySelector('#auth-message').textContent = error.message;
    }
  };

  // Toggle forms
  modal.querySelector('#show-register').onclick = (e) => {
    e.preventDefault();
    modal.querySelector('#login-form').style.display = 'none';
    modal.querySelector('#register-form').style.display = 'block';
  };

  modal.querySelector('#show-login').onclick = (e) => {
    e.preventDefault();
    modal.querySelector('#register-form').style.display = 'none';
    modal.querySelector('#login-form').style.display = 'block';
  };

  return modal;
}
```

---

## Email Service Setup

### Resend (Recommended)

1. Sign up at https://resend.com
2. Verify your domain (or use resend's test domain)
3. Get API key
4. Add to Railway environment:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

### Email Templates (HTML)

You can create better-looking emails using:
- MJML framework
- React Email
- Or plain HTML with inline CSS

---

## Security Checklist

- ✅ Passwords hashed with bcrypt (12 rounds)
- ✅ Email verification required before login
- ✅ Password reset tokens expire (1 hour)
- ✅ Email verification tokens expire (24 hours)
- ✅ JWT tokens expire (30 days, configurable)
- ✅ Password strength requirements enforced
- ✅ No user enumeration (forgot password doesn't reveal if email exists)
- ✅ SQL injection protected (parameterized queries)
- ✅ XSS protected (validator.js, sanitization)
- ✅ HTTPS only (Railway auto-provisions)

---

## Environment Variables Needed

```bash
# Railway environment
JWT_SECRET=your-long-random-string-change-this-in-production
RESEND_API_KEY=re_xxxxxxxxxxxxx
APP_URL=https://youtube-annotator-production.up.railway.app
```

---

## Testing Flow

1. **Register**: POST /api/auth/register
2. **Check email** (use Resend test mode in dev)
3. **Verify email**: POST /api/auth/verify-email
4. **Login**: POST /api/auth/login → Get JWT token
5. **Use token**: Add `Authorization: Bearer <token>` to API calls
6. **Link anonymous**: POST /api/auth/link-anonymous

---

## Future: Layer Google OAuth on Top

When you're ready for YouTube creator features:

```sql
-- Just add to existing users table
ALTER TABLE users
  ADD COLUMN google_id VARCHAR(255) UNIQUE,
  ADD COLUMN is_youtube_creator BOOLEAN DEFAULT false,
  ADD COLUMN youtube_channel_id VARCHAR(255);

-- A user can have BOTH password AND google_id
-- Regular user: password only
-- Creator: password + google_id + youtube_channel_id
```

**Use case:**
- Regular users: Sign up with email/password
- Creators: Sign up with email/password, THEN link Google to verify channel ownership
- Special features: Only users with `is_youtube_creator = true` get moderation tools on their own videos

---

## Summary: What You're Building

**Core flow:**
1. User registers with email/password
2. Receives verification email
3. Clicks link → email verified
4. Logs in → receives JWT token
5. Extension stores token, uses for API calls
6. Optional: Link existing anonymous annotations

**Time estimate**: 6-8 hours for full implementation

**Benefits over Google OAuth:**
- No dependency on Google
- Works for all users (not just Google account holders)
- Sets foundation for multi-provider auth later

**Next step:**
Ready to implement? I can start with the migration and backend routes.
