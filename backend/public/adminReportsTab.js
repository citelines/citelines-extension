// Admin Dashboard - Reports Tab

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
