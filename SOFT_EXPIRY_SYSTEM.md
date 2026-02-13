# 90-Day Soft Expiry System

## Overview

Anonymous users get **temporary accounts** that expire after 90 days (Wikipedia-style). Citations remain visible but users lose ownership. Registering converts to permanent account.

---

## User Journey

### Day 1: Anonymous User Creates Account
```
Extension:
- User visits YouTube with extension installed
- No auth credentials found
- POST /api/auth/register (anonymous)

Backend:
- Creates user with auto-generated random pseudonym
- display_name: "~2026-472935" (random 6-digit ID)
- expires_at: NOW() + 90 days
- Returns: { anonymousId, displayName, expiresAt }

Extension:
- Stores anonymousId + accountCreated in chrome.storage.local
- User creates citations as "~2026-472935"

Note: Random ID prevents tracking/enumeration
- NOT sequential: Can't determine user count or join order
- 1 million possibilities per year (low collision)
```

### Day 1-89: Normal Usage
```
- User creates 42 citations across videos
- All visible as "~2026-472935"
- User can edit/delete their own citations
- No warnings shown
```

### Day 80-90: Warning Period
```
Extension:
- Every API call checks response headers
- Header: X-Account-Expiry-Warning: 8 (days remaining)
- Shows banner: "Your account expires in 8 days. Sign up to keep your 42 citations!"
- "Sign Up" button → registration flow

Backend:
- checkUserExpiry middleware adds warning headers
- If daysUntilExpiry <= 10:
    res.setHeader('X-Account-Expiry-Warning', daysLeft)
```

### Day 91: Account Expires (Soft)
```
User visits YouTube:
- Extension sends X-Anonymous-ID: "old-id"
- Backend checks expiry
- Account expired → marks as 'expired'

Backend Response:
{
  "error": "Account expired",
  "code": "ACCOUNT_EXPIRED",
  "message": "Your temporary account has expired after 90 days.",
  "oldDisplayName": "~2026-472935",
  "citationsPreserved": true
}

Extension handles ACCOUNT_EXPIRED:
- Clears old anonymousId
- Registers new anonymous account
- Gets new random pseudonym: "~2026-183749"
- Shows message: "Your temporary account expired. Your old citations remain visible as '~2026-472935' but you can no longer edit them. You now have a new identity: '~2026-183749'"

Database:
users:
  id: uuid-1
  display_name: "~2026-472935"
  anonymous_id: NULL  ← Cleared (can't auth anymore)
  auth_type: "expired"  ← Marked as expired
  expires_at: 2026-05-13

shares (42 rows):
  user_id: uuid-1  ← Still connected to expired user
  // Citations remain visible!
  // But user can't edit/delete (ownership check fails)
```

### Alternative: User Registers on Day 85
```
User clicks "Sign Up":
- Extension shows registration form
- User enters: email, password, display name (or keeps "~2026-12345")
- POST /api/auth/register

Backend:
- Updates existing user (doesn't create new):
    UPDATE users
    SET email = 'user@gmail.com',
        password_hash = '...',
        display_name = 'JohnDoe42',
        auth_type = 'password',
        expires_at = NULL  ← Never expires!
    WHERE id = uuid-1

- All 42 citations now owned by registered account
- No data migration needed (same user_id)

Result:
- User keeps all citations
- No expiry
- Display name changes to "JohnDoe42"
- Can access from any device (cross-device sync)
```

---

## Backend Implementation

### Database Schema (Migration 004)

```sql
-- Add to users table
ALTER TABLE users
  ADD COLUMN display_name VARCHAR(100),
  ADD COLUMN account_created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN expires_at TIMESTAMP;  -- NULL = never expires

-- Auto-generate display names for anonymous users
CREATE FUNCTION generate_anonymous_display_name()
  RETURNS VARCHAR AS '~YYYY-NNNNN'

-- Auto-set expiry on creation
CREATE TRIGGER set_user_expiry
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_anonymous_expiry();

-- Function to mark expired accounts
CREATE FUNCTION expire_old_accounts()
  RETURNS INTEGER;
```

