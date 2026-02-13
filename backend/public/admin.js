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
let usersSortColumn = 'created_at';
let usersSortDirection = 'desc';
let citationsSortColumn = 'created_at';
let citationsSortDirection = 'desc';
let usersFilters = {}; // { columnName: [selectedValues] }
let citationsFilters = {}; // { columnName: [selectedValues] }
let activeFilterDropdown = null;

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

  // Count display
  const countHtml = `
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 14px;">
      <strong>Showing ${users.length} user(s)</strong>
    </div>
  `;

  const columnHeader = (column, label) => {
    const hasFilter = usersFilters[column] && usersFilters[column].length > 0;
    return `
      <th style="position: relative; user-select: none;">
        <span onclick="toggleUserColumnFilter(event, '${column}')" style="cursor: pointer;">
          ${label}
          <span class="column-filter-btn ${hasFilter ? 'active' : ''}">▼</span>
        </span>
        <div id="userFilter_${column}" class="filter-dropdown"></div>
      </th>
    `;
  };

  const html = countHtml + `
    <table>
      <thead>
        <tr>
          ${columnHeader('display_name', 'Display Name')}
          ${columnHeader('email', 'Email')}
          ${columnHeader('auth_type', 'Auth Type')}
          ${columnHeader('status', 'Status')}
          ${columnHeader('total_annotations', 'Annotations')}
          ${columnHeader('created_at', 'Joined')}
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

function sortUsers(column) {
  if (usersSortColumn === column) {
    usersSortDirection = usersSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    usersSortColumn = column;
    usersSortDirection = 'asc';
  }

  applyUserFilter();
}

function getSortedFilteredUsers() {
  const search = document.getElementById('userSearch')?.value.toLowerCase() || '';

  let filtered = usersData.filter(user => {
    // Apply search filter
    const matchesSearch = !search ||
      (user.display_name?.toLowerCase().includes(search)) ||
      (user.email?.toLowerCase().includes(search));

    if (!matchesSearch) return false;

    // Apply column filters
    for (const [column, values] of Object.entries(usersFilters)) {
      if (values.length === 0) continue;

      let columnValue;
      switch (column) {
        case 'display_name':
          columnValue = user.display_name || '';
          break;
        case 'email':
          columnValue = user.email || '';
          break;
        case 'auth_type':
          columnValue = user.auth_type || '';
          break;
        case 'status':
          columnValue = user.is_blocked ? 'Blocked' : user.is_suspended ? 'Suspended' : 'Active';
          break;
        case 'total_annotations':
          columnValue = (user.total_annotations || 0).toString();
          break;
        case 'created_at':
          columnValue = formatDate(user.created_at);
          break;
        default:
          columnValue = '';
      }

      const isMatch = values.includes(columnValue);
      if (column === 'auth_type') {
        console.log('[DEBUG] Checking auth_type:', columnValue, 'against', values, '=> match:', isMatch);
      }

      if (!isMatch) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA, valB;

    switch (usersSortColumn) {
      case 'display_name':
        valA = (a.display_name || '').toLowerCase();
        valB = (b.display_name || '').toLowerCase();
        break;
      case 'email':
        valA = (a.email || '').toLowerCase();
        valB = (b.email || '').toLowerCase();
        break;
      case 'auth_type':
        valA = a.auth_type || '';
        valB = b.auth_type || '';
        break;
      case 'status':
        valA = a.is_blocked ? 2 : a.is_suspended ? 1 : 0;
        valB = b.is_blocked ? 2 : b.is_suspended ? 1 : 0;
        break;
      case 'total_annotations':
        valA = a.total_annotations || 0;
        valB = b.total_annotations || 0;
        break;
      case 'created_at':
        valA = new Date(a.created_at || 0);
        valB = new Date(b.created_at || 0);
        break;
      default:
        return 0;
    }

    if (valA < valB) return usersSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return usersSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

function applyUserFilter() {
  console.log('[DEBUG] Applying user filter, current filters:', JSON.parse(JSON.stringify(usersFilters)));
  const filtered = getSortedFilteredUsers();
  console.log('[DEBUG] Filtered users:', filtered.length, 'out of', usersData.length);
  renderUsers(filtered);
}

function toggleUserColumnFilter(event, column) {
  event.stopPropagation();

  const dropdownId = `userFilter_${column}`;
  const dropdown = document.getElementById(dropdownId);

  // Close other dropdowns
  if (activeFilterDropdown && activeFilterDropdown !== dropdown) {
    activeFilterDropdown.classList.remove('active');
  }

  // Toggle current dropdown
  const isActive = dropdown.classList.contains('active');

  if (isActive) {
    dropdown.classList.remove('active');
    activeFilterDropdown = null;
  } else {
    // Get unique values for this column
    const uniqueValues = getUniqueUserColumnValues(column);
    const currentFilters = usersFilters[column] || [];

    // Build dropdown content
    dropdown.innerHTML = `
      <div class="filter-section">
        <div class="filter-section-title">Sort</div>
        <div class="sort-option" onclick="sortUsersFromFilter('${column}', 'asc')">
          ${usersSortColumn === column && usersSortDirection === 'asc' ? '✓ ' : ''}Sort A → Z
        </div>
        <div class="sort-option" onclick="sortUsersFromFilter('${column}', 'desc')">
          ${usersSortColumn === column && usersSortDirection === 'desc' ? '✓ ' : ''}Sort Z → A
        </div>
      </div>
      <div class="filter-section" style="max-height: 300px; overflow-y: auto;">
        <div class="filter-section-title">Filter</div>
        ${uniqueValues.map(value => `
          <label class="filter-option">
            <input type="checkbox"
                   value="${escapeHtml(value)}"
                   ${currentFilters.includes(value) ? 'checked' : ''}
                   onchange="updateUserColumnFilter('${column}', this)">
            <span>${escapeHtml(value || '(Empty)')}</span>
          </label>
        `).join('')}
      </div>
      <div class="filter-actions">
        <button onclick="clearUserColumnFilter('${column}')" style="background: #f5f5f5; color: #333;">Clear</button>
        <button onclick="closeFilterDropdown()" class="btn" style="background: #0497a6; color: white;">Done</button>
      </div>
    `;

    dropdown.classList.add('active');
    activeFilterDropdown = dropdown;
  }
}

function getUniqueUserColumnValues(column) {
  const values = new Set();

  usersData.forEach(user => {
    let value;
    switch (column) {
      case 'display_name':
        value = user.display_name || '';
        break;
      case 'email':
        value = user.email || '';
        break;
      case 'auth_type':
        value = user.auth_type || '';
        break;
      case 'status':
        value = user.is_blocked ? 'Blocked' : user.is_suspended ? 'Suspended' : 'Active';
        break;
      case 'total_annotations':
        value = (user.total_annotations || 0).toString();
        break;
      case 'created_at':
        value = formatDate(user.created_at);
        break;
      default:
        value = '';
    }
    values.add(value);
  });

  return Array.from(values).sort();
}

function updateUserColumnFilter(column, checkbox) {
  if (!usersFilters[column]) {
    usersFilters[column] = [];
  }

  const value = checkbox.value;

  if (checkbox.checked) {
    if (!usersFilters[column].includes(value)) {
      usersFilters[column].push(value);
    }
  } else {
    usersFilters[column] = usersFilters[column].filter(v => v !== value);
  }

  console.log('[DEBUG] Filter updated:', column, 'values:', usersFilters[column]);
  // Don't apply filter immediately - wait for user to click Done
  // This prevents the dropdown from being destroyed while they're using it
}

function clearUserColumnFilter(column) {
  delete usersFilters[column];
  applyUserFilter();
  closeFilterDropdown();
}

function sortUsersFromFilter(column, direction) {
  usersSortColumn = column;
  usersSortDirection = direction;
  applyUserFilter();
  closeFilterDropdown();
}

function closeFilterDropdown() {
  console.log('[DEBUG] closeFilterDropdown called, activeFilterDropdown:', activeFilterDropdown);
  if (activeFilterDropdown) {
    activeFilterDropdown.classList.remove('active');
    activeFilterDropdown = null;

    // Apply filters after closing dropdown (apply both since only one tab is visible)
    const usersTabActive = document.getElementById('usersTab').classList.contains('active');
    const citationsTabActive = document.getElementById('citationsTab').classList.contains('active');
    console.log('[DEBUG] usersTab active:', usersTabActive, 'citationsTab active:', citationsTabActive);

    if (usersTabActive) {
      console.log('[DEBUG] Applying user filter from closeFilterDropdown');
      applyUserFilter();
    } else if (citationsTabActive) {
      console.log('[DEBUG] Applying citation filter from closeFilterDropdown');
      applyCitationFilter();
    }
  }
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

  // Count display
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

  const citationColumnHeader = (column, label) => {
    const hasFilter = citationsFilters[column] && citationsFilters[column].length > 0;
    return `
      <th style="position: relative; user-select: none;">
        <span onclick="toggleCitationColumnFilter(event, '${column}')" style="cursor: pointer;">
          ${label}
          <span class="column-filter-btn ${hasFilter ? 'active' : ''}">▼</span>
        </span>
        <div id="citationFilter_${column}" class="filter-dropdown"></div>
      </th>
    `;
  };

  const html = countHtml + bulkActionsHtml + `
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">
            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()"
                   ${activeCitations.length === 0 ? 'disabled' : ''}>
          </th>
          <th>Token</th>
          ${citationColumnHeader('video_id', 'Video ID')}
          ${citationColumnHeader('title', 'Title')}
          ${citationColumnHeader('creator_display_name', 'Creator')}
          <th>Content</th>
          <th>Timestamp</th>
          <th>Share Size</th>
          ${citationColumnHeader('status', 'Status')}
          ${citationColumnHeader('created_at', 'Created')}
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

