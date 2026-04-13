/**
 * Email service for sending verification and password reset emails
 *
 * Development mode: Logs email content to console
 * Production mode: Send real emails via Resend (implement when domain ready)
 */

const IS_DEV = process.env.NODE_ENV !== 'production';
const APP_URL = process.env.APP_URL || 'https://www.citelines.org';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Citelines <noreply@citelines.org>';

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email verification link
 * @param {string} email - Recipient email
 * @param {string} token - Verification token
 * @param {string} displayName - User's display name
 */
async function sendVerificationEmail(email, token, displayName) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  if (IS_DEV) {
    console.log('\n========================================');
    console.log('📧 EMAIL VERIFICATION');
    console.log('========================================');
    console.log('To:', email);
    console.log('Subject: Verify your Citelines account');
    console.log('');
    console.log(`Hi ${displayName},`);
    console.log('');
    console.log('Welcome to Citelines! Please verify your email address:');
    console.log('');
    console.log('Verification URL:');
    console.log(verifyUrl);
    console.log('');
    console.log('This link expires in 24 hours.');
    console.log('');
    console.log('If you didn\'t create this account, you can safely ignore this email.');
    console.log('========================================\n');
    return;
  }

  // Production: Send real email via Resend
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Verify your Citelines account',
    html: generateVerificationEmailHTML(displayName, verifyUrl)
  });
}

/**
 * Send password reset link
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} displayName - User's display name
 */
async function sendPasswordResetEmail(email, token, displayName) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  if (IS_DEV) {
    console.log('\n========================================');
    console.log('📧 PASSWORD RESET');
    console.log('========================================');
    console.log('To:', email);
    console.log('Subject: Reset your password');
    console.log('');
    console.log(`Hi ${displayName},`);
    console.log('');
    console.log('We received a request to reset your password. Click the link below:');
    console.log('');
    console.log('Reset URL:');
    console.log(resetUrl);
    console.log('');
    console.log('This link expires in 1 hour.');
    console.log('');
    console.log('If you didn\'t request this, you can safely ignore this email.');
    console.log('========================================\n');
    return;
  }

  // Production: Send real email via Resend
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your password',
    html: generatePasswordResetEmailHTML(displayName, resetUrl)
  });
}

/**
 * Send welcome email after successful verification
 * @param {string} email - Recipient email
 * @param {string} displayName - User's display name
 * @param {number} citationCount - Number of citations linked to account
 */
async function sendWelcomeEmail(email, displayName, citationCount = 0) {
  if (IS_DEV) {
    console.log('\n========================================');
    console.log('📧 WELCOME EMAIL');
    console.log('========================================');
    console.log('To:', email);
    console.log('Subject: Welcome to YouTube Annotator!');
    console.log('');
    console.log(`Welcome, ${displayName}!`);
    console.log('');
    console.log('Your account has been verified successfully.');
    if (citationCount > 0) {
      console.log(`We've linked your ${citationCount} existing citations to your new account.`);
    }
    console.log('');
    console.log('Start annotating YouTube videos with the community!');
    console.log('========================================\n');
    return;
  }

  // Production: Send real email
}

/**
 * Generate HTML for verification email (for production)
 */
function generateVerificationEmailHTML(displayName, verifyUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #0497a6;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Welcome to Citelines, ${displayName}!</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verifyUrl}" class="button">Verify Email Address</a>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>This link expires in 24 hours.</p>
        <div class="footer">
          <p>If you didn't create this account, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML for password reset email (for production)
 */
function generatePasswordResetEmailHTML(displayName, resetUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #0497a6;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
        }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Password Reset Request</h2>
        <p>Hi ${displayName},</p>
        <p>We received a request to reset your password. Click the button below to reset it:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p>Or copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link expires in 1 hour.</p>
        <div class="footer">
          <p>If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send newsletter welcome email with unsubscribe link.
 * @param {string} email - Recipient email
 * @param {string} unsubscribeUrl - Full URL to the unsubscribe page (with token)
 * @param {string} oneClickUnsubscribeUrl - API URL for one-click unsubscribe (List-Unsubscribe header)
 */
async function sendNewsletterWelcomeEmail(email, unsubscribeUrl, oneClickUnsubscribeUrl) {
  if (IS_DEV) {
    console.log('\n========================================');
    console.log('📧 NEWSLETTER WELCOME');
    console.log('========================================');
    console.log('To:', email);
    console.log('Unsubscribe URL:', unsubscribeUrl);
    console.log('One-click URL:', oneClickUnsubscribeUrl);
    console.log('========================================\n');
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to the Citelines newsletter',
    html: generateNewsletterWelcomeHTML(unsubscribeUrl),
    headers: {
      'List-Unsubscribe': `<${oneClickUnsubscribeUrl}>, <${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
}

function generateNewsletterWelcomeHTML(unsubscribeUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .brand { font-size: 1.5rem; font-weight: 700; color: #0497a6; margin-bottom: 1rem; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 16px; }
        .footer a { color: #888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">Cite<span style="color:#e8943a">|</span>ines</div>
        <p>Thanks for subscribing to the Citelines newsletter.</p>
        <p>You'll hear from us occasionally with product updates, community highlights, and thoughts on citation culture online.</p>
        <p>— The Citelines team</p>
        <div class="footer">
          <p>You're receiving this because you subscribed at <a href="https://www.citelines.org">citelines.org</a>.</p>
          <p><a href="${unsubscribeUrl}">Unsubscribe</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNewsletterWelcomeEmail
};
