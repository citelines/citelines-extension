// Admin Dashboard - User Details Modal

async function openUserDetailsModal(userId) {
  const modal = document.getElementById('userDetailsModal');
  const body = document.getElementById('userDetailsBody');

  currentUserDetailsId = userId;
  body.innerHTML = '<div class="loading">Loading user details...</div>';
  modal.classList.add('active');

  try {
    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) throw new Error('Failed to load user details');

    const data = await response.json();
    renderUserDetails(data);

  } catch (error) {
    body.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

async function refreshUserDetailsModalIfOpen() {
  const modal = document.getElementById('userDetailsModal');
  if (modal && modal.classList.contains('active') && currentUserDetailsId) {
    const body = document.getElementById('userDetailsBody');
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${currentUserDetailsId}`, {
        headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
      });

      if (!response.ok) throw new Error('Failed to refresh user details');

      const data = await response.json();
      renderUserDetails(data);
    } catch (error) {
      console.error('Failed to refresh user details:', error);
    }
  }
}

function renderUserDetails(data) {
  const { user, citations, adminActions } = data;
  const body = document.getElementById('userDetailsBody');

  // Determine account type
  let accountTypeBadge = '';
  if (user.auth_type === 'anonymous' || user.auth_type === 'expired') {
    accountTypeBadge = '<span class="badge" style="background: #9e9e9e; color: white;">Temporary</span>';
  } else if (user.auth_type === 'password' && user.email_verified) {
    accountTypeBadge = '<span class="badge" style="background: #4caf50; color: white;">Verified</span>';
  } else if (user.auth_type === 'password' && !user.email_verified) {
    accountTypeBadge = '<span class="badge" style="background: #ffc107; color: black;">Unverified</span>';
  } else if (user.auth_type === 'youtube') {
    accountTypeBadge = '<span class="badge" style="background: #ff4444; color: white;">YouTube</span>';
  } else if (user.auth_type === 'youtube_merged') {
    accountTypeBadge = '<span class="badge" style="background: #e91e63; color: white;">YouTube + Email</span>';
  }

  // Status badges
  const statusBadges = [];
  if (user.is_admin) statusBadges.push('<span class="badge badge-admin">Admin</span>');
  if (user.is_banned) statusBadges.push('<span class="badge badge-banned">Suspended</span><span style="font-size:11px;color:#f44336;margin-left:4px;">Permanent</span>');
  else if (user.is_suspended) statusBadges.push('<span class="badge badge-suspended">Suspended</span><span style="font-size:11px;color:#ff9800;margin-left:4px;">Until ' + formatDate(user.suspended_until) + '</span>');
  else statusBadges.push('<span class="badge badge-active">Active</span>');

  const html = `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- User Identifiers -->
      <div class="analytics-section" style="margin: 0;">
        <h2>User Identifiers</h2>
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 14px;">
          <strong>Display Name:</strong> <span>${user.display_name}</span>
          <strong>User ID:</strong> <span><code>${user.id}</code></span>
          <strong>Anonymous ID:</strong> <span><code>${user.anonymous_id || '-'}</code></span>
          <strong>Email:</strong> <span>${user.email || '-'}</span>
        </div>
      </div>

      <!-- Account Status -->
      <div class="analytics-section" style="margin: 0;">
        <h2>Account Status</h2>
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 14px;">
          <strong>Account Type:</strong> <span>${accountTypeBadge}</span>
          <strong>Status:</strong> <span>${statusBadges.join(' ')}</span>
          <strong>Created:</strong> <span>${formatDateTime(user.created_at)}</span>
          <strong>Expires:</strong> <span>${user.expires_at ? formatDateTime(user.expires_at) : 'Never'}</span>
          ${user.is_suspended ? `
            <strong>Suspended Until:</strong> <span>${formatDateTime(user.suspended_until)}</span>
            <strong>Suspension Reason:</strong> <span>${user.suspension_reason || '-'}</span>
          ` : ''}
          ${user.is_banned ? `
            <strong>Suspended (Permanent) Since:</strong> <span>${formatDateTime(user.banned_at)}</span>
            <strong>Reason:</strong> <span>${user.ban_reason || '-'}</span>
          ` : ''}
        </div>
      </div>

      <!-- Citations -->
      <div class="analytics-section" style="margin: 0;">
        <h2>Citations (${citations.length})</h2>
        ${citations.length === 0 ? '<p style="color: #999;">No citations yet</p>' : `
          <div style="max-height: 300px; overflow-y: auto;">
            <table style="width: 100%; font-size: 13px;">
              <thead>
                <tr>
                  <th style="text-align: left;">Video ID</th>
                  <th style="text-align: left;">Text</th>
                  <th style="text-align: left;">Timestamp</th>
                  <th style="text-align: left;">Status</th>
                  <th style="text-align: left; width: 100px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${citations.map(c => {
                  const isDeleted = c.deleted_at;
                  const titleForModal = escapeHtml(c.title || c.video_id);
                  const citContent = formatCitationContent(c.text, c.citation);
                  const citDisplay = citContent.length > 50 ? citContent.substring(0, 50) + '...' : citContent;
                  return `
                  <tr>
                    <td><a href="https://www.youtube.com/watch?v=${c.video_id}" target="_blank" rel="noopener"><code>${c.video_id}</code></a></td>
                    <td class="citation-cell" data-full="${escapeHtml(citContent)}" onclick="showCitationPopover(event)">${escapeHtml(citDisplay)}</td>
                    <td>${c.timestamp ? formatTimestamp(c.timestamp) : '-'}</td>
                    <td>${isDeleted ? '<span class="badge badge-deleted">Deleted</span>' : '<span class="badge badge-active">Active</span>'}</td>
                    <td>
                      ${!isDeleted ?
                        `<button class="action-btn btn-danger" onclick="openDeleteCitationModal('${c.share_token}', '${titleForModal}', '${c.annotation_id}'); event.stopPropagation();" style="font-size: 11px; padding: 4px 8px;">Delete</button>` :
                        `<button class="action-btn btn-success" onclick="openRestoreAnnotationModal('${c.share_token}', '${titleForModal}', '${c.annotation_id}'); event.stopPropagation();" style="font-size: 11px; padding: 4px 8px;">Restore</button>`}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Future Features Placeholders -->
      <div class="analytics-section" style="margin: 0; opacity: 0.5;">
        <h2>Future Features</h2>
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px; font-size: 14px; color: #999;">
          <strong>Proposed Citations:</strong> <span>Coming soon...</span>
          <strong>Approved Citations:</strong> <span>Coming soon...</span>
          <strong>Approval Rate:</strong> <span>Coming soon...</span>
        </div>
      </div>

      <!-- Admin Actions -->
      <div class="analytics-section" style="margin: 0;">
        <h2>Admin Action History (${adminActions.length})</h2>
        ${adminActions.length === 0 ? '<p style="color: #999;">No admin actions taken</p>' : `
          <div style="max-height: 200px; overflow-y: auto;">
            <table style="width: 100%; font-size: 13px;">
              <thead>
                <tr>
                  <th style="text-align: left;">Date</th>
                  <th style="text-align: left;">Admin</th>
                  <th style="text-align: left;">Action</th>
                  <th style="text-align: left;">Reason</th>
                </tr>
              </thead>
              <tbody>
                ${adminActions.map(action => `
                  <tr>
                    <td>${formatDateTime(action.created_at)}</td>
                    <td>${action.admin_display_name || 'Unknown'}</td>
                    <td>${formatActionType(action.action_type)}</td>
                    <td>${action.reason || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;

  body.innerHTML = html;
}

function closeUserDetailsModal() {
  document.getElementById('userDetailsModal').classList.remove('active');
  currentUserDetailsId = null;
}

function closeUserDetailsModalOnOverlay(event) {
  if (event.target.id === 'userDetailsModal') {
    closeUserDetailsModal();
  }
}
