/**
 * YouTube Annotator - YouTube OAuth helpers
 * Handles Google OAuth flow for YouTube channel verification.
 */

/**
 * Launch the Google OAuth implicit flow and return an access token.
 * Delegates to the background service worker since chrome.identity is
 * not available in content scripts.
 * @returns {Promise<string>} Google OAuth access token
 */
async function launchYouTubeOAuth() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'YOUTUBE_OAUTH' }, (response) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (!response || response.error) {
        return reject(new Error(response?.error || 'OAuth failed'));
      }
      resolve(response.accessToken);
    });
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
 * If the server detects a separate YouTube account that should be merged,
 * returns { needsMerge: true, ... } so the caller can prompt the user.
 *
 * @param {AnnotatorAPI} api
 * @param {AuthManager} authManager
 * @param {Function|null} onStatus - Optional status callback (message: string) => void
 * @returns {Promise<Object>} Channel info or merge prompt data
 */
async function connectYouTubeChannel(api, authManager, onStatus = null) {
  if (onStatus) onStatus('Opening YouTube sign-in...');

  const accessToken = await launchYouTubeOAuth();

  if (onStatus) onStatus('Connecting channel...');

  const result = await api.connectYouTube(accessToken);

  // If a merge is needed, attach the accessToken so the caller can complete it
  if (result.needsMerge) {
    result._accessToken = accessToken;
    return result;
  }

  // Update stored user with the new channel info
  await authManager.setYouTubeChannel(result.channelId, result.channelTitle);

  return result;
}
window.connectYouTubeChannel = connectYouTubeChannel;
