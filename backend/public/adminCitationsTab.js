// Admin Dashboard - Citations Tab

function renderCitations(citations) {
  const container = document.getElementById('citationsTable');

  if (citations.length === 0) {
    container.innerHTML = '<div class="empty-state">No citations found</div>';
    selectedCitations.clear();
    return;
  }

  // Count statistics
  const activeCitations = citations.filter(c => !c.annotation_deleted_at && !c.share_deleted_at);

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
          const content = formatCitationContent(citation.annotation_text, citation.annotation_citation);
          const displayContent = content.length > 80 ? content.substring(0, 80) + '...' : content;
          const timestamp = citation.annotation_timestamp ? formatTimestamp(citation.annotation_timestamp) : '-';

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
        const statusValue = (citation.annotation_deleted_at || citation.share_deleted_at) ? 'Deleted' : 'Active';
        const citationStatuses = [statusValue];
        if (citation.has_pending_report) citationStatuses.push('Reported');
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
      filterSection = `
        <div class="filter-section">
          <div class="filter-section-title">Filter by Date</div>
          <div style="padding: 10px; color: #666; font-size: 13px;">Date range filtering coming soon...</div>
        </div>
      `;
    } else if (showFilter) {
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
    activeFilterTrigger = event.target.closest('th');

    // Wait for content to render, then position
    requestAnimationFrame(() => {
      const triggerElement = activeFilterTrigger;
      const rect = triggerElement.getBoundingClientRect();

      dropdown.style.visibility = 'hidden';
      dropdown.style.display = 'block';
      dropdown.style.maxHeight = 'none';
      const contentHeight = dropdown.scrollHeight;
      dropdown.style.visibility = '';

      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const spaceAbove = rect.top - 10;
      const idealMaxHeight = Math.min(400, contentHeight);

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
        return;
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

function filterCitations() {
  applyCitationFilter();
}

// Bulk Selection

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

  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const deleteSelectedCountSpan = document.getElementById('deleteSelectedCount');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.disabled = activeCount === 0;
  }
  if (deleteSelectedCountSpan) {
    deleteSelectedCountSpan.textContent = activeCount;
  }

  const bulkRestoreBtn = document.getElementById('bulkRestoreBtn');
  const restoreSelectedCountSpan = document.getElementById('restoreSelectedCount');
  if (bulkRestoreBtn) {
    bulkRestoreBtn.disabled = deletedCount === 0;
  }
  if (restoreSelectedCountSpan) {
    restoreSelectedCountSpan.textContent = deletedCount;
  }

  const selectAllCheckbox = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.citation-checkbox');
  if (selectAllCheckbox && checkboxes.length > 0) {
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
  }
}
