// Theme management: auto-detect YouTube light/dark mode or manual override

const STORAGE_KEY = 'citelines_theme_pref'; // 'auto' | 'light' | 'dark'

let currentPref = 'auto';
let ytObserver = null;

// Get the effective theme based on preference and YouTube's theme
function getEffectiveTheme() {
  if (currentPref === 'light' || currentPref === 'dark') return currentPref;
  // Auto: detect YouTube's theme via html.dark class
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// Apply the theme class to all Citelines elements
function applyTheme() {
  const theme = getEffectiveTheme();
  const timeline = document.querySelector('.citelines-timeline');
  if (timeline) {
    timeline.classList.toggle('citelines-light', theme === 'light');
  }
  // Also apply to any open popups
  document.querySelectorAll('.yt-annotator-popup, .yt-annotator-popup-create').forEach(el => {
    el.classList.toggle('citelines-light', theme === 'light');
  });
  // Account sidebar
  const sidebar = document.querySelector('.yt-annotator-account-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('citelines-light', theme === 'light');
  }
  // Annotations sidebar
  const annSidebar = document.querySelector('.yt-annotator-sidebar');
  if (annSidebar) {
    annSidebar.classList.toggle('citelines-light', theme === 'light');
  }
}

// Watch for YouTube theme changes (only matters in auto mode)
function startYouTubeThemeObserver() {
  if (ytObserver) return;
  ytObserver = new MutationObserver(() => {
    if (currentPref === 'auto') applyTheme();
  });
  ytObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
}

// Initialize theme system
export async function initTheme() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  currentPref = result[STORAGE_KEY] || 'auto';
  applyTheme();
  startYouTubeThemeObserver();
}

// Get current preference
export function getThemePref() {
  return currentPref;
}

// Set theme preference
export async function setThemePref(pref) {
  currentPref = pref;
  await chrome.storage.local.set({ [STORAGE_KEY]: pref });
  applyTheme();
}

// Re-apply theme (call after creating new UI elements)
export { applyTheme };
