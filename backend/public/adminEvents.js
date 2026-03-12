// Admin Dashboard - Global Event Listeners

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

// Reposition filter dropdown when scrolling
document.addEventListener('scroll', function() {
  if (activeFilterDropdown) {
    repositionFilterDropdown();
  }
}, true);

// Close modal on ESC key
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    const modal = document.getElementById('userDetailsModal');
    if (modal && modal.classList.contains('active')) {
      closeUserDetailsModal();
    }
  }
});
