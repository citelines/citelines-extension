// Admin Dashboard JavaScript
// YouTube Annotator

console.log('[DEBUG] ===== admin.js loaded at', new Date().toISOString(), '=====');

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
let activeFilterTrigger = null; // Track the th element that opened the dropdown

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
  }
}

// Restore last active tab on page load
function restoreActiveTab() {
  const savedTab = localStorage.getItem('admin_active_tab');
  if (savedTab && ['users', 'citations', 'analytics', 'audit'].includes(savedTab)) {
    // Remove default active states
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Find and activate the saved tab
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.textContent.toLowerCase() === savedTab ||
          (savedTab === 'audit' && tab.textContent === 'Audit Log')) {
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
  const activeUsers = users.filter(u => !u.is_blocked && !u.is_suspended);
  const suspendedUsers = users.filter(u => u.is_suspended && !u.is_blocked);
  const blockedUsers = users.filter(u => u.is_blocked);

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
          ${columnHeader('total_annotations', 'Annotations', { showSort: true, showFilter: false })}
          ${columnHeader('created_at', 'Joined', { showSort: true, showFilter: true })}
          <th style="width: 200px;">Actions</th>
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
            <td style="width: 120px;">${user.auth_type}</td>
            <td style="width: 120px;">
              ${user.is_blocked ? '<span class="badge badge-blocked">Blocked</span>' :
                user.is_suspended ? '<span class="badge badge-suspended">Suspended</span>' :
                '<span class="badge badge-active">Active</span>'}
            </td>
            <td style="width: 120px;">${user.active_annotations || 0} / ${user.total_annotations || 0}</td>
            <td style="width: 120px;">${formatDate(user.created_at)}</td>
            <td style="width: 200px;">
              <div class="action-buttons">
                <button class="action-btn" onclick="openUserDetailsModal('${user.id}')" style="background: #0497a6; color: white;">View</button>
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
        Delete Selected (<span id="selectedCount">0</span>)
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
              <td><code>${citation.annotation_id}</code></td>
              <td>${citation.video_id}</td>
              <td>${citation.title || '-'}</td>
              <td>${citation.user_id ?
                `<a href="javascript:void(0)" onclick="openUserDetailsModal('${citation.user_id}')" style="color: #0497a6; text-decoration: none; cursor: pointer;">${citation.creator_display_name}</a>` :
                (citation.creator_display_name || '-')}</td>
              <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(content)}">${escapeHtml(displayContent)}</td>
              <td>${timestamp}</td>
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
        <div class="stat-card neutral">
          <div class="stat-label">Temporary</div>
          <div class="stat-value">${data.users.temporary}</div>
          <div class="stat-subtitle">Anonymous accounts</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Verified</div>
          <div class="stat-value">${data.users.verified}</div>
          <div class="stat-subtitle">Email verified</div>
        </div>
        <div class="stat-card caution">
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
  }

  // Status badges
  const statusBadges = [];
  if (user.is_admin) statusBadges.push('<span class="badge badge-admin">Admin</span>');
  if (user.is_blocked) statusBadges.push('<span class="badge badge-blocked">Blocked</span>');
  else if (user.is_suspended) statusBadges.push('<span class="badge badge-suspended">Suspended</span>');
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
          ${user.is_blocked ? `
            <strong>Blocked At:</strong> <span>${formatDateTime(user.blocked_at)}</span>
            <strong>Block Reason:</strong> <span>${user.blocked_reason || '-'}</span>
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
                </tr>
              </thead>
              <tbody>
                ${citations.map(c => `
                  <tr>
                    <td><code>${c.video_id}</code></td>
                    <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(c.text)}">${escapeHtml(c.text.substring(0, 50))}${c.text.length > 50 ? '...' : ''}</td>
                    <td>${c.timestamp ? formatTimestamp(c.timestamp) : '-'}</td>
                    <td>${c.deleted_at ? '<span class="badge badge-deleted">Deleted</span>' : '<span class="badge badge-active">Active</span>'}</td>
                  </tr>
                `).join('')}
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
