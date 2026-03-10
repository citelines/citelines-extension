// Admin Dashboard JavaScript
// YouTube Annotator

console.log('[DEBUG] ===== admin.js loaded at', new Date().toISOString(), '=====');

// Map raw auth_type + email_verified to display label
function getAuthTypeLabel(user) {
  if (user.auth_type === 'youtube') return 'YouTube';
  if (user.auth_type === 'youtube_merged') return 'YouTube + Email';
  if (user.auth_type === 'password' && user.email_verified) return 'Password - Verified';
  if (user.auth_type === 'password' && !user.email_verified) return 'Password - Unverified';
  return 'Anonymous';
}

const API_URL = window.location.origin;
let JWT_TOKEN = localStorage.getItem('admin_jwt');
let currentUser = null;
let usersData = [];
let citationsData = [];
let auditData = [];
let reportsData = [];
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
let activeFilterTrigger = null; // Track the th element that opened the dropdown
let currentUserDetailsId = null; // Track the user ID being viewed in modal

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

    // Restore last active tab (or load default data)
    restoreActiveTab();

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
  restoreActiveTab();
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

  // Save active tab to localStorage
  localStorage.setItem('admin_active_tab', tabName);

  // Load data if needed
  if (tabName === 'users' && usersData.length === 0) {
    loadUsers();
  } else if (tabName === 'citations' && citationsData.length === 0) {
    loadCitations();
  } else if (tabName === 'analytics' && !analyticsData) {
    loadAnalytics();
  } else if (tabName === 'audit' && auditData.length === 0) {
    loadAudit();
  } else if (tabName === 'reports' && reportsData.length === 0) {
    loadReports();
  }
}

// Restore last active tab on page load
function restoreActiveTab() {
  const savedTab = localStorage.getItem('admin_active_tab');
  if (savedTab && ['users', 'citations', 'analytics', 'audit', 'reports'].includes(savedTab)) {
    // Remove default active states
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Find and activate the saved tab
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.textContent.toLowerCase() === savedTab ||
          (savedTab === 'audit' && tab.textContent === 'Audit Log') ||
          (savedTab === 'reports' && tab.textContent === 'Reports')) {
        tab.classList.add('active');
      }
    });

    // Activate the saved tab content
    document.getElementById(`${savedTab}Tab`).classList.add('active');

    // Load data for the saved tab
    if (savedTab === 'users') {
      loadUsers();
    } else if (savedTab === 'citations') {
      loadCitations();
    } else if (savedTab === 'analytics') {
      loadAnalytics();
    } else if (savedTab === 'audit') {
      loadAudit();
    } else if (savedTab === 'reports') {
      loadReports();
    }
  } else {
    // Default to users tab
    loadAllData();
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
  const activeUsers = users.filter(u => !u.is_banned && !u.is_suspended);
  const suspendedUsers = users.filter(u => u.is_suspended && !u.is_banned);
  const bannedUsers = users.filter(u => u.is_banned);

  // Count display
  const countHtml = `
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 14px;">
      <strong>Showing ${users.length} user(s)</strong>
    </div>
  `;

  const columnHeader = (column, label, options = {}) => {
    const { showFilter = false, showSort = true } = options;
    const hasFilter = usersFilters[column] && usersFilters[column].length > 0;

    if (showSort || showFilter) {
      return `
        <th style="user-select: none;">
          <span onclick="toggleUserColumnFilter(event, '${column}')" style="cursor: pointer;">
            ${label}
            <span class="column-filter-btn ${hasFilter ? 'active' : ''}">▼</span>
          </span>
        </th>
      `;
    } else {
      return `<th>${label}</th>`;
    }
  };

  const html = countHtml + `
    <table>
      <thead>
        <tr>
          ${columnHeader('display_name', 'Display Name', { showSort: true, showFilter: false })}
          ${columnHeader('email', 'Email', { showSort: true, showFilter: false })}
          ${columnHeader('auth_type', 'Auth Type', { showSort: true, showFilter: true })}
          ${columnHeader('status', 'Status', { showSort: true, showFilter: true })}
          ${columnHeader('total_annotations', 'Citations (Active / Total)', { showSort: true, showFilter: false })}
          ${columnHeader('created_at', 'Joined', { showSort: true, showFilter: true })}
          <th style="width: 310px; padding-right: 40px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(user => `
          <tr>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(user.display_name)}">
              ${user.display_name}
              ${user.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
            </td>
            <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(user.email || '-')}">${user.email || '-'}</td>
            <td style="width: 160px;">${getAuthTypeLabel(user)}</td>
            <td style="width: 120px;">
              ${user.is_banned ? '<span class="badge badge-banned">Suspended</span><span style="font-size:11px;color:#f44336;display:block;">Permanent</span>' :
                user.is_suspended ? '<span class="badge badge-suspended">Suspended</span><span style="font-size:11px;color:#ff9800;display:block;">Until ' + formatDate(user.suspended_until) + '</span>' :
                '<span class="badge badge-active">Active</span>'}
            </td>
            <td style="width: 120px;">${user.active_annotations || 0} / ${user.total_annotations || 0}</td>
            <td style="width: 120px;">${formatDate(user.created_at)}</td>
            <td style="width: 310px; padding-right: 40px;">
              <div class="action-buttons">
                <button class="action-btn" onclick="openUserDetailsModal('${user.id}')" style="background: #0497a6; color: white;">View</button>
                ${!user.is_banned && !user.is_suspended ?
                  `<button class="action-btn btn-danger" onclick="openSuspendModal('${user.id}', '${escapeHtml(user.display_name)}')">Suspend</button>` : ''}
                ${user.is_suspended && !user.is_banned ?
                  `<button class="action-btn btn-success" onclick="unsuspendUser('${user.id}')">Unsuspend</button>` : ''}
                ${!user.is_banned ?
                  `<button class="action-btn btn-danger" onclick="openBanModal('${user.id}', '${escapeHtml(user.display_name)}')">Suspend Permanently</button>` :
                  `<button class="action-btn btn-success" onclick="unbanUser('${user.id}')">Unsuspend</button>`}
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
          columnValue = getAuthTypeLabel(user);
          break;
        case 'status':
          columnValue = user.is_banned ? 'Suspended' : user.is_suspended ? 'Suspended' : 'Active';
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
        valA = getAuthTypeLabel(a);
        valB = getAuthTypeLabel(b);
        break;
      case 'status':
        valA = a.is_banned ? 2 : a.is_suspended ? 1 : 0;
        valB = b.is_banned ? 2 : b.is_suspended ? 1 : 0;
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

  // Clean up any lingering dropdowns before re-render
  if (activeFilterDropdown) {
    console.log('[DEBUG] Cleaning up activeFilterDropdown before render');
    activeFilterDropdown.remove();
    activeFilterDropdown = null;
  }

  const filtered = getSortedFilteredUsers();
  console.log('[DEBUG] Filtered users:', filtered.length, 'out of', usersData.length);
  renderUsers(filtered);
}

