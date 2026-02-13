# Email/Password Auth - Architecture Review

## Current System State

### Database Schema ✅
```
users table (existing):
- id: UUID
- anonymous_id: VARCHAR (unique)
- auth_type: 'anonymous'
- created_at: TIMESTAMP
- citations_count: INTEGER
- last_citation_at: TIMESTAMP
- is_rate_limited: BOOLEAN
- rate_limit_until: TIMESTAMP

user_stats table (Phase 2.1):
- user_id: UUID (FK to users)
- total_citations: INTEGER
- citations_today: INTEGER
- citations_this_hour: INTEGER
- rapid_fire_count: INTEGER
- warnings: INTEGER

shares table (existing):
- id: UUID
- share_token: VARCHAR(8)
- user_id: UUID (FK to users)
- video_id: VARCHAR(20)
- annotations: JSONB
- created_at: TIMESTAMP
```

**Status**: Ready to extend with email/password fields

---

## Proposed Architecture

### 1. Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER JOURNEY                              │
└─────────────────────────────────────────────────────────────┘

ANONYMOUS USER (Current):
├─ Install extension
├─ Auto-generate anonymous_id
├─ Create citations (rate limited)
└─ Data stored locally + Railway

REGISTERED USER (New):
├─ Click "Sign Up" in extension
├─ Enter email + password + display name
├─ Receive verification email
├─ Click verification link
├─ Login with credentials
├─ Get JWT token
├─ Prompted: "Link 42 existing citations?"
│  ├─ Yes → Transfer ownership to registered account
│  └─ No → Keep separate
└─ Create citations as authenticated user

FUTURE: YOUTUBE CREATOR (Phase 3):
├─ Already registered with email/password
├─ Click "Verify as Creator"
├─ Google OAuth flow
├─ Verify YouTube channel ownership
├─ Get creator badge + special powers
└─ Moderate citations on their videos
```

---

## 2. Authentication Layers (Multi-Tier)

```
┌────────────────────────────────────────────────────────────┐
│  Layer 1: Anonymous (Current)                              │
│  - Auto-generated ID                                       │
│  - No login required                                       │
│  - Rate limits: Standard                                   │
└────────────────────────────────────────────────────────────┘
                          ↓ (Optional upgrade)
┌────────────────────────────────────────────────────────────┐
│  Layer 2: Email/Password (Phase 2.2)                       │
│  - User-chosen credentials                                 │
│  - Email verification required                             │
│  - Rate limits: Higher                                     │
│  - Display name shown on citations                         │
│  - Cross-device sync                                       │
└────────────────────────────────────────────────────────────┘
                          ↓ (Optional for creators)
┌────────────────────────────────────────────────────────────┐
│  Layer 3: Google OAuth (Future)                            │
│  - Verify YouTube channel ownership                        │
│  - Creator badge                                           │
│  - Special moderation powers on own videos                 │
│  - Analytics dashboard                                     │
└────────────────────────────────────────────────────────────┘
```

**Key insight**: Users can exist at multiple layers simultaneously!
- Layer 1 only: Anonymous
- Layer 1 + 2: Registered (linked anonymous)
- Layer 2 + 3: Registered creator (with Google verification)

---

## 3. Database Design Analysis

### Option A: Single users table (Recommended ✅)

```sql
users table:
├─ id (UUID, primary key)
├─ anonymous_id (nullable, unique)      -- Only for Layer 1
├─ email (nullable, unique)             -- Layer 2+
├─ password_hash (nullable)             -- Layer 2+
├─ display_name (nullable)              -- Layer 2+
├─ google_id (nullable, unique)         -- Layer 3
├─ youtube_channel_id (nullable)        -- Layer 3
├─ auth_type (enum: 'anonymous', 'password', 'google')
├─ email_verified (boolean)
├─ is_youtube_creator (boolean)
└─ linked_anonymous_id (nullable)       -- Track migration
```

**Pros**:
- ✅ Simple queries (no JOINs needed)
- ✅ Easy to upgrade from anonymous → registered → creator
- ✅ Single source of truth
- ✅ Foreign keys straightforward

**Cons**:
- ⚠️ Nullable columns (but that's fine in this case)

### Option B: Separate tables (Not recommended ❌)

```sql
users (base):
├─ id, created_at

anonymous_users:
├─ user_id (FK), anonymous_id

registered_users:
├─ user_id (FK), email, password_hash

