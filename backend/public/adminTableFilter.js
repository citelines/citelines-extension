// Admin Dashboard - Shared Table Filter Functions

function closeFilterDropdown() {
  if (activeFilterDropdown) {
    activeFilterDropdown.classList.remove('active');

    if (activeFilterDropdown.parentElement === document.body) {
      activeFilterDropdown.remove();
    }

    activeFilterDropdown = null;
    activeFilterTrigger = null;

    // Apply filters after closing dropdown
    const usersTabActive = document.getElementById('usersTab').classList.contains('active');
    const citationsTabActive = document.getElementById('citationsTab').classList.contains('active');

    if (usersTabActive) {
      applyUserFilter();
    } else if (citationsTabActive) {
      applyCitationFilter();
    }
  }
}

// Reposition filter dropdown to stay aligned with trigger element
function repositionFilterDropdown() {
  if (!activeFilterDropdown || !activeFilterTrigger) return;

  const dropdown = activeFilterDropdown;
  const rect = activeFilterTrigger.getBoundingClientRect();

  const spaceBelow = window.innerHeight - rect.bottom - 10;
  const spaceAbove = rect.top - 10;
  const currentMaxHeight = parseInt(dropdown.style.maxHeight) || 400;

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