function toggleUserColumnFilter(event, column) {
  event.stopPropagation();

  console.log('[DEBUG] toggleUserColumnFilter called for column:', column);

  const dropdownId = `userFilter_${column}`;

  // Remove any existing dropdowns for this column
  const existingDropdowns = document.querySelectorAll(`#${dropdownId}`);
  existingDropdowns.forEach(d => d.remove());

  let dropdown = document.getElementById(dropdownId);

  // Close other dropdowns
  if (activeFilterDropdown && activeFilterDropdown !== dropdown) {
    activeFilterDropdown.classList.remove('active');
    if (activeFilterDropdown.parentElement === document.body) {
      activeFilterDropdown.remove();
    }
  }

  // Toggle current dropdown
  const isActive = dropdown && dropdown.classList.contains('active');

  if (isActive) {
    dropdown.classList.remove('active');
    if (dropdown.parentElement === document.body) {
      dropdown.remove();
    }
    activeFilterDropdown = null;
  } else {
    // Remove old dropdown if it exists
    if (dropdown && dropdown.parentElement === document.body) {
      dropdown.remove();
    }

    // Create new dropdown in body
    dropdown = document.createElement('div');
    dropdown.id = dropdownId;
    dropdown.className = 'filter-dropdown';
    document.body.appendChild(dropdown);
    // Determine if this column should show filter options
    const filterableColumns = ['auth_type', 'status', 'created_at'];
    const showFilter = filterableColumns.includes(column);

    // Get unique values for this column if filterable
    const uniqueValues = showFilter ? getUniqueUserColumnValues(column) : [];
    const currentFilters = usersFilters[column] || [];

    console.log('Column:', column, 'Show filter:', showFilter, 'Unique values:', uniqueValues, 'Current filters:', currentFilters);

    // Build dropdown content
    let filterSection = '';
    if (showFilter && column === 'created_at') {
      // Date range filter for Joined column (TODO: implement date range picker)
      filterSection = `
        <div class="filter-section">
          <div class="filter-section-title">Filter by Date</div>
          <div style="padding: 10px; color: #666; font-size: 13px;">Date range filtering coming soon...</div>
        </div>
      `;
    } else if (showFilter) {
      // Standard checkbox filter
      filterSection = `
        <div class="filter-section">
          <div class="filter-section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Filter</span>
            <div style="display: flex; gap: 8px;">
              <span onclick="selectAllUserFilters('${column}')" style="cursor: pointer; font-size: 11px; color: #0497a6; font-weight: normal;">Select All</span>
              <span onclick="clearAllUserFilters('${column}')" style="cursor: pointer; font-size: 11px; color: #666; font-weight: normal;">Clear All</span>
            </div>
          </div>
          ${uniqueValues.map(value => `
            <label class="filter-option">
              <input type="checkbox"
                     value="${escapeHtml(value)}"
                     ${currentFilters.includes(value) ? 'checked' : ''}
                     onchange="updateUserColumnFilter('${column}', this)"
                     data-filter-checkbox="${column}">
              <span>${escapeHtml(value || '(Empty)')}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

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
      ${filterSection}
      <div class="filter-actions">
        ${showFilter ? '<button onclick="clearUserColumnFilter(\'' + column + '\')" style="background: #f5f5f5; color: #333;">Clear</button>' : ''}
        <button onclick="closeFilterDropdown()" class="btn" style="background: #0497a6; color: white;">Done</button>
      </div>
    `;

    console.log('Dropdown HTML length:', dropdown.innerHTML.length);
    console.log('Dropdown children:', dropdown.children.length);
    Array.from(dropdown.children).forEach((child, i) => {
      console.log(`Child ${i}:`, child.className, child.children.length);
    });

    dropdown.classList.add('active');
    activeFilterDropdown = dropdown;
    activeFilterTrigger = event.target.closest('th'); // Store trigger for repositioning on scroll

    // Wait for content to render, then position
    requestAnimationFrame(() => {
      const triggerElement = activeFilterTrigger;
      const rect = triggerElement.getBoundingClientRect();

      // Get the actual height of dropdown content
      dropdown.style.visibility = 'hidden';
      dropdown.style.display = 'block';
      dropdown.style.maxHeight = 'none';
      const contentHeight = dropdown.scrollHeight;
      dropdown.style.visibility = '';

      // Calculate available space
      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const spaceAbove = rect.top - 10;
      const idealMaxHeight = Math.min(400, contentHeight);

      // Decide positioning
      if (spaceBelow >= idealMaxHeight) {
        // Position below - attached to bottom of header
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.bottom = 'auto';
        dropdown.style.maxHeight = `${idealMaxHeight}px`;
      } else if (spaceAbove >= idealMaxHeight) {
        // Position above - attached to top of header
        dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
        dropdown.style.top = 'auto';
        dropdown.style.maxHeight = `${idealMaxHeight}px`;
      } else {
        // Use whichever side has more space
        if (spaceBelow >= spaceAbove) {
          dropdown.style.top = `${rect.bottom}px`;
          dropdown.style.bottom = 'auto';
          dropdown.style.maxHeight = `${Math.max(250, spaceBelow)}px`;
        } else {
          dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
          dropdown.style.top = 'auto';
          dropdown.style.maxHeight = `${Math.max(250, spaceAbove)}px`;
        }
      }

      dropdown.style.left = `${rect.left}px`;
      dropdown.style.minWidth = `${rect.width}px`;
    });
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
        value = getAuthTypeLabel(user);
        break;
      case 'status':
        value = user.is_banned ? 'Suspended' : user.is_suspended ? 'Suspended' : 'Active';
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

function selectAllUserFilters(column) {
  const checkboxes = document.querySelectorAll(`input[data-filter-checkbox="${column}"]`);
  checkboxes.forEach(cb => {
    cb.checked = true;
    if (!usersFilters[column]) {
      usersFilters[column] = [];
    }
    if (!usersFilters[column].includes(cb.value)) {
      usersFilters[column].push(cb.value);
    }
  });
}

function clearAllUserFilters(column) {
  const checkboxes = document.querySelectorAll(`input[data-filter-checkbox="${column}"]`);
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  usersFilters[column] = [];
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

    // Remove from body if it was appended there
    if (activeFilterDropdown.parentElement === document.body) {
      activeFilterDropdown.remove();
    }

    activeFilterDropdown = null;
    activeFilterTrigger = null;

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

// Reposition filter dropdown to stay aligned with trigger element
function repositionFilterDropdown() {
  if (!activeFilterDropdown || !activeFilterTrigger) return;

  const dropdown = activeFilterDropdown;
  const rect = activeFilterTrigger.getBoundingClientRect();

  // Calculate available space
  const spaceBelow = window.innerHeight - rect.bottom - 10;
  const spaceAbove = rect.top - 10;

  // Get current max height (or use a default)
  const currentMaxHeight = parseInt(dropdown.style.maxHeight) || 400;

  // Decide positioning (similar logic to initial positioning)
  if (spaceBelow >= currentMaxHeight) {
    dropdown.style.top = `${rect.bottom}px`;
    dropdown.style.bottom = 'auto';
  } else if (spaceAbove >= currentMaxHeight) {
    dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
    dropdown.style.top = 'auto';
  } else {
    if (spaceBelow >= spaceAbove) {
      dropdown.style.top = `${rect.bottom}px`;
      dropdown.style.bottom = 'auto';
    } else {
      dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
      dropdown.style.top = 'auto';
    }
  }

  dropdown.style.left = `${rect.left}px`;
  dropdown.style.minWidth = `${rect.width}px`;
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
        Delete Selected (<span id="deleteSelectedCount">0</span>)
      </button>
      <button class="btn btn-success" onclick="openBulkRestoreModal()" id="bulkRestoreBtn" disabled>
        Restore Selected (<span id="restoreSelectedCount">0</span>)
      </button>
      <button class="btn" onclick="clearSelection()">Clear Selection</button>
    </div>
  ` : '';

  const citationColumnHeader = (column, label, options = {}) => {
    const { showFilter = false, showSort = true } = options;
    const hasFilter = citationsFilters[column] && citationsFilters[column].length > 0;

    if (showSort || showFilter) {
      return `
        <th style="user-select: none;">
          <span onclick="toggleCitationColumnFilter(event, '${column}')" style="cursor: pointer;">
            ${label}
            <span class="column-filter-btn ${hasFilter ? 'active' : ''}">▼</span>
          </span>
        </th>
      `;
    } else {
      return `<th>${label}</th>`;
    }
  };

  const html = countHtml + bulkActionsHtml + `
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">
            <input type="checkbox" id="selectAll" onchange="toggleSelectAll()"
                   ${activeCitations.length === 0 ? 'disabled' : ''}>
          </th>
          <th>Share Token</th>
          <th>Annotation ID</th>
          <th>Video ID</th>
          ${citationColumnHeader('title', 'Title', { showSort: true, showFilter: false })}
          ${citationColumnHeader('creator_display_name', 'Creator', { showSort: true, showFilter: true })}
          ${citationColumnHeader('annotation_text', 'Citation Content', { showSort: true, showFilter: false })}
          ${citationColumnHeader('annotation_timestamp', 'Video Timestamp', { showSort: true, showFilter: false })}
          ${citationColumnHeader('status', 'Status', { showSort: true, showFilter: true })}
          ${citationColumnHeader('created_at', 'Created', { showSort: true, showFilter: true })}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${citations.map(citation => {
          // Backend now returns individual annotations (one row per annotation)
          const content = formatCitationContent(citation.annotation_text, citation.annotation_citation);
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
                       data-deleted="${isDeleted ? 'true' : 'false'}"
                       onchange="toggleCitationSelection('${citationKey}')"
                       ${isSelected ? 'checked' : ''}>
              </td>
              <td><code>${citation.share_token}</code></td>
              <td><code>${citation.annotation_id}</code></td>
              <td>${citation.video_id}</td>
              <td>${citation.title || '-'}</td>
              <td>${citation.user_id ?
                `<a href="javascript:void(0)" onclick="openUserDetailsModal('${citation.user_id}')" style="color: #0497a6; text-decoration: none; cursor: pointer;">${citation.creator_display_name}</a>` :
                (citation.creator_display_name || '-')}</td>
              <td class="citation-cell" data-full="${escapeHtml(content)}" onclick="showCitationPopover(event)">${escapeHtml(displayContent)}</td>
              <td>${timestamp}</td>
              <td>
                ${isDeleted ?
                  '<span class="badge badge-deleted">Deleted</span>' :
                  '<span class="badge badge-active">Active</span>'}
                ${citation.has_pending_report ? ' <span class="badge badge-reported">Reported</span>' : ''}
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

      if (column === 'status') {
        // Status is multi-valued: a citation can be Active+Reported or Deleted+Reported
        const statusValue = (citation.annotation_deleted_at || citation.share_deleted_at) ? 'Deleted' : 'Active';
        const citationStatuses = [statusValue];
        if (citation.has_pending_report) citationStatuses.push('Reported');
        // Match if any of the citation's statuses are in the filter
        if (!citationStatuses.some(s => values.includes(s))) {
          return false;
        }
        continue;
      }

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
      case 'annotation_text':
        valA = (a.annotation_text || '').toLowerCase();
        valB = (b.annotation_text || '').toLowerCase();
        break;
      case 'annotation_timestamp':
        valA = a.annotation_timestamp || 0;
        valB = b.annotation_timestamp || 0;
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
  let dropdown = document.getElementById(dropdownId);

  // Close other dropdowns
  if (activeFilterDropdown && activeFilterDropdown !== dropdown) {
    activeFilterDropdown.classList.remove('active');
    if (activeFilterDropdown.parentElement === document.body) {
      activeFilterDropdown.remove();
    }
  }

  const isActive = dropdown && dropdown.classList.contains('active');

  if (isActive) {
    dropdown.classList.remove('active');
    if (dropdown.parentElement === document.body) {
      dropdown.remove();
    }
    activeFilterDropdown = null;
  } else {
    // Remove old dropdown if it exists
    if (dropdown && dropdown.parentElement === document.body) {
      dropdown.remove();
    }

    // Create new dropdown in body
    dropdown = document.createElement('div');
    dropdown.id = dropdownId;
    dropdown.className = 'filter-dropdown';
    document.body.appendChild(dropdown);

    // Determine if this column should show filter options
    const filterableColumns = ['creator_display_name', 'status', 'created_at'];
    const showFilter = filterableColumns.includes(column);

    // Get unique values for this column if filterable
    const uniqueValues = showFilter ? getUniqueCitationColumnValues(column) : [];
    const currentFilters = citationsFilters[column] || [];

    // Build dropdown content
    let filterSection = '';
    if (showFilter && column === 'created_at') {
      // Date range filter for Created column (placeholder)
      filterSection = `
        <div class="filter-section">
          <div class="filter-section-title">Filter by Date</div>
          <div style="padding: 10px; color: #666; font-size: 13px;">Date range filtering coming soon...</div>
        </div>
      `;
    } else if (showFilter) {
      // Standard checkbox filter
      filterSection = `
        <div class="filter-section">
          <div class="filter-section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>Filter</span>
            <div style="display: flex; gap: 8px;">
              <span onclick="selectAllCitationFilters('${column}')" style="cursor: pointer; font-size: 11px; color: #0497a6; font-weight: normal;">Select All</span>
              <span onclick="clearAllCitationFilters('${column}')" style="cursor: pointer; font-size: 11px; color: #666; font-weight: normal;">Clear All</span>
            </div>
          </div>
          ${uniqueValues.map(value => `
            <label class="filter-option">
              <input type="checkbox"
                     value="${escapeHtml(value)}"
                     ${currentFilters.includes(value) ? 'checked' : ''}
                     onchange="updateCitationColumnFilter('${column}', this)"
                     data-filter-checkbox="${column}">
              <span>${escapeHtml(value || '(Empty)')}</span>
            </label>
          `).join('')}
        </div>
      `;
    }

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
      ${filterSection}
      <div class="filter-actions">
        ${showFilter ? '<button onclick="clearCitationColumnFilter(\'' + column + '\')" style="background: #f5f5f5; color: #333;">Clear</button>' : ''}
        <button onclick="closeFilterDropdown()" class="btn" style="background: #0497a6; color: white;">Done</button>
      </div>
    `;

    dropdown.classList.add('active');
    activeFilterDropdown = dropdown;
    activeFilterTrigger = event.target.closest('th'); // Store trigger for repositioning on scroll

    // Wait for content to render, then position
    requestAnimationFrame(() => {
      const triggerElement = activeFilterTrigger;
      const rect = triggerElement.getBoundingClientRect();

      // Get the actual height of dropdown content
      dropdown.style.visibility = 'hidden';
      dropdown.style.display = 'block';
      dropdown.style.maxHeight = 'none';
      const contentHeight = dropdown.scrollHeight;
      dropdown.style.visibility = '';

      // Calculate available space
      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const spaceAbove = rect.top - 10;
      const idealMaxHeight = Math.min(400, contentHeight);

      // Decide positioning
      if (spaceBelow >= idealMaxHeight) {
        // Position below - attached to bottom of header
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.bottom = 'auto';
        dropdown.style.maxHeight = `${idealMaxHeight}px`;
      } else if (spaceAbove >= idealMaxHeight) {
        // Position above - attached to top of header
        dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
        dropdown.style.top = 'auto';
        dropdown.style.maxHeight = `${idealMaxHeight}px`;
      } else {
        // Use whichever side has more space
        if (spaceBelow >= spaceAbove) {
          dropdown.style.top = `${rect.bottom}px`;
          dropdown.style.bottom = 'auto';
          dropdown.style.maxHeight = `${Math.max(250, spaceBelow)}px`;
        } else {
          dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
          dropdown.style.top = 'auto';
          dropdown.style.maxHeight = `${Math.max(250, spaceAbove)}px`;
        }
      }

      dropdown.style.left = `${rect.left}px`;
      dropdown.style.minWidth = `${rect.width}px`;
    });
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
      case 'status': {
        value = (citation.annotation_deleted_at || citation.share_deleted_at) ? 'Deleted' : 'Active';
        values.add(value);
        if (citation.has_pending_report) values.add('Reported');
        return; // Already added
      }
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

function selectAllCitationFilters(column) {
  const checkboxes = document.querySelectorAll(`input[data-filter-checkbox="${column}"]`);
  checkboxes.forEach(cb => {
    cb.checked = true;
    if (!citationsFilters[column]) {
      citationsFilters[column] = [];
    }
    if (!citationsFilters[column].includes(cb.value)) {
      citationsFilters[column].push(cb.value);
    }
  });
}

function clearAllCitationFilters(column) {
  const checkboxes = document.querySelectorAll(`input[data-filter-checkbox="${column}"]`);
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  citationsFilters[column] = [];
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

    // Fetch event analytics
    const eventResponse = await fetch(`${API_URL}/api/admin/analytics?days=30`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    const eventData = eventResponse.ok ? await eventResponse.json() : { totals: {}, timeseries: [] };

    // Calculate analytics
    analyticsData = {
      events: eventData,
      users: {
        anonymous: usersData.filter(u => u.auth_type === 'anonymous' || u.auth_type === 'expired').length,
        passwordVerified: usersData.filter(u => u.auth_type === 'password' && u.email_verified).length,
        passwordUnverified: usersData.filter(u => u.auth_type === 'password' && !u.email_verified).length,
        youtube: usersData.filter(u => u.auth_type === 'youtube').length,
        youtubeMerged: usersData.filter(u => u.auth_type === 'youtube_merged').length,
        total: usersData.filter(u => u.auth_type !== 'merged').length
      },
      interventions: {
        temporary: usersData.filter(u => u.is_suspended && !u.is_banned).length,
        permanent: usersData.filter(u => u.is_banned).length,
        total: usersData.filter(u => u.is_suspended || u.is_banned).length
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

  const events = data.events || { totals: {}, timeseries: [] };
  const totals = events.totals || {};
  const timeseries = events.timeseries || [];

  // Build time series table rows
  let timeseriesHtml = '';
  if (timeseries.length > 0) {
    // Find max values for inline bar charts
    const maxViews = Math.max(...timeseries.map(r => r.video_viewed || 0), 1);
    const maxClicks = Math.max(...timeseries.map(r => r.citation_clicked || 0), 1);

    timeseriesHtml = `
      <div style="max-height: 400px; overflow-y: auto; margin-top: 15px;">
        <table style="width: 100%; font-size: 13px;">
          <thead>
            <tr>
              <th style="text-align: left;">Date</th>
              <th style="text-align: right;">Installs</th>
              <th style="text-align: right;">Video Views</th>
              <th style="text-align: right;">Citation Clicks</th>
              <th style="text-align: right;">Unique Sessions</th>
            </tr>
          </thead>
          <tbody>
            ${timeseries.slice().reverse().map(row => `
              <tr>
                <td>${row.date}</td>
                <td style="text-align: right;">${row.extension_installed || 0}</td>
                <td style="text-align: right;">
                  <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
                    <div style="height:10px;width:${((row.video_viewed || 0)/maxViews)*80}px;background:#0497a6;border-radius:2px;"></div>
                    ${row.video_viewed || 0}
                  </div>
                </td>
                <td style="text-align: right;">
                  <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
                    <div style="height:10px;width:${((row.citation_clicked || 0)/maxClicks)*80}px;background:#0497a6;border-radius:2px;"></div>
                    ${row.citation_clicked || 0}
                  </div>
                </td>
                <td style="text-align: right;">${row.video_viewed_unique || row.citation_clicked_unique || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    timeseriesHtml = '<p style="color: #999; margin-top: 10px;">No event data yet. Events will appear after the extension update is installed.</p>';
  }

  const html = `
    <!-- Extension Activity Section -->
    <div class="analytics-section">
      <h2>Extension Activity</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Installs</div>
          <div class="stat-value">${totals.extension_installed || 0}</div>
          <div class="stat-subtitle">All-time</div>
        </div>
        <div class="stat-card" style="border-left-color: #0497a6;">
          <div class="stat-label">Video Views (30d)</div>
          <div class="stat-value">${totals.video_viewed || 0}</div>
          <div class="stat-subtitle">YouTube pages loaded with extension</div>
        </div>
        <div class="stat-card" style="border-left-color: #0497a6;">
          <div class="stat-label">Citation Clicks (30d)</div>
          <div class="stat-value">${totals.citation_clicked || 0}</div>
          <div class="stat-subtitle">Markers + sidebar clicks</div>
        </div>
      </div>
      ${timeseriesHtml}
    </div>

    <!-- User Count Section -->
    <div class="analytics-section">
      <h2>User Count</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Users</div>
          <div class="stat-value">${data.users.total}</div>
          <div class="stat-subtitle">Users who have added citations to videos or created a Citelines account</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-label">Anonymous</div>
          <div class="stat-value">${data.users.anonymous}</div>
          <div class="stat-subtitle">Temporary accounts</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-label">Password - Unverified</div>
          <div class="stat-value">${data.users.passwordUnverified}</div>
          <div class="stat-subtitle">Pending email verification</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Password - Verified</div>
          <div class="stat-value">${data.users.passwordVerified}</div>
          <div class="stat-subtitle">Email verified</div>
        </div>
        <div class="stat-card" style="border-left-color: #ffaa3e;">
          <div class="stat-label">YouTube</div>
          <div class="stat-value">${data.users.youtube}</div>
          <div class="stat-subtitle">YouTube OAuth accounts</div>
        </div>
        <div class="stat-card" style="border-left-color: #ffaa3e;">
          <div class="stat-label">YouTube + Email</div>
          <div class="stat-value">${data.users.youtubeMerged}</div>
          <div class="stat-subtitle">Merged YouTube + email accounts</div>
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
        <div class="stat-card caution">
          <div class="stat-label">Suspended (Temporary)</div>
          <div class="stat-value">${data.interventions.temporary}</div>
          <div class="stat-subtitle">Time-limited suspension</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Suspended (Permanent)</div>
          <div class="stat-value">${data.interventions.permanent}</div>
          <div class="stat-subtitle">Permanent suspension</div>
        </div>
      </div>
    </div>

    <!-- Citation Status Section -->
    <div class="analytics-section">
      <h2>Citation Status</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Lifetime Citations</div>
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

function openBanModal(userId, displayName) {
  currentAction = { type: 'ban', userId, displayName };

  document.getElementById('modalTitle').textContent = 'Suspend Permanently';
  document.getElementById('modalDescription').textContent = `Permanently suspend ${displayName}? This will also soft-delete all their citations and ban associated IPs.`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="banReason">Reason</label>
      <input type="text" id="banReason" class="search-box" placeholder="e.g., Harassment" style="width: 100%;">
    </div>
    <p style="color: #dc3545; font-size: 14px; margin-top: 10px;">⚠️ This will permanently suspend the user, soft-delete their citations, and ban their recent IPs.</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Suspend Permanently';
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
      case 'ban':
        await banUser(
          currentAction.userId,
          document.getElementById('banReason').value
        );
        break;
      case 'deleteCitation':
        await deleteCitation(
          currentAction.token,
          document.getElementById('deleteReason').value,
          currentAction.annotationId,
          currentAction.reportId
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
      case 'bulkRestore':
        await bulkRestoreCitations(
          currentAction.citationKeys,
          document.getElementById('bulkRestoreReason').value
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

async function banUser(userId, reason) {
  const response = await fetch(`${API_URL}/api/admin/users/${userId}/ban`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to suspend user');
  }

  await loadUsers();
  await loadCitations();
  await loadAudit();
}

async function unbanUser(userId) {
  if (!confirm('Unsuspend this user? Their citations will be restored.')) return;

  const response = await fetch(`${API_URL}/api/admin/users/${userId}/unban`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
  });

  if (!response.ok) throw new Error('Failed to unsuspend user');

  await loadUsers();
  await loadCitations();
  await loadAudit();
}

async function deleteCitationRequest(token, reason, annotationId) {
  const body = { reason };

  // Include annotation_id if provided (for annotation-level deletion)
  if (annotationId) {
    body.annotation_id = annotationId;
  }

  // DEBUG: Log exactly what we're sending
  console.log('[Frontend DELETE] Sending request:', {
    token,
    annotationId,
    annotationIdType: typeof annotationId,
    body
  });

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
    console.error('[Frontend DELETE] Failed:', data);
    throw new Error(data.error || 'Failed to delete citation');
  }

  const result = await response.json();
  console.log('[Frontend DELETE] Success:', result);
  return result;
}

async function deleteCitation(token, reason, annotationId, reportId) {
  await deleteCitationRequest(token, reason, annotationId);
  if (reportId) {
    await resolveReport(reportId);
    await loadReports();
  }
  await loadCitations();
  await loadAudit();
  await refreshUserDetailsModalIfOpen();
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
  await refreshUserDetailsModalIfOpen();
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
  const checkboxes = document.querySelectorAll('.citation-checkbox');

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
  // Count active vs deleted selections
  let activeCount = 0;
  let deletedCount = 0;

  selectedCitations.forEach(key => {
    const checkbox = document.querySelector(`.citation-checkbox[data-citation-key="${key}"]`);
    if (checkbox) {
      if (checkbox.dataset.deleted === 'true') {
        deletedCount++;
      } else {
        activeCount++;
      }
    }
  });

  // Update Delete Selected button (for active citations)
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const deleteSelectedCountSpan = document.getElementById('deleteSelectedCount');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.disabled = activeCount === 0;
  }
  if (deleteSelectedCountSpan) {
    deleteSelectedCountSpan.textContent = activeCount;
  }

  // Update Restore Selected button (for deleted citations)
  const bulkRestoreBtn = document.getElementById('bulkRestoreBtn');
  const restoreSelectedCountSpan = document.getElementById('restoreSelectedCount');
  if (bulkRestoreBtn) {
    bulkRestoreBtn.disabled = deletedCount === 0;
  }
  if (restoreSelectedCountSpan) {
    restoreSelectedCountSpan.textContent = deletedCount;
  }

  // Update "select all" checkbox state
  const selectAllCheckbox = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.citation-checkbox');
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

  // Group citations by share token to avoid race conditions
  // Citations from the same share must be processed sequentially
  const citationsByToken = {};
  citationsToDelete.forEach(citation => {
    if (!citationsByToken[citation.token]) {
      citationsByToken[citation.token] = [];
    }
    citationsByToken[citation.token].push(citation);
  });

  console.log('[Bulk Delete] Grouped by token:', Object.keys(citationsByToken).map(token =>
    `${token}: ${citationsByToken[token].length} citations`
  ));

  // Process each share's citations sequentially to avoid race conditions
  // Different shares can be processed in parallel (batch size 3)
  const shareTokens = Object.keys(citationsByToken);
  const batchSize = 3;

  for (let i = 0; i < shareTokens.length; i += batchSize) {
    const tokenBatch = shareTokens.slice(i, i + batchSize);

    await Promise.allSettled(
      tokenBatch.map(async token => {
        const citations = citationsByToken[token];
        // Process this share's citations one at a time
        for (const citation of citations) {
          try {
            await deleteCitationRequest(citation.token, reason, citation.annotationId);
            successCount++;
          } catch (err) {
            console.error(`Failed to delete ${citation.key}:`, err);
            failures.push({ citation, error: err.message });
          }
          confirmBtn.textContent = `Deleting... (${successCount + failures.length}/${totalCount})`;
        }
      })
    );

    // Add small delay between batches
    if (i + batchSize < shareTokens.length) {
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

function openBulkRestoreModal() {
  if (selectedCitations.size === 0) return;

  // Filter to only deleted citations
  const deletedKeys = Array.from(selectedCitations).filter(key => {
    const checkbox = document.querySelector(`.citation-checkbox[data-citation-key="${key}"]`);
    return checkbox && checkbox.dataset.deleted === 'true';
  });

  if (deletedKeys.length === 0) {
    alert('No deleted citations selected.');
    return;
  }

  currentAction = { type: 'bulkRestore', citationKeys: deletedKeys };

  document.getElementById('modalTitle').textContent = 'Restore Multiple Annotations';
  document.getElementById('modalDescription').textContent = `Restore ${deletedKeys.length} annotation(s)?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="bulkRestoreReason">Reason</label>
      <input type="text" id="bulkRestoreReason" class="search-box" placeholder="e.g., False positive" style="width: 100%;">
    </div>
    <p style="color: #666; font-size: 14px; margin-top: 10px;">This will restore ${deletedKeys.length} annotation(s).</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Restore All';
  confirmBtn.className = 'btn btn-success';
  confirmBtn.disabled = false;
  document.getElementById('actionModal').classList.add('active');
}

async function bulkRestoreCitations(citationKeys, reason) {
  const totalCount = citationKeys.length;
  let successCount = 0;
  const failures = [];

  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = `Restoring... (0/${totalCount})`;

  // Get citation data from checkboxes
  const citationsToRestore = citationKeys.map(key => {
    const checkbox = document.querySelector(`[data-citation-key="${key}"]`);
    return {
      key,
      token: checkbox.dataset.shareToken,
      annotationId: checkbox.dataset.annotationId,
      title: checkbox.dataset.title
    };
  });

  // Process each citation
  for (let i = 0; i < citationsToRestore.length; i++) {
    const citation = citationsToRestore[i];
    try {
      await restoreAnnotation(citation.token, citation.annotationId, reason);
      successCount++;
      confirmBtn.textContent = `Restoring... (${successCount}/${totalCount})`;
    } catch (error) {
      console.error(`Failed to restore citation ${citation.token}:${citation.annotationId}:`, error);
      failures.push({ citation, error: error.message });
    }
  }

  closeModal();

  // Clear selection
  selectedCitations.clear();

  if (failures.length > 0) {
    const failureDetails = failures.map(f => `- ${f.citation.title} (${f.citation.token}): ${f.error}`).join('\n');
    alert(`Restored ${successCount} annotation(s). ${failures.length} failed:\n\n${failureDetails}`);
  } else {
    alert(`Successfully restored ${successCount} annotation(s).`);
  }

  await loadCitations();
  await loadAudit();
}

// ============================================================================
// Reports
// ============================================================================

async function loadReports() {
  const container = document.getElementById('reportsTable');
  container.innerHTML = '<div class="loading">Loading reports...</div>';

  const status = document.getElementById('reportStatusFilter')?.value || 'pending';

  try {
    const response = await fetch(`${API_URL}/api/admin/reports?status=${status}&limit=200`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) throw new Error('Failed to load reports');

    const data = await response.json();
    reportsData = data.reports || [];
    renderReports(reportsData);

  } catch (error) {
    container.innerHTML = `<div class="empty-state">Error: ${error.message}</div>`;
  }
}

function renderReports(reports) {
  const container = document.getElementById('reportsTable');

  if (reports.length === 0) {
    container.innerHTML = '<div class="empty-state">No reports found</div>';
    return;
  }

  const html = `
    <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 14px;">
      <strong>Showing ${reports.length} report(s)</strong>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Reporter</th>
          <th>Type</th>
          <th>Share Token</th>
          <th>Video ID</th>
          <th>Annotation Text</th>
          <th>Reason</th>
          <th>Details</th>
          <th>Status</th>
          <th style="width: 280px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map(report => {
          const isPending = report.status === 'pending';
          const annotationText = formatCitationContent(report.annotation_text, report.annotation_citation);
          const displayText = annotationText.length > 60 ? annotationText.substring(0, 60) + '...' : annotationText;

          return `
            <tr>
              <td>${formatDateTime(report.created_at)}</td>
              <td>${report.reporter_display_name || '-'}</td>
              <td>${report.report_type || '-'}</td>
              <td><code>${report.share_token || '-'}</code></td>
              <td>${report.video_id || '-'}</td>
              <td class="citation-cell" data-full="${escapeHtml(annotationText)}" onclick="showCitationPopover(event)">${escapeHtml(displayText)}</td>
              <td>${escapeHtml(report.reason || '-')}</td>
              <td class="citation-cell" style="max-width: 150px;" data-full="${escapeHtml(report.details || '')}" onclick="showCitationPopover(event)">${escapeHtml(report.details || '-')}</td>
              <td>
                ${report.status === 'pending' ? '<span class="badge badge-reported">Pending</span>' :
                  report.status === 'dismissed' ? '<span class="badge badge-deleted">Dismissed</span>' :
                  report.status === 'resolved' ? '<span class="badge badge-active">Resolved</span>' :
                  `<span class="badge">${report.status}</span>`}
              </td>
              <td>
                <div class="action-buttons" style="flex-wrap: wrap;">
                  ${isPending ? `
                    <button class="action-btn btn-secondary" onclick="dismissReport('${report.id}')">Dismiss</button>
                    <button class="action-btn btn-danger" onclick="deleteReportedCitation('${report.id}', '${report.share_token}', '${escapeHtml(report.title || report.video_id || '')}', '${report.annotation_id}')">Delete Citation</button>
                    ${report.target_user_id ? `
                      <button class="action-btn" onclick="openUserDetailsModal('${report.target_user_id}')" style="background: #0497a6; color: white;">View User</button>
                      <button class="action-btn btn-danger" onclick="openSuspendModal('${report.target_user_id}', 'User')">Suspend</button>
                      <button class="action-btn btn-danger" onclick="openBanModal('${report.target_user_id}', 'User')">Ban</button>
                    ` : ''}
                  ` : `
                    <span style="color: #999; font-size: 12px;">${report.status === 'dismissed' ? 'Dismissed' : 'Resolved'} ${report.reviewed_at ? formatDate(report.reviewed_at) : ''}</span>
                  `}
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

function filterReports() {
  const search = document.getElementById('reportSearch').value.toLowerCase();
  const filtered = reportsData.filter(report =>
    (report.reporter_display_name?.toLowerCase().includes(search)) ||
    (report.share_token?.toLowerCase().includes(search)) ||
    (report.video_id?.toLowerCase().includes(search)) ||
    (report.reason?.toLowerCase().includes(search)) ||
    (report.details?.toLowerCase().includes(search)) ||
    (report.annotation_text?.toLowerCase().includes(search))
  );
  renderReports(filtered);
}

async function dismissReport(reportId) {
  if (!confirm('Dismiss this report?')) return;

  try {
    const response = await fetch(`${API_URL}/api/admin/reports/${reportId}/dismiss`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to dismiss report');
    }

    await loadReports();
    await loadCitations();
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

async function resolveReport(reportId) {
  try {
    const response = await fetch(`${API_URL}/api/admin/reports/${reportId}/resolve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to resolve report');
    }
  } catch (error) {
    console.error('Failed to auto-resolve report:', error);
  }
}

function deleteReportedCitation(reportId, shareToken, title, annotationId) {
  // Store report ID so we can auto-resolve after deletion
  currentAction = { type: 'deleteCitation', token: shareToken, title, annotationId, reportId };

  document.getElementById('modalTitle').textContent = 'Delete Reported Annotation';
  document.getElementById('modalDescription').textContent = `Delete annotation from "${title}"?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="deleteReason">Reason</label>
      <input type="text" id="deleteReason" class="search-box" placeholder="e.g., Inappropriate content" style="width: 100%;">
    </div>
    <p style="color: #666; font-size: 14px; margin-top: 10px;">This will delete the annotation and auto-resolve the associated report.</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Delete';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.disabled = false;
  document.getElementById('actionModal').classList.add('active');
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

// Format annotation content for admin display — combines structured citation + free text note
function formatCitationContent(annotationText, annotationCitation) {
  const parts = [];

  if (annotationCitation && annotationCitation.type && annotationCitation.type !== 'note') {
    const c = annotationCitation;
    const icon = c.type === 'youtube' ? '🎥' : c.type === 'movie' ? '🎬' : '📄';
    let summary = icon;
    if (c.title) summary += ` ${c.title}`;
    if (c.director) summary += ` (dir. ${c.director})`;
    if (c.year) summary += ` (${c.year})`;
    if (c.author) summary += ` by ${c.author}`;
    if (c.url) summary += ` — ${c.url}`;
    parts.push(summary.trim());
  }

  if (annotationText) {
    parts.push(annotationText);
  }

  return parts.join(' | ') || '-';
}

// ============================================================================
// Citation Popover
// ============================================================================

function showCitationPopover(event) {
  const popover = document.getElementById('citationPopover');
  const body = document.getElementById('citationPopoverBody');
  const content = event.currentTarget.getAttribute('data-full');
  if (!content || content === '-') return;
  body.textContent = content;
  popover.classList.add('active');

  // Position near the clicked cell
  const rect = event.target.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left;

  // Keep within viewport
  if (top + 200 > window.innerHeight) {
    top = rect.top - 8;
    popover.style.top = 'auto';
    popover.style.bottom = (window.innerHeight - top) + 'px';
  } else {
    popover.style.top = top + 'px';
    popover.style.bottom = 'auto';
  }

  if (left + 450 > window.innerWidth) {
    left = window.innerWidth - 460;
  }
  popover.style.left = Math.max(10, left) + 'px';
}

function hideCitationPopover() {
  document.getElementById('citationPopover').classList.remove('active');
}

// Close popover on click outside
document.addEventListener('click', function(event) {
  if (!event.target.closest('.citation-popover') && !event.target.closest('.citation-cell')) {
    hideCitationPopover();
  }
  if (activeFilterDropdown && !event.target.closest('.filter-dropdown') && !event.target.closest('th')) {
    closeFilterDropdown();
  }
});

// Reposition filter dropdown when scrolling (keeps it aligned with column header)
document.addEventListener('scroll', function(event) {
  if (activeFilterDropdown) {
    repositionFilterDropdown();
  }
}, true); // Use capture phase to catch all scroll events including in scrollable containers

// ============================================================================
// User Details Modal
// ============================================================================

async function openUserDetailsModal(userId) {
  const modal = document.getElementById('userDetailsModal');
  const body = document.getElementById('userDetailsBody');

  currentUserDetailsId = userId; // Track which user is being viewed
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

// Refresh the User Details modal if it's currently open
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
  let accountType = 'Unknown';
  let accountTypeBadge = '';
  if (user.auth_type === 'anonymous' || user.auth_type === 'expired') {
    accountType = 'Temporary';
    accountTypeBadge = '<span class="badge" style="background: #9e9e9e; color: white;">Temporary</span>';
  } else if (user.auth_type === 'password' && user.email_verified) {
    accountType = 'Verified';
    accountTypeBadge = '<span class="badge" style="background: #4caf50; color: white;">Verified</span>';
  } else if (user.auth_type === 'password' && !user.email_verified) {
    accountType = 'Unverified';
    accountTypeBadge = '<span class="badge" style="background: #ffc107; color: black;">Unverified</span>';
  } else if (user.auth_type === 'youtube') {
    accountType = 'YouTube';
    accountTypeBadge = '<span class="badge" style="background: #ff4444; color: white;">YouTube</span>';
  } else if (user.auth_type === 'youtube_merged') {
    accountType = 'YouTube + Email';
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
                    <td><code>${c.video_id}</code></td>
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
  currentUserDetailsId = null; // Clear tracked user ID
}

function closeUserDetailsModalOnOverlay(event) {
  // Close if clicking the modal overlay (not the modal content)
  if (event.target.id === 'userDetailsModal') {
    closeUserDetailsModal();
  }
}

// Close modal on ESC key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('userDetailsModal');
    if (modal && modal.classList.contains('active')) {
      closeUserDetailsModal();
    }
  }
});