function sortCitations(column) {
  if (citationsSortColumn === column) {
    citationsSortDirection = citationsSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    citationsSortColumn = column;
    citationsSortDirection = 'asc';
  }

  applyCitationFilter();
}

function getSortedFilteredCitations() {
  const search = document.getElementById('citationSearch')?.value.toLowerCase() || '';

  let filtered = citationsData.filter(citation => {
    // Apply search filter
    const matchesSearch = !search ||
      (citation.share_token?.toLowerCase().includes(search)) ||
      (citation.video_id?.toLowerCase().includes(search)) ||
      (citation.title?.toLowerCase().includes(search)) ||
      (citation.creator_display_name?.toLowerCase().includes(search)) ||
      (citation.annotation_text?.toLowerCase().includes(search));

    if (!matchesSearch) return false;

    // Apply column filters
    for (const [column, values] of Object.entries(citationsFilters)) {
      if (values.length === 0) continue;

      let columnValue;
      switch (column) {
        case 'video_id':
          columnValue = citation.video_id || '';
          break;
        case 'title':
          columnValue = citation.title || '';
          break;
        case 'creator_display_name':
          columnValue = citation.creator_display_name || '';
          break;
        case 'status':
          columnValue = (citation.annotation_deleted_at || citation.share_deleted_at) ? 'Deleted' : 'Active';
          break;
        case 'created_at':
          columnValue = formatDate(citation.created_at);
          break;
        default:
          columnValue = '';
      }

      if (!values.includes(columnValue)) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    let valA, valB;

    switch (citationsSortColumn) {
      case 'share_token':
        valA = (a.share_token || '').toLowerCase();
        valB = (b.share_token || '').toLowerCase();
        break;
      case 'video_id':
        valA = (a.video_id || '').toLowerCase();
        valB = (b.video_id || '').toLowerCase();
        break;
      case 'title':
        valA = (a.title || '').toLowerCase();
        valB = (b.title || '').toLowerCase();
        break;
      case 'creator_display_name':
        valA = (a.creator_display_name || '').toLowerCase();
        valB = (b.creator_display_name || '').toLowerCase();
        break;
      case 'annotation_timestamp':
        valA = a.annotation_timestamp || 0;
        valB = b.annotation_timestamp || 0;
        break;
      case 'annotation_count':
        valA = a.annotation_count || 0;
        valB = b.annotation_count || 0;
        break;
      case 'status':
        valA = (a.annotation_deleted_at || a.share_deleted_at) ? 1 : 0;
        valB = (b.annotation_deleted_at || b.share_deleted_at) ? 1 : 0;
        break;
      case 'created_at':
        valA = new Date(a.created_at || 0);
        valB = new Date(b.created_at || 0);
        break;
      default:
        return 0;
    }

    if (valA < valB) return citationsSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return citationsSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

function applyCitationFilter() {
  const filtered = getSortedFilteredCitations();
  renderCitations(filtered);
}

function toggleCitationColumnFilter(event, column) {
  event.stopPropagation();

  const dropdownId = `citationFilter_${column}`;
  const dropdown = document.getElementById(dropdownId);

  // Close other dropdowns
  if (activeFilterDropdown && activeFilterDropdown !== dropdown) {
    activeFilterDropdown.classList.remove('active');
  }

  const isActive = dropdown.classList.contains('active');

  if (isActive) {
    dropdown.classList.remove('active');
    activeFilterDropdown = null;
  } else {
    const uniqueValues = getUniqueCitationColumnValues(column);
    const currentFilters = citationsFilters[column] || [];

    dropdown.innerHTML = `
      <div class="filter-section">
        <div class="filter-section-title">Sort</div>
        <div class="sort-option" onclick="sortCitationsFromFilter('${column}', 'asc')">
          ${citationsSortColumn === column && citationsSortDirection === 'asc' ? '✓ ' : ''}Sort A → Z
        </div>
        <div class="sort-option" onclick="sortCitationsFromFilter('${column}', 'desc')">
          ${citationsSortColumn === column && citationsSortDirection === 'desc' ? '✓ ' : ''}Sort Z → A
        </div>
      </div>
      <div class="filter-section" style="max-height: 300px; overflow-y: auto;">
        <div class="filter-section-title">Filter</div>
        ${uniqueValues.map(value => `
          <label class="filter-option">
            <input type="checkbox"
                   value="${escapeHtml(value)}"
                   ${currentFilters.includes(value) ? 'checked' : ''}
                   onchange="updateCitationColumnFilter('${column}', this)">
            <span>${escapeHtml(value || '(Empty)')}</span>
          </label>
        `).join('')}
      </div>
      <div class="filter-actions">
        <button onclick="clearCitationColumnFilter('${column}')" style="background: #f5f5f5; color: #333;">Clear</button>
        <button onclick="closeFilterDropdown()" class="btn" style="background: #0497a6; color: white;">Done</button>
      </div>
    `;

    dropdown.classList.add('active');
    activeFilterDropdown = dropdown;
  }
}

function getUniqueCitationColumnValues(column) {
  const values = new Set();

  citationsData.forEach(citation => {
    let value;
    switch (column) {
      case 'video_id':
        value = citation.video_id || '';
        break;
      case 'title':
        value = citation.title || '';
        break;
      case 'creator_display_name':
        value = citation.creator_display_name || '';
        break;
      case 'status':
        value = (citation.annotation_deleted_at || citation.share_deleted_at) ? 'Deleted' : 'Active';
        break;
      case 'created_at':
        value = formatDate(citation.created_at);
        break;
      default:
        value = '';
    }
    values.add(value);
  });

  return Array.from(values).sort();
}

function updateCitationColumnFilter(column, checkbox) {
  if (!citationsFilters[column]) {
    citationsFilters[column] = [];
  }

  const value = checkbox.value;

  if (checkbox.checked) {
    if (!citationsFilters[column].includes(value)) {
      citationsFilters[column].push(value);
    }
  } else {
    citationsFilters[column] = citationsFilters[column].filter(v => v !== value);
  }

  // Don't apply filter immediately - wait for user to click Done
}

function clearCitationColumnFilter(column) {
  delete citationsFilters[column];
  applyCitationFilter();
  closeFilterDropdown();
}

function sortCitationsFromFilter(column, direction) {
  citationsSortColumn = column;
  citationsSortDirection = direction;
  applyCitationFilter();
  closeFilterDropdown();
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
  applyUserFilter();
}

function filterCitations() {
  applyCitationFilter();
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

// Close filter dropdown when clicking outside
document.addEventListener('click', function(event) {
  if (activeFilterDropdown && !event.target.closest('.filter-dropdown') && !event.target.closest('.column-filter-btn')) {
    closeFilterDropdown();
  }
});
