// Admin Dashboard - Analytics Tab

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
        active: citationsData.filter(c => !c.is_bookmark && !c.annotation_deleted_at && !c.share_deleted_at).length,
        deleted: citationsData.filter(c => !c.is_bookmark && (c.annotation_deleted_at || c.share_deleted_at)).length,
        total: citationsData.filter(c => !c.is_bookmark).length
      },
      bookmarks: {
        active: citationsData.filter(c => c.is_bookmark && !c.annotation_deleted_at && !c.share_deleted_at).length,
        deleted: citationsData.filter(c => c.is_bookmark && (c.annotation_deleted_at || c.share_deleted_at)).length,
        total: citationsData.filter(c => c.is_bookmark).length
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

    <!-- Bookmark Status Section -->
    <div class="analytics-section">
      <h2>Bookmark Status</h2>
      <div class="analytics-grid">
        <div class="stat-card">
          <div class="stat-label">Total Lifetime Bookmarks</div>
          <div class="stat-value">${data.bookmarks.total}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Active</div>
          <div class="stat-value">${data.bookmarks.active}</div>
          <div class="stat-subtitle">Visible to owner</div>
        </div>
        <div class="stat-card neutral">
          <div class="stat-label">Deleted</div>
          <div class="stat-value">${data.bookmarks.deleted}</div>
          <div class="stat-subtitle">Soft deleted</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}
