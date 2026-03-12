// Pure helper functions with no dependencies on state or globals

// Get video ID from URL
export function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('v');
}

// Format seconds to MM:SS or HH:MM:SS
export function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date from citation fields (month, day, year)
export function formatDate(citation) {
  if (!citation.month && !citation.day && !citation.year) return '';

  const parts = [];
  if (citation.month) parts.push(citation.month);
  if (citation.day) parts.push(citation.day);
  if (citation.year) parts.push(citation.year);

  return parts.join(' ');
}

// Format creation timestamp for display (relative or absolute)
export function formatCreationTime(isoString) {
  if (!isoString) return '';

  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return '';
  }
}

// Format citation for display
export function formatCitation(citation, isOwn = true) {
  if (!citation || !citation.type) return '';

  const ownershipClass = isOwn ? '' : ' other';
  let html = `<div class="yt-annotator-citation${ownershipClass}">`;

  switch(citation.type) {
    case 'youtube':
      html += '<div class="yt-annotator-citation-icon">🎥</div>';
      html += '<div class="yt-annotator-citation-content">';
      if (citation.url) {
        html += `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="yt-annotator-citation-title">${escapeHtml(citation.title || 'YouTube Video')}</a>`;
      } else {
        html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || 'YouTube Video')}</span>`;
      }
      const youtubeDate = formatDate(citation);
      if (youtubeDate) {
        html += `<div class="yt-annotator-citation-meta">${escapeHtml(youtubeDate)}</div>`;
      }
      html += '</div>';
      break;

    case 'movie':
      html += '<div class="yt-annotator-citation-icon">🎬</div>';
      html += '<div class="yt-annotator-citation-content">';
      html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || 'Movie')}</span>`;
      const movieMeta = [];
      if (citation.year) movieMeta.push(citation.year);
      if (citation.director) movieMeta.push(`dir. ${citation.director}`);
      if (movieMeta.length > 0) {
        html += `<div class="yt-annotator-citation-meta">${escapeHtml(movieMeta.join(' • '))}</div>`;
      }
      html += '</div>';
      break;

    case 'article':
      html += '<div class="yt-annotator-citation-icon">📄</div>';
      html += '<div class="yt-annotator-citation-content">';
      if (citation.url) {
        html += `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer" class="yt-annotator-citation-title">${escapeHtml(citation.title || 'Article')}</a>`;
      } else {
        html += `<span class="yt-annotator-citation-title">${escapeHtml(citation.title || 'Article')}</span>`;
      }
      const articleMeta = [];
      if (citation.author) articleMeta.push(`by ${citation.author}`);
      const articleDate = formatDate(citation);
      if (articleDate) articleMeta.push(articleDate);
      if (articleMeta.length > 0) {
        html += `<div class="yt-annotator-citation-meta">${escapeHtml(articleMeta.join(' • '))}</div>`;
      }
      html += '</div>';
      break;
  }

  html += '</div>';
  return html;
}

// Escape HTML to prevent XSS
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get initials from a display name (max 2)
export function getInitials(displayName) {
  const words = displayName.trim().split(/\s+/);
  return words.slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
