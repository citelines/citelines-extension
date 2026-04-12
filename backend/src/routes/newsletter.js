const express = require('express');
const validator = require('validator');
const { Resend } = require('resend');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');

const IS_DEV = process.env.NODE_ENV !== 'production';
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST /api/newsletter/subscribe
 * Add an email to the Resend newsletter audience.
 * Idempotent: re-subscribing an existing email returns 200 without error.
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
    return res.status(200).json({ ok: true });
  }

  const { error } = await resend.contacts.create({
    email,
    audienceId,
    unsubscribed: false,
  });

  // Resend returns an error if the contact already exists in the audience.
  // Treat that as success — signup flow is idempotent.
  if (error && !/already exists/i.test(error.message || '')) {
    console.error('[Newsletter] Resend error:', error);
    return res.status(502).json({ error: 'Subscription failed' });
  }

  res.status(200).json({ ok: true });
}));

module.exports = router;
