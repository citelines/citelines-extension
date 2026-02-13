# Authentication Implementation Plan

## Overview
Add support for logged-in user accounts while maintaining anonymous access.

## Backend Changes Required

### Database Migration (004)

```sql
-- Update users table
ALTER TABLE users
  ADD COLUMN email VARCHAR(255) UNIQUE,
  ADD COLUMN display_name VARCHAR(100),
  ADD COLUMN google_id VARCHAR(255) UNIQUE,  -- For Google OAuth
  ADD COLUMN profile_picture_url TEXT,
  ADD COLUMN email_verified BOOLEAN DEFAULT false,
  ADD COLUMN linked_anonymous_id VARCHAR(255);  -- Track which anonymous account was upgraded

-- Add index for OAuth lookups
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_email ON users(email);

-- Create sessions table (if using session-based auth)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);

-- Or use JWT tokens (no sessions table needed, stateless)
```

### New Routes

```javascript
// backend/src/routes/auth.js (expand existing file)

// Google OAuth flow
POST   /api/auth/google/verify       // Verify Google token, create/login user
GET    /api/auth/google/callback     // OAuth callback (if using web flow)

// Account linking
POST   /api/auth/link-anonymous      // Link current anonymous ID to logged-in account
POST   /api/auth/migrate-data        // Transfer anonymous annotations to logged-in account

// Session management (if not using JWT)
POST   /api/auth/logout              // Invalidate session
GET    /api/auth/me                  // Get current user info
```

### Auth Middleware Update

```javascript
// backend/src/middleware/auth.js

// Current: authenticateAnonymous (X-Anonymous-ID header)
// Add: authenticateUser (supports both anonymous AND logged-in)

async function authenticateUser(req, res, next) {
  // Try JWT/session token first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = await verifyToken(token);  // JWT or session lookup
    if (user) {
      req.user = user;
      req.authType = 'authenticated';
      return next();
    }
  }

  // Fall back to anonymous
  const anonymousId = req.headers['x-anonymous-id'];
  if (anonymousId) {
    const user = await User.findByAnonymousId(anonymousId);
    if (user) {
      req.user = user;
      req.authType = 'anonymous';
      return next();
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}
```

### User Model Updates

```javascript
// backend/src/models/User.js

class User {
  // Existing
  static async findByAnonymousId(anonymousId) { ... }
  static async create({ anonymousId, authType }) { ... }

  // NEW
  static async findByGoogleId(googleId) {
    const result = await db.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
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

  static async createAuthenticated({ googleId, email, displayName, profilePictureUrl }) {
    const result = await db.query(
      `INSERT INTO users (google_id, email, display_name, profile_picture_url, auth_type, email_verified)
       VALUES ($1, $2, $3, $4, 'google', true)
       RETURNING *`,
      [googleId, email, displayName, profilePictureUrl]
    );
    return result.rows[0];
  }

  static async linkAnonymousAccount(userId, anonymousId) {
    // Transfer all shares from anonymous account to authenticated account
    await db.query(
      'UPDATE shares SET user_id = $1 WHERE user_id = (SELECT id FROM users WHERE anonymous_id = $2)',
      [userId, anonymousId]
    );

    // Mark the anonymous account as linked
    await db.query(
      'UPDATE users SET linked_anonymous_id = $2 WHERE id = $1',
      [userId, anonymousId]
    );

    // Delete the old anonymous account
    await db.query(
      'DELETE FROM users WHERE anonymous_id = $1',
      [anonymousId]
    );
  }
}
```

---

## Frontend Changes Required (Chrome Extension)

### 1. Add Google OAuth Support

```javascript
// Extension manifest.json
{
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  },
  "permissions": [
    "identity",
    "storage"
  ]
}
```

### 2. New File: auth.js (Extension)

```javascript
// auth.js - Handle Google OAuth in extension

class AuthManager {
  constructor() {
    this.user = null;
    this.authToken = null;
  }

  async signInWithGoogle() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        try {
          // Verify token with backend
          const response = await fetch(`${API_URL}/api/auth/google/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });

          const data = await response.json();

          // Store auth token (JWT or session ID)
          await chrome.storage.local.set({
            authToken: data.authToken,
            user: data.user
          });

          this.authToken = data.authToken;
          this.user = data.user;

          resolve(data.user);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async signOut() {
    // Clear local storage
    await chrome.storage.local.remove(['authToken', 'user']);

    // Remove Google token
    if (this.authToken) {
      chrome.identity.removeCachedAuthToken({ token: this.authToken });
    }

    // Invalidate backend session
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.authToken}` }
    });

    this.authToken = null;
    this.user = null;
  }

  async getCurrentUser() {
    // Check if already loaded
    if (this.user) return this.user;

    // Load from storage
    const { authToken, user } = await chrome.storage.local.get(['authToken', 'user']);
    if (authToken && user) {
      this.authToken = authToken;
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
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ anonymousId })
    });

    return response.json();
  }
}
```

### 3. Update api.js