creator_users:
├─ user_id (FK), google_id, youtube_channel_id
```

**Pros**:
- Normalized schema

**Cons**:
- ❌ Complex queries (JOINs everywhere)
- ❌ Hard to migrate between types
- ❌ Confusing foreign key relationships

**Decision**: Use Option A (single table with nullable columns)

---

## 4. Token Strategy: JWT vs Sessions

### Option A: JWT Tokens (Recommended ✅)

```javascript
// JWT payload
{
  userId: 'uuid',
  email: 'user@example.com',
  authType: 'password',
  iat: 1234567890,
  exp: 1237159890  // 30 days
}

// Stored in extension
chrome.storage.local.set({ authToken: 'eyJhbGc...' });

// Sent with every request
headers: { 'Authorization': 'Bearer eyJhbGc...' }
```

**Pros**:
- ✅ Stateless (no database lookups)
- ✅ Scalable (no session storage needed)
- ✅ Works across multiple servers (Railway auto-scaling)
- ✅ Built-in expiry
- ✅ Simple implementation

**Cons**:
- ⚠️ Can't invalidate immediately (must wait for expiry)
- ⚠️ Slightly larger requests (but minimal)

**Workaround for invalidation**:
- Add `jti` (JWT ID) to payload
- Create `revoked_tokens` table
- Check if token revoked before accepting (fast lookup)

### Option B: Session-based (Not recommended ❌)

```javascript
// sessions table
{
  id: 'uuid',
  user_id: 'uuid',
  token: 'random-string',
  expires_at: TIMESTAMP
}

// Stored in extension
chrome.storage.local.set({ sessionToken: 'abc123...' });

// Database lookup on EVERY request
SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW();
```

**Pros**:
- Can invalidate immediately
- More control

**Cons**:
- ❌ Database hit on every request
- ❌ Slower
- ❌ Doesn't scale as well
- ❌ Requires session cleanup job

**Decision**: Use JWT tokens

---

## 5. Email Verification Strategy

### Problem: No domain email yet

### Solution A: Development Mode (Recommended for now ✅)

```javascript
// backend/src/services/email.js

const IS_DEV = process.env.NODE_ENV !== 'production';

async function sendVerificationEmail(email, token, displayName) {
  if (IS_DEV) {
    // Development: Log verification URL to console
    const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
    console.log('\n========================================');
    console.log('📧 VERIFICATION EMAIL');
    console.log('To:', email);
    console.log('Verify URL:', verifyUrl);
    console.log('========================================\n');

    // Auto-verify in dev (optional)
    if (process.env.AUTO_VERIFY_EMAIL === 'true') {
      setTimeout(async () => {
        await User.verifyEmail(userId);
        console.log('✅ Auto-verified:', email);
      }, 1000);
    }

    return;
  }

  // Production: Send real email via Resend
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your YouTube Annotator account',
    html: generateVerificationEmailHTML(displayName, token)
  });
}
```

**Development workflow**:
1. User registers
2. Backend logs verification URL to Railway logs
3. Copy URL from logs
4. Paste in browser to verify
5. OR: Set `AUTO_VERIFY_EMAIL=true` to skip manual step

### Solution B: Email Testing Service (Alternative)

Use **Ethereal Email** (free, no signup):
```javascript
// Generate test account
const testAccount = await nodemailer.createTestAccount();

// Send to Ethereal
const info = await transporter.sendMail({
  from: 'noreply@annotator.test',
  to: user.email,
  subject: 'Verify Email',
  html: emailHTML
});

// Get preview URL
console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
// Opens: https://ethereal.email/message/xxx
```

**Pros**:
- ✅ See actual email rendering
- ✅ No configuration needed
- ✅ Free forever

**Cons**:
- ⚠️ Not real delivery
- ⚠️ User can't actually receive emails

### Solution C: Resend Test Mode (When domain ready)

```javascript
// backend/.env
RESEND_API_KEY=re_test_xxxxx  // Free tier
RESEND_FROM_EMAIL=onboarding@resend.dev  // Resend's test domain

