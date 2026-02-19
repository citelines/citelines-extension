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
});

/**
 * Run the Google OAuth implicit flow and return an access token.
 * chrome.identity is only available in background service workers.
 */
async function handleYouTubeOAuth() {
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', '604396819800-opo6j4nss7jnfbp4sn83dsropql05o9b.apps.googleusercontent.com');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly');

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          return reject(new Error(chrome.runtime.lastError?.message || 'OAuth cancelled'));
        }
        const params = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
        const accessToken = params.get('access_token');
        if (!accessToken) return reject(new Error('No access token returned'));
        resolve({ accessToken });
      }
    );
  });
}
