// Thin wrapper exposing global objects injected by other content scripts
// (api.js, auth.js, youtubeAuth.js, loginUI.js, analytics.js)

export const api = window.api;
export const authManager = window.authManager;
export const LoginUI = window.LoginUI;
export const analytics = window.analytics;
