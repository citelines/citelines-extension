/**
 * Admin Moderation Routes
 * Endpoints for admin-level moderation actions
 */

const express = require('express');
const { authenticateAdmin } = require('../middleware/adminAuth');
const { asyncHandler } = require('../middleware/errorHandler');
const db = require('../config/database');

const router = express.Router();

/**
 * Log admin action to audit trail
 */
async function logAdminAction(adminId, actionType, targetType, targetId, reason, metadata = {}) {
  await db.query(
    `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminId, actionType, targetType, targetId, reason, JSON.stringify(metadata)]
  );
}

// ============================================================================
// CITATION MANAGEMENT
// ============================================================================

/**
 * DELETE /api/admin/citations/:token
 * Delete specific annotation or entire share
 * If annotation_id provided: removes that annotation from JSONB array
 * If annotation_id not provided: soft-deletes entire share (backward compat)
 */
router.delete('/citations/:token', authenticateAdmin, asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { reason, annotation_id } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'Reason required',
      message: 'You must provide a reason for deleting this citation'
    });
  }

  // Find share
  const result = await db.query(
    'SELECT id, share_token, annotations, deleted_by_admin FROM shares WHERE share_token = $1',
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Citation not found'
    });
  }

  const share = result.rows[0];

  // If specific annotation_id provided, soft-delete just that annotation
  if (annotation_id) {
    const annotations = share.annotations || [];

    // DEBUG: Log what we're looking for and what exists
    console.log('[DELETE] Looking for annotation_id:', annotation_id, 'type:', typeof annotation_id);
    console.log('[DELETE] Available annotation IDs:', annotations.map(a => ({ id: a.id, type: typeof a.id })));

    // Try to match annotation ID - handle both string and number types
    // IDs might be stored as numbers in JSONB but sent as strings from frontend
    // Convert both to strings for guaranteed match
    const targetAnnotation = annotations.find(ann => {
      const match = String(ann.id) === String(annotation_id);
      console.log('[DELETE] Comparing:', String(ann.id), '===', String(annotation_id), '→', match);
      return match;
    });

    if (!targetAnnotation) {
      console.log('[DELETE] Annotation NOT FOUND - this will return 404');
      return res.status(404).json({
        error: 'Annotation not found',
        message: 'The specified annotation does not exist in this share'
      });
    }

    console.log('[DELETE] Found target annotation:', targetAnnotation.id);

    // Check if already deleted
    if (targetAnnotation.deleted_at) {
      console.log('[DELETE] Annotation already deleted, returning 400');
      return res.status(400).json({
        error: 'Already deleted',
        message: 'This annotation is already deleted'
      });
    }

    console.log('[DELETE] Original annotations:', JSON.stringify(annotations, null, 2));

    // Mark annotation as deleted (soft delete within JSONB)
    const updatedAnnotations = annotations.map(ann => {
      // Convert both to strings for guaranteed match
      if (String(ann.id) === String(annotation_id)) {
        console.log('[DELETE] MATCH FOUND! Marking annotation', ann.id, 'as deleted');
        return {
          ...ann,
          deleted_at: new Date().toISOString(),
          deleted_by: req.user.id,
          deletion_reason: reason.trim()
        };
      }
      return ann;
    });

    console.log('[DELETE] Updated annotations:', JSON.stringify(updatedAnnotations, null, 2));

    const arraysEqual = JSON.stringify(annotations) === JSON.stringify(updatedAnnotations);
    console.log('[DELETE] Arrays equal?', arraysEqual);

    // If arrays are equal, the annotation wasn't found/modified - this is a bug!
    if (arraysEqual) {
      console.error('[DELETE] ERROR: Annotations array unchanged! ID not matched despite finding target.');
      console.error('[DELETE] Annotation ID being searched:', annotation_id, typeof annotation_id);
      console.error('[DELETE] Target annotation ID found earlier:', targetAnnotation.id, typeof targetAnnotation.id);
      return res.status(500).json({
        error: 'Deletion failed',
        message: 'Annotation was found but could not be modified. Possible type mismatch.',
        debug: {
          searchingFor: annotation_id,
          searchingForType: typeof annotation_id,
          foundId: targetAnnotation.id,
          foundIdType: typeof targetAnnotation.id
        }
      });
    }

    const updateResult = await db.query(
      `UPDATE shares
       SET annotations = $1
       WHERE share_token = $2`,
      [JSON.stringify(updatedAnnotations), token]
    );

    console.log('[DELETE] UPDATE executed, rows affected:', updateResult.rowCount);
    console.log('[DELETE] Updated annotation should now have deleted_at');

    await logAdminAction(
      req.user.id,
      'delete_annotation',
      'share',
      share.id,
      reason.trim(),
      { share_token: token, annotation_id: annotation_id }
    );

    res.json({
      message: 'Annotation deleted successfully',
      shareToken: token,
      annotationId: annotation_id,
      deletedBy: req.user.display_name,
      reason: reason.trim()
    });

  } else {
    // No annotation_id: soft-delete entire share (backward compatibility)
    await db.query(
      `UPDATE shares
       SET deleted_by_admin = $1, deleted_at = NOW(), deletion_reason = $2
       WHERE share_token = $3`,
      [req.user.id, reason.trim(), token]
    );

    await logAdminAction(
      req.user.id,
      'delete_citation',
      'citation',
      share.id,
      reason.trim()
    );

    res.json({
      message: 'Citation deleted successfully (all annotations)',
      shareToken: token,
      deletedBy: req.user.display_name,
      reason: reason.trim()
    });
  }
}));

/**
 * POST /api/admin/citations/:token/restore
 * Restore a deleted citation
 */
router.post('/citations/:token/restore', authenticateAdmin, asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Find citation
  const result = await db.query(
    'SELECT id, share_token, deleted_by_admin FROM shares WHERE share_token = $1',
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Citation not found'
    });
  }

  const citation = result.rows[0];

  if (!citation.deleted_by_admin) {
    return res.status(400).json({
      error: 'Citation not deleted',
      message: 'This citation is not currently deleted'
    });
  }

  // Restore
  await db.query(
    `UPDATE shares
     SET deleted_by_admin = NULL, deleted_at = NULL, deletion_reason = NULL
     WHERE share_token = $1`,
    [token]
  );

  // Log action
  await logAdminAction(
    req.user.id,
    'restore_citation',
    'citation',
    citation.id,
    'Citation restored'
  );

  res.json({
    message: 'Citation restored successfully',
    shareToken: token,
    restoredBy: req.user.display_name
  });
}));

/**
 * POST /api/admin/citations/:token/restore/:annotationId
 * Restore a deleted annotation
 */
router.post('/citations/:token/restore/:annotationId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { token, annotationId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'Reason required',
      message: 'You must provide a reason for restoring this annotation'
    });
  }

  // Find share
  const result = await db.query(
    'SELECT id, share_token, annotations FROM shares WHERE share_token = $1',
    [token]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      error: 'Citation not found'
    });
  }

  const share = result.rows[0];
  const annotations = share.annotations || [];
  const targetAnnotation = annotations.find(ann => ann.id === annotationId);

  if (!targetAnnotation) {
    return res.status(404).json({
      error: 'Annotation not found',
      message: 'The specified annotation does not exist in this share'
    });
  }

  if (!targetAnnotation.deleted_at) {
    return res.status(400).json({
      error: 'Annotation not deleted',
      message: 'This annotation is not currently deleted'
    });
  }

  // Restore annotation (remove deletion fields)
  const updatedAnnotations = annotations.map(ann => {
    if (ann.id === annotationId) {
      const { deleted_at, deleted_by, deletion_reason, ...restored } = ann;
      return restored;
    }
    return ann;
  });

  await db.query(
    `UPDATE shares
     SET annotations = $1
     WHERE share_token = $2`,
    [JSON.stringify(updatedAnnotations), token]
  );

  // Log action
  await logAdminAction(
    req.user.id,
    'restore_annotation',
    'share',
    share.id,
    reason.trim(),
    { share_token: token, annotation_id: annotationId }
  );

  res.json({
    message: 'Annotation restored successfully',
    shareToken: token,
    annotationId: annotationId,
    restoredBy: req.user.display_name,
    reason: reason.trim()
  });
}));

// ============================================================================
// USER SUSPENSION (Temporary)
// ============================================================================

/**
 * POST /api/admin/users/:userId/suspend
 * Suspend user for a designated period
 */
router.post('/users/:userId/suspend', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { duration, reason } = req.body;

  if (!duration || duration <= 0) {
    return res.status(400).json({
      error: 'Invalid duration',
      message: 'Duration must be a positive number of days'
    });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'Reason required',
      message: 'You must provide a reason for suspending this user'
    });
  }

  // Find user
  const userResult = await db.query(
    'SELECT id, display_name, is_admin FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const user = userResult.rows[0];

  // Cannot suspend admins
  if (user.is_admin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cannot suspend admin users'
    });
  }

  // Calculate suspension end time
  const suspendedUntil = new Date();
  suspendedUntil.setDate(suspendedUntil.getDate() + duration);

  // Suspend user
  await db.query(
    `UPDATE users
     SET is_suspended = true, suspended_until = $1, suspension_reason = $2
     WHERE id = $3`,
    [suspendedUntil, reason.trim(), userId]
  );

  // Log action
  await logAdminAction(
    req.user.id,
    'suspend_user',
    'user',
    userId,
    reason.trim(),
    { duration, suspendedUntil }
  );

  res.json({
    message: 'User suspended successfully',
    userId,
    displayName: user.display_name,
    suspendedUntil,
    duration,
    reason: reason.trim(),
    suspendedBy: req.user.display_name
  });
}));

/**
 * POST /api/admin/users/:userId/unsuspend
 * Lift user suspension
 */
router.post('/users/:userId/unsuspend', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Find user
  const userResult = await db.query(
    'SELECT id, display_name, is_suspended FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const user = userResult.rows[0];

  if (!user.is_suspended) {
    return res.status(400).json({
      error: 'User not suspended',
      message: 'This user is not currently suspended'
    });
  }

  // Unsuspend
  await db.query(
    `UPDATE users
     SET is_suspended = false, suspended_until = NULL, suspension_reason = NULL
     WHERE id = $1`,
    [userId]
  );

  // Log action
  await logAdminAction(
    req.user.id,
    'unsuspend_user',
    'user',
    userId,
    'Suspension lifted'
  );

  res.json({
    message: 'User suspension lifted',
    userId,
    displayName: user.display_name,
    unsuspendedBy: req.user.display_name
  });
}));

// ============================================================================
// USER BLOCKING (Permanent)
// ============================================================================

/**
 * POST /api/admin/users/:userId/block
 * Permanently block a user
 */
router.post('/users/:userId/block', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      error: 'Reason required',
      message: 'You must provide a reason for blocking this user'
    });
  }

  // Find user
  const userResult = await db.query(
    'SELECT id, display_name, is_admin FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const user = userResult.rows[0];

  // Cannot block admins
  if (user.is_admin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cannot block admin users'
    });
  }

  // Block user
  await db.query(
    `UPDATE users
     SET is_blocked = true, blocked_at = NOW(), blocked_reason = $1
     WHERE id = $2`,
    [reason.trim(), userId]
  );

  // Log action
  await logAdminAction(
    req.user.id,
    'block_user',
    'user',
    userId,
    reason.trim()
  );

  res.json({
    message: 'User blocked permanently',
    userId,
    displayName: user.display_name,
    reason: reason.trim(),
    blockedBy: req.user.display_name
  });
}));

/**
 * POST /api/admin/users/:userId/unblock
 * Unblock a user
 */
router.post('/users/:userId/unblock', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Find user
  const userResult = await db.query(
    'SELECT id, display_name, is_blocked FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({
      error: 'User not found'
    });
  }

  const user = userResult.rows[0];

  if (!user.is_blocked) {
    return res.status(400).json({
      error: 'User not blocked',
      message: 'This user is not currently blocked'
    });
  }

  // Unblock
  await db.query(
    `UPDATE users
     SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
     WHERE id = $1`,
    [userId]
  );

  // Log action
  await logAdminAction(
    req.user.id,
    'unblock_user',
    'user',
    userId,
    'Block removed'
  );

  res.json({
    message: 'User unblocked successfully',
    userId,
    displayName: user.display_name,
    unblockedBy: req.user.display_name
  });
}));

// ============================================================================
// LISTING & SEARCH
// ============================================================================

/**
 * GET /api/admin/users
 * List users with moderation status
 */
router.get('/users', authenticateAdmin, asyncHandler(async (req, res) => {
  const { status, limit = 100, offset = 0 } = req.query;

  let whereClause = '';
  const params = [];

  if (status === 'suspended') {
    whereClause = 'WHERE is_suspended = true';
  } else if (status === 'blocked') {
    whereClause = 'WHERE is_blocked = true';
  } else if (status === 'active') {
    whereClause = 'WHERE is_suspended = false AND is_blocked = false';
  }

  const result = await db.query(
    `SELECT
      id, display_name, auth_type, email, created_at,
      is_admin, is_suspended, suspended_until, suspension_reason,
      is_blocked, blocked_at, blocked_reason,
      (SELECT COALESCE(SUM(jsonb_array_length(annotations)), 0) FROM shares WHERE user_id = users.id) as total_annotations,
      (SELECT COALESCE(SUM(
        (SELECT COUNT(*) FROM jsonb_array_elements(annotations) AS ann
         WHERE (ann->>'deleted_at') IS NULL)
      ), 0) FROM shares WHERE user_id = users.id) as active_annotations
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit), parseInt(offset)]
  );

  res.json({
    users: result.rows,
    count: result.rows.length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * GET /api/admin/users/:userId
 * Get detailed user information for admin view
 */
router.get('/users/:userId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Get user info
  const userResult = await db.query(
    `SELECT
      id, anonymous_id, display_name, email, email_verified, auth_type,
      created_at, expires_at, is_admin, is_suspended, suspended_until,
      suspension_reason, is_blocked, blocked_at, blocked_reason
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = userResult.rows[0];

  // Get user's citations
  const citationsResult = await db.query(
    `SELECT
      s.share_token, s.video_id, s.title, s.annotations,
      s.created_at, s.deleted_at, s.deletion_reason
     FROM shares s
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );

  // Expand annotations
  const citations = [];
  citationsResult.rows.forEach(share => {
    if (share.annotations && Array.isArray(share.annotations)) {
      share.annotations.forEach(annotation => {
        citations.push({
          share_token: share.share_token,
          video_id: share.video_id,
          title: share.title,
          annotation_id: annotation.id,
          text: annotation.text,
          timestamp: annotation.timestamp,
          created_at: annotation.createdAt || share.created_at,
          deleted_at: annotation.deleted_at,
          deleted_by: annotation.deleted_by,
          deletion_reason: annotation.deletion_reason
        });
      });
    }
  });

  // Get admin actions taken on this user
  const actionsResult = await db.query(
    `SELECT
      aa.action_type, aa.reason, aa.created_at,
      u.display_name as admin_display_name
     FROM admin_actions aa
     LEFT JOIN users u ON aa.admin_id = u.id
     WHERE aa.target_type = 'user' AND aa.target_id = $1
     ORDER BY aa.created_at DESC`,
    [userId]
  );

  res.json({
    user,
    citations,
    adminActions: actionsResult.rows
  });
}));