### Middleware: checkUserExpiry

```javascript
// backend/src/middleware/checkExpiry.js

async function checkUserExpiry(req, res, next) {
  if (!req.user) return next();

  // Registered users: never expire
  if (req.user.auth_type === 'password' || req.user.auth_type === 'google') {
    return next();
  }

  // Already expired
  if (req.user.auth_type === 'expired') {
    return res.status(401).json({
      error: 'Account expired',
      code: 'ACCOUNT_EXPIRED',
      ...
    });
  }

  // Anonymous: check if expired
  if (req.user.expires_at < NOW()) {
    // Mark as expired
    UPDATE users SET auth_type = 'expired', anonymous_id = NULL
    WHERE id = req.user.id;

    return res.status(401).json({ code: 'ACCOUNT_EXPIRED', ... });
  }

  // Add warning if close to expiry
  if (daysUntilExpiry <= 10) {
    res.setHeader('X-Account-Expiry-Warning', daysUntilExpiry);
  }

  next();
}
```

### Cron Job: Daily Expiry

```javascript
// Runs daily at 2:00 AM UTC
cron.schedule('0 2 * * *', async () => {
  const result = await db.query('SELECT expire_old_accounts()');
  console.log(`Expired ${result.expired_count} accounts`);
});
```

---

## Extension Implementation

### Storage Structure

```javascript
chrome.storage.local:
{
  // Auth state
  anonymousId: "abc123...",
  accountCreated: "2026-02-12T10:30:00Z",

  // For registered users
  authToken: "eyJhbGc...",  // JWT token
  user: {
    id: "uuid",
    email: "user@gmail.com",
    displayName: "JohnDoe42",
    accountType: "password",  // Never expires
  }
}
```

### API Client: Handle Expiry

```javascript
// api.js

async function apiCall(endpoint, options) {
  const response = await fetch(endpoint, options);

  // Check for expiry error
  if (response.status === 401) {
    const error = await response.json();

    if (error.code === 'ACCOUNT_EXPIRED') {
      // Account expired - create new one
      console.log('Account expired:', error.oldDisplayName);

      // Clear old credentials
      await chrome.storage.local.remove(['anonymousId', 'accountCreated']);

      // Register new anonymous account
      const newAccount = await registerAnonymous();

      // Show message to user
      showExpiryNotification(error.oldDisplayName, newAccount.displayName);

      // Retry original request with new credentials
      return apiCall(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'X-Anonymous-ID': newAccount.anonymousId
        }
      });
    }
  }

  // Check for expiry warning
  const warningDays = response.headers.get('X-Account-Expiry-Warning');
  if (warningDays) {
    showExpiryWarning(warningDays);
  }

  return response;
}
```

### UI: Expiry Warning

```javascript
function showExpiryWarning(daysLeft) {
  const banner = document.createElement('div');
  banner.className = 'yt-annotator-expiry-warning';
  banner.innerHTML = `
    <div class="warning-content">
      ⚠️ Your temporary account expires in <strong>${daysLeft} days</strong>.
      <button id="register-now">Sign Up</button> to keep your citations!
      <button id="dismiss">Dismiss</button>
    </div>
  `;

  document.querySelector('#ytd-player').prepend(banner);

  banner.querySelector('#register-now').onclick = () => {
    showRegistrationModal();
  };

  banner.querySelector('#dismiss').onclick = () => {
    banner.remove();
    // Show again in 24 hours
    chrome.storage.local.set({ dismissedWarningUntil: Date.now() + 86400000 });
  };
}

function showExpiryNotification(oldName, newName) {
  alert(`
    Your temporary account "${oldName}" has expired after 90 days.

    Your old citations remain visible but you can no longer edit them.

    You now have a new identity: "${newName}"

    Sign up to keep your citations permanently!
  `);
}
```

### Registration Flow: Preserve Citations

