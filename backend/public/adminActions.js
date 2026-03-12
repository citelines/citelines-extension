// Admin Dashboard - Admin Actions

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

  if (annotationId) {
    body.annotation_id = annotationId;
  }

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
    throw new Error(data.error || 'Failed to delete citation');
  }

  return await response.json();
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

// Bulk Actions

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
  const citationsByToken = {};
  citationsToDelete.forEach(citation => {
    if (!citationsByToken[citation.token]) {
      citationsByToken[citation.token] = [];
    }
    citationsByToken[citation.token].push(citation);
  });

  // Process each share's citations sequentially, different shares in parallel (batch size 3)
  const shareTokens = Object.keys(citationsByToken);
  const batchSize = 3;

  for (let i = 0; i < shareTokens.length; i += batchSize) {
    const tokenBatch = shareTokens.slice(i, i + batchSize);

    await Promise.allSettled(
      tokenBatch.map(async token => {
        const citations = citationsByToken[token];
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

    if (i + batchSize < shareTokens.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

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

async function bulkRestoreCitations(citationKeys, reason) {
  const totalCount = citationKeys.length;
  let successCount = 0;
  const failures = [];

  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = `Restoring... (0/${totalCount})`;

  const citationsToRestore = citationKeys.map(key => {
    const checkbox = document.querySelector(`[data-citation-key="${key}"]`);
    return {
      key,
      token: checkbox.dataset.shareToken,
      annotationId: checkbox.dataset.annotationId,
      title: checkbox.dataset.title
    };
  });

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