/**
 * GET /api/admin/citations
 * List citations with delete status
 */
router.get('/citations', authenticateAdmin, asyncHandler(async (req, res) => {
  const { deleted, limit = 100, offset = 0 } = req.query;

  let whereClause = '';
  if (deleted === 'true') {
    whereClause = 'WHERE s.deleted_by_admin IS NOT NULL';
  } else if (deleted === 'false') {
    whereClause = 'WHERE s.deleted_by_admin IS NULL';
  }

  const result = await db.query(
    `SELECT
      s.id, s.share_token, s.video_id, s.title, s.user_id,
      s.annotations, s.view_count, s.created_at,
      s.deleted_by_admin, s.deleted_at, s.deletion_reason,
      u.display_name as creator_display_name,
      admin_user.display_name as deleted_by_display_name
     FROM shares s
     LEFT JOIN users u ON s.user_id = u.id
     LEFT JOIN users admin_user ON s.deleted_by_admin = admin_user.id
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit), parseInt(offset)]
  );

  // Expand each share into individual annotations for admin view
  const expandedCitations = [];

  result.rows.forEach(share => {
    if (share.annotations && Array.isArray(share.annotations)) {
      share.annotations.forEach(annotation => {
        expandedCitations.push({
          share_token: share.share_token,
          annotation_id: annotation.id,  // Individual annotation ID
          video_id: share.video_id,
          title: share.title,
          annotation_text: annotation.text,  // Individual annotation text
          annotation_timestamp: annotation.timestamp,
          annotation_count: share.annotations.length,  // Total in this share
          created_at: share.created_at,
          creator_display_name: share.creator_display_name,
          // Annotation-level deletion (soft delete within JSONB)
          annotation_deleted_at: annotation.deleted_at,
          annotation_deleted_by: annotation.deleted_by,
          annotation_deletion_reason: annotation.deletion_reason,
          // Share-level deletion (entire share soft-deleted)
          share_deleted_at: share.deleted_at,
          share_deleted_by_display_name: share.deleted_by_display_name,
          share_deletion_reason: share.deletion_reason
        });
      });
    }
  });

  res.json({
    citations: expandedCitations,
    count: expandedCitations.length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * GET /api/admin/actions
 * Get audit log of moderation actions
 */
router.get('/actions', authenticateAdmin, asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;

  const result = await db.query(
    `SELECT
      a.id, a.action_type, a.target_type, a.target_id, a.reason,
      a.metadata, a.created_at,
      u.display_name as admin_display_name
     FROM admin_actions a
     LEFT JOIN users u ON a.admin_id = u.id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit), parseInt(offset)]
  );

  res.json({
    actions: result.rows,
    count: result.rows.length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

module.exports = router;