// Can send to verified emails only (your Gmail, etc.)
```

**Decision**: Start with Solution A (dev mode), migrate to Solution C when domain ready

---

## 6. Security Analysis

### ✅ Strong Points

1. **Password Hashing**: bcrypt with 12 rounds (industry standard)
2. **Token Expiry**: Verification (24h), Reset (1h), JWT (30d configurable)
3. **SQL Injection**: Parameterized queries throughout
4. **Rate Limiting**: Already implemented (Phase 2.1)
5. **HTTPS**: Railway auto-provisions SSL

### ⚠️ Potential Issues

1. **JWT Secret Management**
   - **Current**: Hardcoded in code
   - **Fix**: Use Railway environment variable
   ```bash
   railway variables set JWT_SECRET=$(openssl rand -base64 64)
   ```

2. **Password Reset Timing Attack**
   - **Issue**: Response time reveals if email exists
   - **Fix**: Always return same response (already in plan)

3. **No CSRF Protection**
   - **Issue**: Extension context = safe (can't be CSRFed)
   - **But**: If you add web UI later, add CSRF tokens

4. **No Brute Force Protection on Login**
   - **Issue**: Unlimited login attempts
   - **Fix**: Add to rate limiter
   ```javascript
   const loginLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,  // 15 minutes
     max: 5,  // 5 attempts
     message: 'Too many login attempts'
   });
   router.post('/login', loginLimiter, async (req, res) => {...});
   ```

5. **Email Enumeration**
   - **Issue**: Registration reveals if email exists
   - **Fix**: Return same response for existing emails
   ```javascript
   if (existingUser) {
     // Don't reveal user exists
     return res.status(201).json({
       message: 'Account created! Check your email to verify.'
     });
     // But don't actually send email or create account
   }
   ```

### 🔒 Recommendations

**Add these security measures**:
1. ✅ JWT secret in environment variable (not code)
2. ✅ Login rate limiting (5 attempts per 15 min)
3. ✅ Email enumeration protection
4. ✅ Password strength requirements (already planned)
5. ⏸️ 2FA (optional, future enhancement)

---

## 7. Data Migration Strategy

### Scenario: Anonymous User → Registered User

**Current state**:
```
users:
  id: uuid-1
  anonymous_id: "abc123"
  auth_type: "anonymous"
  citations_count: 42

shares (42 rows):
  user_id: uuid-1
  video_id: "dQw4w9WgXcQ"
  annotations: [...]
```

**After registration + linking**:
```
users:
  id: uuid-1  ← SAME USER ID
  anonymous_id: "abc123"  ← Keep for reference
  email: "user@gmail.com"  ← NEW
  password_hash: "..."  ← NEW
  display_name: "John Doe"  ← NEW
  auth_type: "password"  ← UPDATED
  email_verified: true
  citations_count: 42  ← PRESERVED

shares (42 rows):
  user_id: uuid-1  ← NO CHANGE NEEDED
```

**Key insight**: We DON'T create a new user!
- ✅ Update existing anonymous user with email/password
- ✅ All foreign keys stay valid
- ✅ No data migration needed
- ✅ Citation counts preserved

**Updated migration strategy**:
```javascript
async function linkAnonymousAccount(anonymousId, email, passwordHash, displayName) {
  // Don't create new user - upgrade existing one!
  await db.query(`
    UPDATE users
    SET email = $1,
        password_hash = $2,
        display_name = $3,
        auth_type = 'password',
        email_verified = false
    WHERE anonymous_id = $4
  `, [email, passwordHash, displayName, anonymousId]);

  // No need to transfer shares - they already belong to this user_id
}
```

**Much simpler!**

---

## 8. API Authentication Flow

### Current (Anonymous):
```
Extension → API
Headers: { 'X-Anonymous-ID': 'abc123' }

Backend:
1. Look up user by anonymous_id
2. Attach req.user
3. Process request
```

### New (Dual Support):
```
Extension → API
Headers: {
  'Authorization': 'Bearer eyJhbGc...'  // If logged in
  OR
  'X-Anonymous-ID': 'abc123'  // If anonymous
}

Backend:
1. Check for Authorization header first
   → If present: Verify JWT → req.user
2. Else check for X-Anonymous-ID
   → If present: Look up anonymous user → req.user
3. Else: Return 401

