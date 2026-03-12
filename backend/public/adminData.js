// Admin Dashboard - Data Loading

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
