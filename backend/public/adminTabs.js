// Admin Dashboard - Tab Management

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
