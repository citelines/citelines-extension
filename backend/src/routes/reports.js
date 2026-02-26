const express = require('express');
const Report = require('../models/Report');
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

module.exports = router;
