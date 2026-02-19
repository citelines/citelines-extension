/**
 * YouTube Annotator - YouTube OAuth helpers
 * Handles Google OAuth flow for YouTube channel verification.
 */

/**
 * Launch the Google OAuth implicit flow and return an access token.
 * Uses chrome.identity.launchWebAuthFlow with the manifest's oauth2 config.
 * @returns {Promise<string>} Google OAuth access token
 */
async function launchYouTubeOAuth() {
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
        resolve(accessToken);
      }
    );
  });
}

/**
 * Full login/register flow via YouTube OAuth.
 * Handles the needsDisplayName case by showing a name picker in the UI.
 *
 * @param {AnnotatorAPI} api
 * @param {AuthManager} authManager
 * @param {string|null} displayName - Pre-supplied display name (or null to auto-detect)
 * @param {string|null} anonymousId - Anonymous ID to migrate (or null)
 * @param {Function|null} onStatus - Optional status callback (message: string) => void
 * @returns {Promise<void>}
 */
async function loginWithYouTube(api, authManager, displayName = null, anonymousId = null, onStatus = null) {
  if (onStatus) onStatus('Opening YouTube sign-in...');

  const accessToken = await launchYouTubeOAuth();

  if (onStatus) onStatus('Verifying channel...');

  const result = await authManager.loginWithYouTube(accessToken, displayName, anonymousId);

  if (result.needsDisplayName) {
    // Need to ask the user for a display name.
    // We try to find an active LoginUI instance to show the inline picker.
    const suggestedName = result.suggestedName || result.channelTitle || '';

    let chosenName = null;

    // Look for an active LoginUI with a promptDisplayName method
    if (typeof loginUI !== 'undefined' && loginUI && typeof loginUI.promptDisplayName === 'function') {
      if (onStatus) onStatus('Choose a display name to continue');
      chosenName = await loginUI.promptDisplayName(suggestedName);
    } else {
      // Fallback: use a simple prompt
      chosenName = prompt(`Choose a display name (suggested: ${suggestedName}):`, suggestedName);
      if (!chosenName || chosenName.trim().length < 2) {
        throw new Error('Display name is required');
      }
      chosenName = chosenName.trim();
    }

    // Retry with the chosen name
    if (onStatus) onStatus('Creating account...');
    await authManager.loginWithYouTube(accessToken, chosenName, anonymousId);
  }
}

/**
 * Connect a YouTube channel to an already-logged-in account.
 *
 * @param {AnnotatorAPI} api
 * @param {AuthManager} authManager
 * @param {Function|null} onStatus - Optional status callback (message: string) => void
 * @returns {Promise<{channelId, channelTitle}>}
 */
async function connectYouTubeChannel(api, authManager, onStatus = null) {
  if (onStatus) onStatus('Opening YouTube sign-in...');

  const accessToken = await launchYouTubeOAuth();

  if (onStatus) onStatus('Connecting channel...');

  const result = await api.connectYouTube(accessToken);

  // Update stored user with the new channel info
  await authManager.setYouTubeChannel(result.channelId, result.channelTitle);

  return result;
}
