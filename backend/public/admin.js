// Admin Dashboard JavaScript
// YouTube Annotator

const API_URL = window.location.origin;
let JWT_TOKEN = localStorage.getItem('admin_jwt');
let currentUser = null;
let usersData = [];
let citationsData = [];
let auditData = [];
let analyticsData = null;
let currentAction = null;
let selectedCitations = new Set();

// ============================================================================
// Authentication
// ============================================================================

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  loginError.style.display = 'none';

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }

    JWT_TOKEN = data.token;
    currentUser = data.user;
    localStorage.setItem('admin_jwt', JWT_TOKEN);

    // Verify admin access
    const adminCheck = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!adminCheck.ok) {
      throw new Error('Access denied. Admin privileges required.');
    }

    // Show dashboard
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    document.getElementById('userInfo').textContent = currentUser.displayName || currentUser.email;

    // Load initial data
    loadAllData();

  } catch (error) {
    loginError.textContent = error.message;
    loginError.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

function logout() {
  localStorage.removeItem('admin_jwt');
  JWT_TOKEN = null;
  currentUser = null;
  window.location.reload();
}

// Check if already logged in
if (JWT_TOKEN) {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  loadAllData();
}

// ============================================================================
// Tab Management
// ============================================================================

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.getElementById(`${tabName}Tab`).classList.add('active');

  // Load data if needed
  if (tabName === 'users' && usersData.length === 0) {
    loadUsers();
  } else if (tabName === 'citations' && citationsData.length === 0) {
    loadCitations();
  } else if (tabName === 'analytics' && !analyticsData) {
    loadAnalytics();
  } else if (tabName === 'audit' && auditData.length === 0) {
    loadAudit();
  }
}

// ============================================================================
// Data Loading
// ============================================================================

async function loadAllData() {
  await loadUsers();
}

