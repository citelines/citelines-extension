const crypto = require('crypto');

function getSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET not set');
  return secret;
}

function signEmail(email) {
  const normalized = email.trim().toLowerCase();
  return crypto
    .createHmac('sha256', getSecret())
    .update(normalized)
    .digest('hex')
    .substring(0, 32);
}

function verifyToken(email, token) {
  if (!email || !token) return false;
  const expected = signEmail(email);
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

module.exports = { signEmail, verifyToken };
