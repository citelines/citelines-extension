const express = require('express');
const validator = require('validator');
const { Resend } = require('resend');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { signEmail, verifyToken } = require('../utils/unsubscribeToken');
const { sendNewsletterWelcomeEmail } = require('../services/email');

const IS_DEV = process.env.NODE_ENV !== 'production';
const SITE_URL = process.env.APP_URL || 'https://www.citelines.org';
const API_URL = process.env.API_URL || 'https://citelines-extension-production.up.railway.app';
const resend = new Resend(process.env.RESEND_API_KEY);

function buildUnsubscribeUrls(email) {
  const token = signEmail(email);
  const q = `email=${encodeURIComponent(email)}&token=${token}`;
  return {
    page: `${SITE_URL}/unsubscribe?${q}`,
    oneClick: `${API_URL}/api/newsletter/unsubscribe?${q}`,
  };
}

/**
 * POST /api/newsletter/subscribe
 * Add an email to the Resend newsletter audience and send a welcome email.
 * Idempotent: re-subscribing an existing email returns 200 without re-sending welcome.
 */
router.post('/subscribe', asyncHandler(async (req, res) => {
  const { email } = req.body || {};

  if (!email || !validator.isEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    console.error('[Newsletter] RESEND_AUDIENCE_ID not set');
    return res.status(500).json({ error: 'Newsletter not configured' });
  }

  if (IS_DEV) {
    console.log('\n========================================');
    console.log('📧 NEWSLETTER SUBSCRIBE');
    console.log('========================================');
    console.log('Email:', email);
    console.log('Audience:', audienceId);
    console.log('(Dev mode — not calling Resend)');
    console.log('========================================\n');
    const urls = buildUnsubscribeUrls(email);
    await sendNewsletterWelcomeEmail(email, urls.page, urls.oneClick);
    return res.status(200).json({ ok: true });
  }

  const { error } = await resend.contacts.create({
    email,
    audienceId,
    unsubscribed: false,
  });

  if (error) {
    if (/already exists/i.test(error.message || '')) {
      return res.status(200).json({ ok: true, alreadySubscribed: true });
    }
    console.error('[Newsletter] Resend error:', error);
    return res.status(502).json({ error: 'Subscription failed' });
  }

  // Send welcome email (don't fail the subscribe if email send fails)
  try {
    const urls = buildUnsubscribeUrls(email);
    await sendNewsletterWelcomeEmail(email, urls.page, urls.oneClick);
  } catch (err) {
    console.error('[Newsletter] Welcome email failed:', err);
  }

  res.status(200).json({ ok: true });
}));

/**
 * Unsubscribe handler.
 * Accepts email + token via query string or body.
 * Responds to both POST (API, one-click) and GET (manual click fallback).
 */
async function handleUnsubscribe(req, res) {
  const email = (req.body?.email || req.query?.email || '').trim().toLowerCase();
  const token = (req.body?.token || req.query?.token || '').trim();

  if (!email || !validator.isEmail(email) || !verifyToken(email, token)) {
    return res.status(400).json({ error: 'Invalid unsubscribe link' });
  }

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    return res.status(500).json({ error: 'Newsletter not configured' });
  }

  if (IS_DEV) {
    console.log('\n========================================');
    console.log('📧 NEWSLETTER UNSUBSCRIBE');
    console.log('========================================');
    console.log('Email:', email);
    console.log('(Dev mode — not calling Resend)');
    console.log('========================================\n');
    return res.status(200).json({ ok: true });
  }

  const { error } = await resend.contacts.update({
    email,
    audienceId,
    unsubscribed: true,
  });

  if (error && !/not found/i.test(error.message || '')) {
    console.error('[Newsletter] Unsubscribe error:', error);
    return res.status(502).json({ error: 'Unsubscribe failed' });
  }

  res.status(200).json({ ok: true });
}

router.post('/unsubscribe', asyncHandler(handleUnsubscribe));
router.get('/unsubscribe', asyncHandler(handleUnsubscribe));

module.exports = router;
