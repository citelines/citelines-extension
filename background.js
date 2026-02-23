/**
 * YouTube Annotator - Background Service Worker
 * Handles operations that require extension-level APIs unavailable in content scripts.
 */

// Track fresh extension installs (flag is picked up by analytics.js in content script)
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ _pendingInstallEvent: true });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'YOUTUBE_OAUTH') {
    handleYouTubeOAuth().then(sendResponse).catch(err => {
      sendResponse({ error: err.message || 'OAuth failed' });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_CHANNEL_ID') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      func: () => {
        try {
          // Primary: movie_player.getVideoData() — updates on SPA navigation
          const player = document.getElementById('movie_player');
          if (player && typeof player.getVideoData === 'function') {
            const data = player.getVideoData();
            if (data?.channel_id?.startsWith('UC')) return data.channel_id;
          }

          // Fallback 1: movie_player.getPlayerResponse()
          if (player && typeof player.getPlayerResponse === 'function') {
            const resp = player.getPlayerResponse();
            const cid = resp?.videoDetails?.channelId;
            if (cid?.startsWith('UC')) return cid;
          }

          // Fallback 2: ytInitialData (works on fresh page load only)
          const contents = window.ytInitialData?.contents
            ?.twoColumnWatchNextResults?.results?.results?.contents;
          if (contents) {
            for (const item of contents) {
              const id = item?.videoSecondaryInfoRenderer?.owner
                ?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
              if (id?.startsWith('UC')) return id;
            }
          }

          // Fallback 3: ytInitialPlayerConfig
          const ucid = window.ytInitialPlayerConfig?.videoDetails?.channelId
            || window.ytInitialPlayerConfig?.args?.ucid;
          if (ucid?.startsWith('UC')) return ucid;
        } catch (e) {}
        return null;
      }
    }).then(results => {
      sendResponse({ channelId: results?.[0]?.result || null });
    }).catch(err => {
      sendResponse({ channelId: null });
    });
    return true; // Keep message channel open for async response
  }
});

/**
 * Get a Google OAuth access token using chrome.identity.getAuthToken.
 * Uses the client_id and scopes declared in manifest.json's oauth2 section.
 * chrome.identity is only available in background service workers.
 */
async function handleYouTubeOAuth() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!token) {
        return reject(new Error('No token received'));
      }
      resolve({ accessToken: token });
    });
  });
}
