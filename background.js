/**
 * YouTube Annotator - Background Service Worker
 * Handles operations that require extension-level APIs unavailable in content scripts.
 */

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
          // Path 1: ytInitialData videoSecondaryInfoRenderer owner browseId
          const contents = window.ytInitialData?.contents
            ?.twoColumnWatchNextResults?.results?.results?.contents;
          if (contents) {
            for (const item of contents) {
              const id = item?.videoSecondaryInfoRenderer?.owner
                ?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
              if (id?.startsWith('UC')) return id;
            }
          }
          // Path 2: ytInitialPlayerConfig videoDetails
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
