const express = require('express');
const Report = require('../models/Report');
const Share = require('../models/Share');
const { authenticateAnonymous } = require('../middleware/auth');
const { isValidShareToken, sanitizeText } = require('../utils/validator');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * POST /api/reports
 * Submit a report or edit suggestion for a citation
 * Requires authentication
 */
router.post('/', authenticateAnonymous, asyncHandler(async (req, res) => {
  const { shareToken, annotationId, reportType, reason, suggestedText, details } = req.body;

  // Validate report type
  if (!['report', 'suggestion'].includes(reportType)) {
    return res.status(400).json({
      error: 'Invalid report type',
      message: 'reportType must be "report" or "suggestion"'
    });
  }

  // Validate share token
  if (!shareToken || !isValidShareToken(shareToken)) {
    return res.status(400).json({
      error: 'Invalid share token'
    });
  }

  // Reports require a reason
  if (reportType === 'report' && !reason) {
    return res.status(400).json({
      error: 'Reason required',
      message: 'A reason is required for reports'
    });
  }

  // Suggestions require suggested text
  if (reportType === 'suggestion' && !suggestedText) {
    return res.status(400).json({
      error: 'Suggested text required',
      message: 'Suggested text is required for edit suggestions'
    });
  }

  // Sanitize inputs
  const sanitizedReason = reason ? sanitizeText(reason).substring(0, 500) : null;
  const sanitizedDetails = details ? sanitizeText(details).substring(0, 1000) : null;
  const sanitizedSuggestedText = suggestedText ? sanitizeText(suggestedText).substring(0, 2000) : null;

  const report = await Report.create({
    reportType,
    reporterId: req.user.id,
    shareToken,
    annotationId: annotationId || null,
    reason: sanitizedReason,
    suggestedText: sanitizedSuggestedText,
    details: sanitizedDetails
  });

  res.status(201).json({
    id: report.id,
    reportType: report.report_type,
    status: report.status,
    createdAt: report.created_at
  });
}));

/**
 * GET /api/reports/suggestions/:shareToken
 * Get all pending suggestions for a share (owner only)
 */
router.get('/suggestions/:shareToken', authenticateAnonymous, asyncHandler(async (req, res) => {
  const { shareToken } = req.params;

  if (!isValidShareToken(shareToken)) {
    return res.status(400).json({ error: 'Invalid share token' });
  }

  // Check ownership
  const share = await Share.findByToken(shareToken);
  if (!share) {
    return res.status(404).json({ error: 'Share not found' });
  }
  if (share.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the citation owner can view suggestions' });
  }

  const rows = await Report.findByShareToken(shareToken);

  const suggestions = rows.map(r => ({
    id: r.id,
    annotationId: r.annotation_id,
    suggestedText: r.suggested_text,
    reason: r.reason,
    reporterDisplayName: r.reporter_display_name,
    createdAt: r.created_at
  }));

  res.json({ suggestions });
}));

/**
 * GET /api/reports/my-suggestion/:shareToken/:annotationId
 * Get the current user's pending suggestion for a specific annotation
 */
router.get('/my-suggestion/:shareToken/:annotationId', authenticateAnonymous, asyncHandler(async (req, res) => {
  const { shareToken, annotationId } = req.params;

  if (!isValidShareToken(shareToken)) {
    return res.status(400).json({ error: 'Invalid share token' });
  }

  const suggestion = await Report.findUserSuggestion(shareToken, annotationId, req.user.id);

  res.json({
    suggestion: suggestion ? {
      id: suggestion.id,
      suggestedText: suggestion.suggested_text,
      reason: suggestion.reason,
      createdAt: suggestion.created_at
    } : null
  });
}));

/**
 * PUT /api/reports/:reportId
 * Update an existing suggestion (reporter only)
 */
