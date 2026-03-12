// Admin Dashboard - Modal Dialogs

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
  confirmBtn.disabled = false;
  document.getElementById('actionModal').classList.add('active');
}

function openBanModal(userId, displayName) {
  currentAction = { type: 'ban', userId, displayName };

  document.getElementById('modalTitle').textContent = 'Suspend Permanently';
  document.getElementById('modalDescription').textContent = `Permanently suspend ${displayName}? This will also soft-delete all their citations and ban associated IPs.`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="banReason">Reason</label>
      <input type="text" id="banReason" class="search-box" placeholder="e.g., Harassment" style="width: 100%;">
    </div>
    <p style="color: #dc3545; font-size: 14px; margin-top: 10px;">⚠️ This will permanently suspend the user, soft-delete their citations, and ban their recent IPs.</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Suspend Permanently';
  confirmBtn.className = 'btn btn-danger';
  confirmBtn.disabled = false;
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
  confirmBtn.disabled = false;
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
  confirmBtn.disabled = false;
  document.getElementById('actionModal').classList.add('active');
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

function openBulkRestoreModal() {
  if (selectedCitations.size === 0) return;

  // Filter to only deleted citations
  const deletedKeys = Array.from(selectedCitations).filter(key => {
    const checkbox = document.querySelector(`.citation-checkbox[data-citation-key="${key}"]`);
    return checkbox && checkbox.dataset.deleted === 'true';
  });

  if (deletedKeys.length === 0) {
    alert('No deleted citations selected.');
    return;
  }

  currentAction = { type: 'bulkRestore', citationKeys: deletedKeys };

  document.getElementById('modalTitle').textContent = 'Restore Multiple Annotations';
  document.getElementById('modalDescription').textContent = `Restore ${deletedKeys.length} annotation(s)?`;
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label for="bulkRestoreReason">Reason</label>
      <input type="text" id="bulkRestoreReason" class="search-box" placeholder="e.g., False positive" style="width: 100%;">
    </div>
    <p style="color: #666; font-size: 14px; margin-top: 10px;">This will restore ${deletedKeys.length} annotation(s).</p>
  `;
  const confirmBtn = document.getElementById('modalConfirmBtn');
  confirmBtn.textContent = 'Restore All';
  confirmBtn.className = 'btn btn-success';
  confirmBtn.disabled = false;
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
      case 'ban':
        await banUser(
          currentAction.userId,
          document.getElementById('banReason').value
        );
        break;
      case 'deleteCitation':
        await deleteCitation(
          currentAction.token,
          document.getElementById('deleteReason').value,
          currentAction.annotationId,
          currentAction.reportId
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
      case 'bulkRestore':
        await bulkRestoreCitations(
          currentAction.citationKeys,
          document.getElementById('bulkRestoreReason').value
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
