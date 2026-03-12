// Admin Dashboard - Users Tab

function renderUsers(users) {
  const container = document.getElementById('usersTable');

  if (users.length === 0) {
    container.innerHTML = '<div class="empty-state">No users found</div>';
    return;
  }

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

      if (!values.includes(columnValue)) {
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
  // Clean up any lingering dropdowns before re-render
  if (activeFilterDropdown) {
    activeFilterDropdown.remove();
    activeFilterDropdown = null;
  }

  const filtered = getSortedFilteredUsers();
  renderUsers(filtered);
}

function toggleUserColumnFilter(event, column) {
  event.stopPropagation();

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

    // Build dropdown content
    let filterSection = '';
    if (showFilter && column === 'created_at') {
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

    dropdown.classList.add('active');
    activeFilterDropdown = dropdown;
    activeFilterTrigger = event.target.closest('th');

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
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.bottom = 'auto';
        dropdown.style.maxHeight = `${idealMaxHeight}px`;
      } else if (spaceAbove >= idealMaxHeight) {
        dropdown.style.bottom = `${window.innerHeight - rect.top}px`;
        dropdown.style.top = 'auto';
        dropdown.style.maxHeight = `${idealMaxHeight}px`;
      } else {
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

  // Don't apply filter immediately - wait for user to click Done
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

function filterUsers() {
  applyUserFilter();
}