router.put('/:reportId', authenticateAnonymous, asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { suggestedText, reason } = req.body;

  if (!suggestedText) {
    return res.status(400).json({ error: 'Suggested text required' });
  }

  // Verify the report exists and belongs to the current user
  const db = require('../config/database');
  const check = await db.query(
    'SELECT id, reporter_id, status FROM citation_reports WHERE id = $1',
    [reportId]
  );

  if (check.rows.length === 0) {
    return res.status(404).json({ error: 'Suggestion not found' });
  }

  const report = check.rows[0];
  if (report.reporter_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'You can only update your own suggestions' });
  }
  if (report.status !== 'pending') {
    return res.status(400).json({ error: 'Cannot update a suggestion that is no longer pending' });
  }

  const sanitizedSuggestedText = sanitizeText(suggestedText).substring(0, 2000);
  const sanitizedReason = reason ? sanitizeText(reason).substring(0, 500) : null;

  const updated = await Report.updateSuggestion(reportId, sanitizedSuggestedText, sanitizedReason);

  res.json({
    id: updated.id,
    suggestedText: updated.suggested_text,
    reason: updated.reason,
    status: updated.status
  });
}));

/**
 * POST /api/reports/:reportId/accept
 * Accept a suggestion — applies changes to the citation and marks suggestion as resolved.
 * Only the citation owner can accept.
 */
router.post('/:reportId/accept', authenticateAnonymous, asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await Report.findById(reportId);
  if (!report) {
    return res.status(404).json({ error: 'Suggestion not found' });
  }
  if (report.status !== 'pending') {
    return res.status(400).json({ error: 'Suggestion is no longer pending' });
  }
  if (report.report_type !== 'suggestion') {
    return res.status(400).json({ error: 'Only suggestions can be accepted' });
  }

  // Verify the current user owns the citation
  const share = await Share.findByToken(report.share_token);
  if (!share) {
    return res.status(404).json({ error: 'Citation not found' });
  }
  if (share.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the citation owner can accept suggestions' });
  }

  // Parse suggested changes and apply them to the annotation
  let changes;
  try {
    changes = JSON.parse(report.suggested_text);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid suggestion data' });
  }

  const updatedAnnotations = (share.annotations || []).map(ann => {
    if (ann.id !== report.annotation_id) return ann;

    const updated = { ...ann, editedAt: new Date().toISOString() };

    // Apply text change
    if (changes.text !== undefined) {
      updated.text = sanitizeText(changes.text).substring(0, 2000);
    }

    // Apply citation field changes
    if (changes.citation) {
      updated.citation = { ...(updated.citation || {}) };
      for (const [key, val] of Object.entries(changes.citation)) {
        updated.citation[key] = sanitizeText(val);
      }
    }

    return updated;
  });

  // Update the share with applied changes
  await Share.update(report.share_token, { annotations: updatedAnnotations });

  // Mark suggestion as resolved
  await Report.updateStatus(reportId, 'resolved', req.user.id);

  res.json({ message: 'Suggestion accepted and applied' });
}));

/**
 * POST /api/reports/:reportId/dismiss
 * Dismiss a suggestion. Only the citation owner can dismiss.
 */
router.post('/:reportId/dismiss', authenticateAnonymous, asyncHandler(async (req, res) => {
  const { reportId } = req.params;

  const report = await Report.findById(reportId);
  if (!report) {
    return res.status(404).json({ error: 'Suggestion not found' });
  }
  if (report.status !== 'pending') {
    return res.status(400).json({ error: 'Suggestion is no longer pending' });
  }

  // Verify the current user owns the citation
  const share = await Share.findByToken(report.share_token);
  if (!share) {
    return res.status(404).json({ error: 'Citation not found' });
  }
  if (share.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden', message: 'Only the citation owner can dismiss suggestions' });
  }

  await Report.updateStatus(reportId, 'dismissed', req.user.id);

  res.json({ message: 'Suggestion dismissed' });
}));

module.exports = router;