async function loadUsers() {
  const container = document.getElementById('usersTable');
  container.innerHTML = '<div class="loading">Loading users...</div>';

  try {
    const response = await fetch(`${API_URL}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) throw new Error('Failed to load users');

    const data = await response.json();
    usersData = data.users || [];
    renderUsers(usersData);

  } catch (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

async function loadCitations() {
  const container = document.getElementById('citationsTable');
  container.innerHTML = '<div class="loading">Loading citations...</div>';

  try {
    const response = await fetch(`${API_URL}/api/admin/citations`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) throw new Error('Failed to load citations');

    const data = await response.json();
    citationsData = data.citations || [];
    renderCitations(citationsData);

  } catch (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

async function loadAudit() {
  const container = document.getElementById('auditTable');
  container.innerHTML = '<div class="loading">Loading audit log...</div>';

  try {
    const response = await fetch(`${API_URL}/api/admin/actions`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) throw new Error('Failed to load audit log');

    const data = await response.json();
    auditData = data.actions || [];
    renderAudit(auditData);

  } catch (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

// ============================================================================
// Rendering
// ============================================================================

function renderUsers(users) {
  const container = document.getElementById('usersTable');

  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state">No users found</div>';
    return;
  }

  // Count statistics
  const activeUsers = users.filter(u => !u.is_blocked && !u.is_suspended);
  const suspendedUsers = users.filter(u => u.is_suspended && !u.is_blocked);
  const blockedUsers = users.filter(u => u.is_blocked);

  // Count display (simplified)
  const countHtml = `
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 14px;">
      <strong>Showing ${users.length} user(s)</strong>
    </div>
  `;

  const html = countHtml + `
    <table>
      <thead>
        <tr>
          <th>Display Name</th>
          <th>Email</th>
          <th>Auth Type</th>
          <th>Status</th>
          <th>Annotations (Active/Total)</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr>
            <td>
              ${user.display_name}
              ${user.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
            </td>
            <td>${user.email || '-'}</td>
            <td>${user.auth_type}</td>
            <td>
              ${user.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' :
                user.is_suspended ? '<span class="badge badge-suspended">Suspended</span>' :
                '<span class="badge badge-active">Active</span>'}
            </td>
            <td>${user.active_annotations || 0} / ${user.total_annotations || 0}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>
              <div class="action-buttons">
                ${!user.is_blocked && !user.is_suspended ?
                  `<button class="action-btn btn-danger" onclick="openSuspendModal('${user.id}', '${escapeHtml(user.display_name)}')">Suspend</button>` : ''}
                ${user.is_suspended && !user.is_blocked ?
                  `<button class="action-btn btn-success" onclick="unsuspendUser('${user.id}')">Unsuspend</button>` : ''}
                ${!user.is_blocked ?
                  `<button class="action-btn btn-danger" onclick="openBlockModal('${user.id}', '${escapeHtml(user.display_name)}')">Block</button>` :
                  `<button class="action-btn btn-success" onclick="unblockUser('${user.id}')">Unblock</button>`}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

function renderCitations(citations) {
  const container = document.getElementById('citationsTable');

  if (citations.length === 0) {
    container.innerHTML = '<div class="empty-state">No citations found</div>';
    selectedCitations.clear();
    return;
  }

  // Count statistics
  const activeCitations = citations.filter(c => !c.annotation_deleted_at && !c.share_deleted_at);
  const deletedCitations = citations.filter(c => c.annotation_deleted_at || c.share_deleted_at);

  // Count display (simplified)
  const countHtml = `
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 14px;">
      <strong>Showing ${citations.length} annotation(s)</strong>
    </div>
  `;

  // Bulk actions
  const bulkActionsHtml = activeCitations.length > 0 ? `
    <div style="margin-bottom: 15px; display: flex; gap: 10px; align-items: center;">
      <button class="btn btn-danger" onclick="openBulkDeleteModal()" id="bulkDeleteBtn" disabled>
        Delete Selected (<span id="selectedCount">0</span>)
      </button>
      <button class="btn" onclick="clearSelection()">Clear Selection</button>
    </div>
  ` : '';

  const html = countHtml + bulkActionsHtml + `
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">
            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()"
                   ${activeCitations.length === 0 ? 'disabled' : ''}>
          </th>
          <th>Token</th>
          <th>Video ID</th>
          <th>Title</th>
          <th>Creator</th>
          <th>Content</th>
          <th>Timestamp</th>
          <th>Share Size</th>
          <th>Status</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${citations.map(citation => {
          // Backend now returns individual annotations (one row per annotation)
          const content = citation.annotation_text || '-';
          const displayContent = content.length > 80 ? content.substring(0, 80) + '...' : content;
          const timestamp = citation.annotation_timestamp ? formatTimestamp(citation.annotation_timestamp) : '-';

          // Check if annotation or share is deleted
          const isDeleted = citation.annotation_deleted_at || citation.share_deleted_at;
          const citationKey = `${citation.share_token}:${citation.annotation_id}`;
          const isSelected = selectedCitations.has(citationKey);

          return `
            <tr>
              <td>
                <input type="checkbox"
                       class="citation-checkbox"
                       data-citation-key="${citationKey}"
                       data-share-token="${citation.share_token}"
                       data-annotation-id="${citation.annotation_id}"
                       data-title="${escapeHtml(citation.title || citation.video_id)}"
                       onchange="toggleCitationSelection('${citationKey}')"
                       ${isDeleted ? 'disabled' : ''}
                       ${isSelected ? 'checked' : ''}>
              </td>
              <td><code>${citation.share_token}</code></td>
              <td>${citation.video_id}</td>
              <td>${citation.title || '-'}</td>
              <td>${citation.creator_display_name || '-'}</td>
              <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(content)}">${escapeHtml(displayContent)}</td>
              <td>${timestamp}</td>
              <td>${citation.annotation_count || 0}</td>
              <td>
                ${isDeleted ?
                  '<span class="badge badge-deleted">Deleted</span>' :
                  '<span class="badge badge-active">Active</span>'}
              </td>
              <td>${formatDate(citation.created_at)}</td>
              <td>
                <div class="action-buttons">
                  ${!isDeleted ?
                    `<button class="action-btn btn-danger" onclick="openDeleteCitationModal('${citation.share_token}', '${escapeHtml(citation.title || citation.video_id)}', '${citation.annotation_id}')">Delete</button>` :
                    `<button class="action-btn btn-success" onclick="openRestoreAnnotationModal('${citation.share_token}', '${escapeHtml(citation.title || citation.video_id)}', '${citation.annotation_id}')">Restore</button>`}
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

function renderAudit(actions) {
  const container = document.getElementById('auditTable');

  if (actions.length === 0) {
    container.innerHTML = '<div class="empty-state">No audit log entries found</div>';
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Admin</th>
          <th>Action</th>
          <th>Target</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        ${actions.map(action => `
          <tr>
            <td>${formatDateTime(action.created_at)}</td>
            <td>${action.admin_display_name || action.admin_id}</td>
            <td>${formatActionType(action.action_type)}</td>
            <td>${action.target_type}: ${action.target_id}</td>
            <td>${action.reason || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  container.innerHTML = '<div class="loading">Loading analytics...</div>';

  try {
    // Load users and citations data if not already loaded
    if (usersData.length === 0) {
      const usersResponse = await fetch(`${API_URL}/api/admin/users?limit=1000`, {
        headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
      });
      if (!usersResponse.ok) throw new Error('Failed to load users');
      const usersResult = await usersResponse.json();
      usersData = usersResult.users || [];
    }

    if (citationsData.length === 0) {
      const citationsResponse = await fetch(`${API_URL}/api/admin/citations?limit=10000`, {
        headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
      });
      if (!citationsResponse.ok) throw new Error('Failed to load citations');
      const citationsResult = await citationsResponse.json();
      citationsData = citationsResult.citations || [];
    }

    // Calculate analytics
    analyticsData = {
      users: {
        temporary: usersData.filter(u => u.auth_type === 'anonymous' || u.auth_type === 'expired').length,
        verified: usersData.filter(u => u.auth_type === 'password' && u.email_verified).length,
        unverified: usersData.filter(u => u.auth_type === 'password' && !u.email_verified).length,
        total: usersData.length
      },
      interventions: {
        suspended: usersData.filter(u => u.is_suspended).length,
        blocked: usersData.filter(u => u.is_blocked).length,
        total: usersData.filter(u => u.is_suspended || u.is_blocked).length
      },
      citations: {
        active: citationsData.filter(c => !c.annotation_deleted_at && !c.share_deleted_at).length,
        deleted: citationsData.filter(c => c.annotation_deleted_at || c.share_deleted_at).length,
        total: citationsData.length
      }
    };

    renderAnalytics(analyticsData);

  } catch (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

function renderAnalytics(data) {
  const container = document.getElementById('analyticsContent');

  const html = `
    <!-- User Count Section -->
    <div class="analytics-section">
      <h2>User Count</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Users</div>
          <div class="stat-value">${data.users.total}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Temporary</div>
          <div class="stat-value">${data.users.temporary}</div>
          <div class="stat-subtitle">Anonymous accounts</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Verified</div>
          <div class="stat-value">${data.users.verified}</div>
          <div class="stat-subtitle">Email verified</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-label">Unverified</div>
          <div class="stat-value">${data.users.unverified}</div>
          <div class="stat-subtitle">Pending verification</div>
        </div>
      </div>
    </div>

    <!-- User Interventions Section -->
    <div class="analytics-section">
      <h2>User Interventions</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Interventions</div>
          <div class="stat-value">${data.interventions.total}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Suspended</div>
          <div class="stat-value">${data.interventions.suspended}</div>
          <div class="stat-subtitle">Temporary suspension</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Blocked</div>
          <div class="stat-value">${data.interventions.blocked}</div>
          <div class="stat-subtitle">Permanent block</div>
        </div>
      </div>
    </div>

    <!-- Citation Status Section -->
    <div class="analytics-section">
      <h2>Citation Status</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Citations</div>
          <div class="stat-value">${data.citations.total}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Active</div>
          <div class="stat-value">${data.citations.active}</div>
          <div class="stat-subtitle">Visible to users</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-label">Deleted</div>
          <div class="stat-value">${data.citations.deleted}</div>
          <div class="stat-subtitle">Soft deleted</div>
        </div>
        <div class="stat-card neutral" style="opacity: 0.5;">
          <div class="stat-label">Edited</div>
          <div class="stat-value">—</div>
          <div class="stat-subtitle">Future capability</div>
        </div>
        <div class="stat-card neutral" style="opacity: 0.5;">
          <div class="stat-label">Proposed</div>
          <div class="stat-value">—</div>
          <div class="stat-subtitle">Future capability</div>
        </div>
        <div class="stat-card neutral" style="opacity: 0.5;">
          <div class="stat-label">Approved</div>
          <div class="stat-value">—</div>
          <div class="stat-subtitle">Future capability</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ============================================================================
// Actions
// ============================================================================

function openSuspendModal(userId, displayName) {
  currentAction = { type: 'suspend', userId, displayName };

  document.getElementById('modalTitle').textContent = 'Suspend User';
  document.getElementById('modalDescription').textContent = `Suspend ${displayName}?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="suspendDuration">Duration (days)</label>
      <input type="number" id="suspendDuration" class="search-box" value="7" min="1" max="365" style="width: 100%;">
    </div>
    <div class="form-group">
      <label for="suspendReason">Reason</label>
      <input type="text" id="suspendReason" class="search-box" placeholder="e.g., Spam" style="width: 100%;">
    </div>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Suspend';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.disabled = false; // Ensure button is enabled
  document.getElementById('actionModal').classList.add('active');
}

function openBlockModal(userId, displayName) {
  currentAction = { type: 'block', userId, displayName };

  document.getElementById('modalTitle').textContent = 'Block User';
  document.getElementById('modalDescription').textContent = `Permanently block ${displayName}?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="blockReason">Reason</label>
      <input type="text" id="blockReason" class="search-box" placeholder="e.g., Harassment" style="width: 100%;">
    </div>
    <p style="color: #dc3545; font-size: 14px; margin-top: 10px;">⚠️ This action is permanent and cannot be undone easily.</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Block User';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.disabled = false; // Ensure button is enabled
  document.getElementById('actionModal').classList.add('active');
}

function openDeleteCitationModal(token, title, annotationId) {
  currentAction = { type: 'deleteCitation', token, title, annotationId };

  document.getElementById('modalTitle').textContent = 'Delete Annotation';
  document.getElementById('modalDescription').textContent = `Delete annotation from "${title}"?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="deleteReason">Reason</label>
      <input type="text" id="deleteReason" class="search-box" placeholder="e.g., Inappropriate content" style="width: 100%;">
    </div>
    <p style="color: #666; font-size: 14px; margin-top: 10px;">This will remove only this annotation. If it's the last annotation in the share, the entire share will be soft-deleted.</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Delete';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.disabled = false; // Ensure button is enabled
  document.getElementById('actionModal').classList.add('active');
}

function openRestoreAnnotationModal(token, title, annotationId) {
  currentAction = { type: 'restoreAnnotation', token, title, annotationId };

  document.getElementById('modalTitle').textContent = 'Restore Annotation';
  document.getElementById('modalDescription').textContent = `Restore annotation from "${title}"?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="restoreReason">Reason</label>
      <input type="text" id="restoreReason" class="search-box" placeholder="e.g., Deletion was mistake" style="width: 100%;">
    </div>
    <p style="color: #666; font-size: 14px; margin-top: 10px;">This will make the annotation visible again on YouTube.</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Restore';
  confirmBtn.className = 'btn btn-success';
  confirmBtn.disabled = false; // Ensure button is enabled
  document.getElementById('actionModal').classList.add('active');
}

function closeModal() {
  document.getElementById('actionModal').classList.remove('active');
  currentAction = null;

  // Reset button state
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.disabled = false;
  confirmBtn.textContent = 'Confirm';
}

async function confirmAction() {
  if (!currentAction) return;

  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Processing...';

  try {
    switch (currentAction.type) {
      case 'suspend':
        await suspendUser(
          currentAction.userId,
          document.getElementById('suspendDuration').value,
          document.getElementById('suspendReason').value
        );
        break;
      case 'block':
        await blockUser(
          currentAction.userId,
          document.getElementById('blockReason').value
        );
        break;
      case 'deleteCitation':
        await deleteCitation(
          currentAction.token,
          document.getElementById('deleteReason').value,
          currentAction.annotationId
        );
        break;
      case 'restoreAnnotation':
        await restoreAnnotation(
          currentAction.token,
          currentAction.annotationId,
          document.getElementById('restoreReason').value
        );
        break;
      case 'bulkDelete':
        await bulkDeleteCitations(
          currentAction.citationKeys,
          document.getElementById('bulkDeleteReason').value
        );
        break;
    }

    closeModal();

  } catch (error) {
    alert(`Error: ${error.message}`);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm';
  }
}

async function suspendUser(userId, duration, reason) {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}/suspend`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ duration: parseInt(duration), reason })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to suspend user');
  }

  await loadUsers();
  await loadAudit();
}

async function unsuspendUser(userId) {
  if (!confirm('Unsuspend this user?')) return;

  const response = await fetch(`${API_URL}/api/admin/users/${userId}/unsuspend`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });

  if (!response.ok) throw new Error('Failed to unsuspend user');

  await loadUsers();
  await loadAudit();
}

async function blockUser(userId, reason) {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}/block`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to block user');
  }

  await loadUsers();
  await loadAudit();
}

async function unblockUser(userId) {
  if (!confirm('Unblock this user?')) return;

  const response = await fetch(`${API_URL}/api/admin/users/${userId}/unblock`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });

  if (!response.ok) throw new Error('Failed to unblock user');

  await loadUsers();
  await loadAudit();
}

async function deleteCitationRequest(token, reason, annotationId) {
  const body = { reason };

  // Include annotation_id if provided (for annotation-level deletion)
  if (annotationId) {
    body.annotation_id = annotationId;
  }

  const response = await fetch(`${API_URL}/api/admin/citations/${token}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to delete citation');
  }

  return await response.json();
}

async function deleteCitation(token, reason, annotationId) {
  await deleteCitationRequest(token, reason, annotationId);
  await loadCitations();
  await loadAudit();
}

async function restoreCitation(token) {
  if (!confirm('Restore this citation?')) return;

  const response = await fetch(`${API_URL}/api/admin/citations/${token}/restore`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });

  if (!response.ok) throw new Error('Failed to restore citation');

  await loadCitations();
  await loadAudit();
}

async function restoreAnnotation(token, annotationId, reason) {
  const response = await fetch(`${API_URL}/api/admin/citations/${token}/restore/${annotationId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to restore annotation');
  }

  await loadCitations();
  await loadAudit();
}

// ============================================================================
// Bulk Actions
// ============================================================================

function toggleCitationSelection(citationKey) {
  if (selectedCitations.has(citationKey)) {
    selectedCitations.delete(citationKey);
  } else {
    selectedCitations.add(citationKey);
  }
  updateBulkActionButtons();
}

function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.citation-checkbox:not([disabled])');

  if (selectAllCheckbox.checked) {
    checkboxes.forEach(cb => {
      selectedCitations.add(cb.dataset.citationKey);
      cb.checked = true;
    });
  } else {
    checkboxes.forEach(cb => {
      selectedCitations.delete(cb.dataset.citationKey);
      cb.checked = false;
    });
  }

  updateBulkActionButtons();
}

function clearSelection() {
  selectedCitations.clear();
  document.querySelectorAll('.citation-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('selectAll').checked = false;
  updateBulkActionButtons();
}

function updateBulkActionButtons() {
  const count = selectedCitations.size;
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectedCountSpan = document.getElementById('selectedCount');

  if (bulkDeleteBtn) {
    bulkDeleteBtn.disabled = count === 0;
  }

  if (selectedCountSpan) {
    selectedCountSpan.textContent = count;
  }

  // Update "select all" checkbox state
  const selectAllCheckbox = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.citation-checkbox:not([disabled])');
  if (selectAllCheckbox && checkboxes.length > 0) {
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
  }
}

function openBulkDeleteModal() {
  if (selectedCitations.size === 0) return;

  currentAction = { type: 'bulkDelete', citationKeys: Array.from(selectedCitations) };

  document.getElementById('modalTitle').textContent = 'Delete Multiple Annotations';
  document.getElementById('modalDescription').textContent = `Delete ${selectedCitations.size} annotation(s)?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="bulkDeleteReason">Reason</label>
      <input type="text" id="bulkDeleteReason" class="search-box" placeholder="e.g., Spam" style="width: 100%;">
    </div>
    <p style="color: #666; font-size: 14px; margin-top: 10px;">This will delete ${selectedCitations.size} annotation(s).</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Delete All';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.disabled = false;
  document.getElementById('actionModal').classList.add('active');
}

async function bulkDeleteCitations(citationKeys, reason) {
  const totalCount = citationKeys.length;
  let successCount = 0;
  const failures = [];

  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = `Deleting... (0/${totalCount})`;

  // Get citation data from checkboxes
  const citationsToDelete = citationKeys.map(key => {
    const checkbox = document.querySelector(`[data-citation-key="${key}"]`);
    return {
      key,
      token: checkbox.dataset.shareToken,
      annotationId: checkbox.dataset.annotationId,
      title: checkbox.dataset.title
    };
  });

  // Delete in parallel (limit concurrency to avoid overwhelming server)
  const batchSize = 3; // Reduced from 5 to avoid rate limiting
  for (let i = 0; i < citationsToDelete.length; i += batchSize) {
    const batch = citationsToDelete.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(citation =>
        deleteCitationRequest(citation.token, reason, citation.annotationId)
          .then(() => successCount++)
          .catch(err => {
            console.error(`Failed to delete ${citation.key}:`, err);
            failures.push({ citation, error: err.message });
          })
      )
    );

    confirmBtn.textContent = `Deleting... (${successCount + failures.length}/${totalCount})`;

    // Add small delay between batches to avoid rate limiting
    if (i + batchSize < citationsToDelete.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Clear selection
  selectedCitations.clear();

  if (failures.length > 0) {
    const failureDetails = failures.map(f => `- ${f.citation.title} (${f.citation.token}): ${f.error}`).join('\n');
    alert(`Deleted ${successCount} annotation(s). ${failures.length} failed:\n\n${failureDetails}`);
  } else {
    alert(`Successfully deleted ${successCount} annotation(s).`);
  }

  await loadCitations();
  await loadAudit();
}

// ============================================================================
// Search/Filter
// ============================================================================

function filterUsers() {
  const search = document.getElementById('userSearch').value.toLowerCase();
  const filtered = usersData.filter(user =>
    (user.display_name?.toLowerCase().includes(search)) ||
    (user.email?.toLowerCase().includes(search))
  );
  renderUsers(filtered);
}

function filterCitations() {
  const search = document.getElementById('citationSearch').value.toLowerCase();
  const filtered = citationsData.filter(citation => {
    // Check token, video ID, title, creator
    if ((citation.share_token?.toLowerCase().includes(search)) ||
        (citation.video_id?.toLowerCase().includes(search)) ||
        (citation.title?.toLowerCase().includes(search)) ||
        (citation.creator_display_name?.toLowerCase().includes(search))) {
      return true;
    }

    // Check annotation content (now directly on citation object)
    if (citation.annotation_text?.toLowerCase().includes(search)) {
      return true;
    }

    return false;
  });
  renderCitations(filtered);
}

function filterAudit() {
  const search = document.getElementById('auditSearch').value.toLowerCase();
  const filtered = auditData.filter(action =>
    (action.action_type?.toLowerCase().includes(search)) ||
    (action.reason?.toLowerCase().includes(search))
  );
  renderAudit(filtered);
}

// ============================================================================
// Utilities
// ============================================================================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatActionType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTimestamp(seconds) {
  if (!seconds && seconds !== 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