```javascript
async function registerWithEmail(email, password, displayName) {
  // Get current anonymous ID
  const { anonymousId } = await chrome.storage.local.get('anonymousId');

  // Register (backend will upgrade existing user, not create new)
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Anonymous-ID': anonymousId  // Link to existing account
    },
    body: JSON.stringify({ email, password, displayName })
  });

  if (response.ok) {
    const { token, user } = await response.json();

    // Store credentials
    await chrome.storage.local.set({
      authToken: token,
      user: user
    });

    // Remove anonymous credentials (no longer needed)
    await chrome.storage.local.remove(['anonymousId', 'accountCreated']);

    alert(`Welcome, ${user.displayName}! Your ${user.citationsCount} citations are now permanently saved.`);
  }
}
```

---

## API Endpoints

### GET /api/auth/expiry-info
```javascript
// Get expiry status for current user

Response (anonymous):
{
  "accountType": "anonymous",
  "expires": true,
  "expiryDate": "2026-05-13T10:30:00Z",
  "daysUntilExpiry": 8,
  "displayName": "~2026-12345",
  "warning": "Your account expires in 8 days. Sign up to keep your citations!"
}

Response (registered):
{
  "accountType": "password",
  "expires": false,
  "displayName": "JohnDoe42"
}

Response (expired):
{
  "accountType": "expired",
  "expires": true,
  "expired": true,
  "expiryDate": "2026-05-13T10:30:00Z",
  "displayName": "~2026-12345",
  "message": "This account has expired. Citations remain visible but you can no longer edit them."
}
```

---

## Citation Ownership After Expiry

### Before Expiry (Day 1-90)
```javascript
// GET /api/shares/:token
{
  "annotations": [
    {
      "id": "uuid-1",
      "text": "Great explanation!",
      "author": "~2026-12345",
      "timestamp": 120
    }
  ],
  "isOwner": true  ← User can edit/delete
}
```

### After Expiry (Day 91+)
```javascript
// Same endpoint, different user (new anonymous account)
{
  "annotations": [
    {
      "id": "uuid-1",
      "text": "Great explanation!",
      "author": "~2026-12345",  ← Old expired account
      "timestamp": 120
    }
  ],
  "isOwner": false  ← User CANNOT edit/delete (different user_id)
}
```

**Citations are preserved but ownership lost.**

---

## Benefits of Soft Expiry

1. **Privacy**: Users can't be tracked indefinitely
2. **Content Preservation**: Community knowledge remains
3. **Registration Incentive**: "Sign up to keep your work"
4. **No Data Loss**: Old citations remain visible
5. **Clean User Experience**: Automatic, no manual intervention

---

## Testing Scenarios

### Test 1: Anonymous User Flow
1. Install extension
2. Create 5 citations
3. Check display name (should be ~2026-NNNNN)
4. Verify citations saved

### Test 2: Expiry Warning
1. Manually set user expires_at to 8 days from now
2. Make API call
3. Check for X-Account-Expiry-Warning header
4. Verify warning banner shows in extension

### Test 3: Account Expiry
1. Manually set user expires_at to yesterday
2. Make API call
3. Should get 401 with ACCOUNT_EXPIRED
4. Extension should create new account
5. Old citations should still be visible (but not editable)

### Test 4: Registration Before Expiry
1. Create anonymous account
2. Create 10 citations
3. Register with email/password
4. Verify all 10 citations now owned by registered account
5. Verify expires_at is NULL
6. Verify display name updated

### Test 5: Cron Job
1. Create test users with past expiry dates
2. Run cron job manually: `jobs.expireAccounts()`
3. Verify users marked as 'expired'
4. Verify anonymous_id cleared

---

## Summary

✅ **Persistent pseudonyms** - Each account gets unique ~YYYY-NNNNN name
✅ **90-day expiry** - Soft expiry preserves citations
✅ **Registration incentive** - "Sign up to keep your work"
✅ **Privacy protection** - Can't track users indefinitely
✅ **Content preservation** - Citations remain visible
✅ **Automatic cleanup** - Daily cron job marks expired accounts
✅ **Seamless UX** - Extension handles expiry automatically

**Ready to implement!**