Same req.user object, different source!
```

**Middleware update**:
```javascript
async function authenticateUser(req, res, next) {
  // Try JWT first (registered users)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(payload.userId);
      req.authType = 'jwt';
      return next();
    } catch (err) {
      // Invalid JWT - fall through to anonymous
    }
  }

  // Fall back to anonymous
  const anonymousId = req.headers['x-anonymous-id'];
  if (anonymousId) {
    req.user = await User.findByAnonymousId(anonymousId);
    if (req.user) {
      req.authType = 'anonymous';
      return next();
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}
```

**No breaking changes** - anonymous users keep working!

---

## 9. Extension Storage Strategy

### Current:
```javascript
chrome.storage.local:
{
  anonymousId: "abc123",
  anonymousId_incognito: "xyz789",  // Separate for incognito
  annotations_dQw4w9WgXcQ: [...],   // Local cache
}
```

### After Auth:
```javascript
chrome.storage.local:
{
  // Auth state
  authToken: "eyJhbGc...",  // JWT token (if logged in)
  user: {
    id: "uuid",
    email: "user@gmail.com",
    displayName: "John Doe",
    citationsCount: 42
  },

  // Keep anonymous ID for backward compatibility
  anonymousId: "abc123",  // Deprecated but preserved
  anonymousId_incognito: "xyz789",

  // Local cache
  annotations_dQw4w9WgXcQ: [...],
}
```

**API client logic**:
```javascript
async getAuthHeaders() {
  const { authToken, anonymousId } = await chrome.storage.local.get(['authToken', 'anonymousId']);

  if (authToken) {
    return { 'Authorization': `Bearer ${authToken}` };
  } else if (anonymousId) {
    return { 'X-Anonymous-ID': anonymousId };
  } else {
    throw new Error('Not authenticated');
  }
}
```

---

## 10. Implementation Phases

### Phase 2.2a: Backend Only (2-3 hours)
✅ Database migration (add email/password columns)
✅ Password utilities (bcrypt, validation)
✅ Auth routes (register, login, verify, reset)
✅ Email service (dev mode - console logging)
✅ JWT token generation
✅ Updated auth middleware (dual support)
✅ Security: login rate limiting

**Testing**: Use curl/Postman to test all endpoints

### Phase 2.2b: Extension UI (2-3 hours)
✅ Auth modal (login/register forms)
✅ Auth manager class
✅ Update API client (dual auth support)
✅ Account linking prompt
✅ User profile display
✅ Logout functionality

**Testing**: End-to-end flow in browser

### Phase 2.2c: Email Setup (When domain ready)
✅ Configure Resend with domain
✅ Design email templates
✅ Switch from dev mode to production
✅ Test real email delivery

---

## 11. Potential Issues & Mitigations

### Issue 1: User forgets they already registered
**Scenario**: User registers, forgets, tries to register again with same email
**Solution**: Show helpful message
```javascript
if (existingUser) {
  return res.status(200).json({
    error: 'Email already registered',
    message: 'Did you forget your password? Click "Forgot Password" to reset it.',
    existingUser: true
  });
}
```

### Issue 2: User has multiple anonymous accounts (different browsers)
**Scenario**: User has annotations on Chrome + Firefox, registers on Chrome
**Solution**: Allow linking multiple anonymous IDs
```javascript
// Link second anonymous account
POST /api/auth/link-anonymous
{
  anonymousId: "firefox-id-xyz"
}

// Merges citations from both accounts
```

### Issue 3: Email verification link expires
**Scenario**: User doesn't check email for 2 days
**Solution**: Add "resend verification" endpoint
```javascript
POST /api/auth/resend-verification
{
  email: "user@gmail.com"
}

// Generates new token, sends new email
```

### Issue 4: JWT token stolen
**Scenario**: Malware reads chrome.storage.local
**Solution**: Token revocation list
```sql
CREATE TABLE revoked_tokens (
  jti UUID PRIMARY KEY,  -- JWT ID
  revoked_at TIMESTAMP DEFAULT NOW()
);

-- Check on every request
SELECT 1 FROM revoked_tokens WHERE jti = $1;
```

### Issue 5: User changes email
**Scenario**: User wants to update email address
**Solution**: Require re-verification
```javascript
POST /api/auth/change-email
{
  newEmail: "newemail@gmail.com",
  password: "current-password"  // Confirm identity
}

// Sends verification to NEW email
// Only updates after verification
```

---

## 12. Architecture Strengths

✅ **Backward compatible**: Anonymous users keep working
✅ **Scalable**: JWT = stateless, no session storage
✅ **Flexible**: Easy to add Google OAuth layer later
✅ **Secure**: Industry-standard practices (bcrypt, JWT, rate limiting)
✅ **Simple**: Single users table, no complex JOINs
✅ **Upgradeable**: Anonymous → Registered → Creator path clear

---

## 13. Architecture Weaknesses & Trade-offs

⚠️ **No real-time email** (until domain setup)
- Mitigation: Dev mode works for testing

⚠️ **JWT can't be revoked immediately**
- Mitigation: Short expiry + revocation list

⚠️ **Email is single point of failure**
- Mitigation: Add phone number backup (future)

⚠️ **No 2FA** (future enhancement)
- Mitigation: Strong password requirements + email verification

---

## Final Recommendation

**Architecture is SOLID** ✅

**Proceed with implementation:**
1. ✅ Use single users table (Option A)
2. ✅ Use JWT tokens (Option A)
3. ✅ Start with dev mode emails (Solution A)
4. ✅ Add security fixes mentioned
5. ✅ Upgrade existing anonymous users (don't create new)

**Minor adjustments needed:**
- Add login rate limiting
- Move JWT_SECRET to environment variable
- Add email enumeration protection

**Ready to build!**
