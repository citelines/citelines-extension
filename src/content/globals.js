// Thin wrapper exposing global objects injected by other content scripts
// (api.js, auth.js, youtubeAuth.js, loginUI.js, userProfileUI.js, analytics.js, shareUI.js)

export const api = window.api;
export const authManager = window.authManager;
export const LoginUI = window.LoginUI;
export const UserProfileUI = window.UserProfileUI;
export const analytics = window.analytics;
export const connectYouTubeChannel = window.connectYouTubeChannel;
export const createShareButton = window.createShareButton;
export const createBrowseButton = window.createBrowseButton;
export const showShareModal = window.showShareModal;
export const showBrowseModal = window.showBrowseModal;
export const showImportModal = window.showImportModal;