```javascript
// api.js - Add authentication header support

class API {
  async init() {
    // Try authenticated user first
    const { authToken } = await chrome.storage.local.get('authToken');
    if (authToken) {
      this.authToken = authToken;
      return;
    }

    // Fall back to anonymous
    const { anonymousId } = await chrome.storage.local.get('anonymousId');
    if (!anonymousId) {
      this.anonymousId = await this.register();
    } else {
      this.anonymousId = anonymousId;
    }
  }

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };

    // Use auth token if available, otherwise anonymous ID
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    } else if (this.anonymousId) {
      headers['X-Anonymous-ID'] = this.anonymousId;
    }

    return headers;
  }

  async createShare(videoId, title, annotations) {
    const response = await fetch(`${API_URL}/api/shares`, {
      method: 'POST',
      headers: this.getHeaders(),  // ← Updated
      body: JSON.stringify({ videoId, title, annotations })
    });
    return response.json();
  }

  // ... other methods updated similarly ...
}
```

### 4. Add UI for Login Button

```javascript
// In content.js or new popup.html

function createLoginButton() {
  const button = document.createElement('button');
  button.textContent = 'Sign in with Google';
  button.className = 'yt-annotator-login-btn';
  button.onclick = async () => {
    const authManager = new AuthManager();
    try {
      const user = await authManager.signInWithGoogle();

      // Offer to link anonymous annotations
      if (confirm(`Welcome ${user.display_name}! Link your existing annotations to this account?`)) {
        await authManager.linkAnonymousAccount();
        alert('Annotations linked successfully!');
      }

      // Update UI to show logged-in state
      updateUserDisplay(user);
    } catch (error) {
      alert('Sign-in failed: ' + error.message);
    }
  };
  return button;
}

function updateUserDisplay(user) {
  // Show user profile picture and name
  // Replace "Sign in" button with "Sign out" + profile dropdown
  // Show "My Citations" list
}
```

---

## Implementation Effort Estimate

### Minimal (Google OAuth only)
**Time**: 4-6 hours
**Scope**:
- Backend: Google token verification, link anonymous account
- Frontend: Chrome identity API, login button
- No email/password, no advanced features

### Full-Featured
**Time**: 2-3 days
**Scope**:
- Multiple OAuth providers (Google + GitHub)
- Email verification flow
- Account settings page
- Profile management
- "My Citations" dashboard
- Cross-device sync

---

## Migration Path (Existing Users)

### Seamless Upgrade Flow

1. **Anonymous user clicks "Sign In"**
2. **Google OAuth flow completes**
3. **Backend checks**: Does this Google account already exist?
   - **No**: Create new authenticated user
   - **Yes**: Log in to existing account
4. **Prompt user**: "Link your 42 anonymous citations to this account?"
5. **User confirms**: Transfer ownership of all shares
6. **Delete anonymous account** (or mark as migrated)
7. **User now logged in** with all their data preserved

### Database View

```sql
-- Before login
users:
  id: uuid-1
  anonymous_id: "abc123..."
  auth_type: "anonymous"
  email: NULL

shares:
  user_id: uuid-1  (42 rows)

-- After login + linking
users:
  id: uuid-2
  google_id: "google-xyz"
  email: "user@gmail.com"
  display_name: "John Doe"
  auth_type: "google"
  linked_anonymous_id: "abc123..."  ← Tracks what was migrated

shares:
  user_id: uuid-2  (42 rows)  ← Transferred from uuid-1

-- uuid-1 deleted or marked as migrated
```

---

## Security Considerations

### 1. Token Storage
- **JWT**: Store in chrome.storage.local (extension sandboxed, safe)
- **Session ID**: Same, send in Authorization header
- **Never** store in localStorage (accessible to webpage JS)

### 2. Token Verification
```javascript
// Backend must verify Google tokens
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload['sub'],
    email: payload['email'],
    displayName: payload['name'],
    profilePicture: payload['picture'],
    emailVerified: payload['email_verified']
  };
}
```

### 3. CORS Update
```javascript
// Allow Authorization header
res.setHeader('Access-Control-Allow-Headers',
  'Content-Type, X-Anonymous-ID, Authorization');
```

---

## Recommended Approach

### Phase 1: Google OAuth Only (Minimal)
✅ Fastest to implement
✅ Best UX for YouTube users
✅ Lowest maintenance

**Steps**:
1. Create Google OAuth app (5 min)
2. Add backend verification endpoint (30 min)
3. Add Chrome identity API to extension (1 hour)
4. Add link-anonymous endpoint (30 min)
5. Add login UI button (30 min)
6. Test migration flow (1 hour)

**Total**: ~4 hours

### Phase 2: Enhanced Features (Later)
- Display names next to citations
- "My Citations" filter/view
- Cross-device sync
- Account settings page

---

## Decision Points

1. **JWT vs Sessions?**
   - **JWT**: Stateless, scalable, easier
   - **Sessions**: More control, can revoke instantly

2. **Allow anonymous + logged-in simultaneously?**
   - **No**: Force migration on first login (simpler)
   - **Yes**: Support both, sync data (complex)

3. **Required vs Optional login?**
   - **Optional** (recommended): Keep anonymous access
   - **Required**: Force Google login to use extension

---

## Next Steps

Want me to implement **Phase 1 (Google OAuth)** now? It's ~4 hours of work and gives you:
- ✅ Google sign-in button
- ✅ Link anonymous annotations to account
- ✅ Display user name/picture
- ✅ Foundation for all future social features

Or would you prefer to explore a different auth approach first?
