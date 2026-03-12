// Admin Dashboard - Utility Functions

function getAuthTypeLabel(user) {
  if (user.auth_type === 'youtube') return 'YouTube';
  if (user.auth_type === 'youtube_merged') return 'YouTube + Email';
  if (user.auth_type === 'password' && user.email_verified) return 'Password - Verified';
  if (user.auth_type === 'password' && !user.email_verified) return 'Password - Unverified';
  return 'Anonymous';
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatActionType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTimestamp(seconds) {
  if (!seconds && seconds !== 0) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Format annotation content for admin display — combines structured citation + free text note
function formatCitationContent(annotationText, annotationCitation) {
  const parts = [];

  if (annotationCitation && annotationCitation.type && annotationCitation.type !== 'note') {
    const c = annotationCitation;
    const icon = c.type === 'youtube' ? '🎥' : c.type === 'movie' ? '🎬' : '📄';
    let summary = icon;
    if (c.title) summary += ` ${c.title}`;
    if (c.director) summary += ` (dir. ${c.director})`;
    if (c.year) summary += ` (${c.year})`;
    if (c.author) summary += ` by ${c.author}`;
    if (c.url) summary += ` — ${c.url}`;
    parts.push(summary.trim());
  }

  if (annotationText) {
    parts.push(annotationText);
  }

  return parts.join(' | ') || '-';
}
