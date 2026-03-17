/**
 * Lightweight analytics tracker for the Citelines extension.
 * PRIVACY: Only stores anonymous session IDs (X-Anonymous-ID).
 * No emails, user IDs, or other PII are ever sent.
 */
class AnalyticsTracker {
  constructor() {
    this.queue = [];
    this.flushInterval = 10000; // 10 seconds
    this.maxBatchSize = 20;
    this.baseUrl = 'https://citelines-extension-production.up.railway.app/api';
    this._startFlushing();
    this._checkPendingInstall();
  }

  track(eventType, metadata = {}) {
    this.queue.push({
      event_type: eventType,
      video_id: metadata.videoId || null,
      metadata
    });

    if (this.queue.length >= this.maxBatchSize) {
      this._flush();
    }
  }

  async _flush() {
    if (this.queue.length === 0) return;

    const events = this.queue.splice(0, this.maxBatchSize);

    try {
      const headers = { 'Content-Type': 'application/json' };
      // Use anonymous ID if available (from api.js singleton)
      if (typeof api !== 'undefined' && api.anonymousId) {
        headers['X-Anonymous-ID'] = api.anonymousId;
      }

      // Fire and forget — never block UI
      fetch(`${this.baseUrl}/analytics/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events })
      }).catch(() => {});
    } catch (e) {
      // Silently discard errors
    }
  }

  _startFlushing() {
    setInterval(() => this._flush(), this.flushInterval);

    // Flush when user navigates away
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this._flush();
        }
      });
    }
  }

  _checkPendingInstall() {
    try {
      chrome.storage.local.get(['_pendingInstallEvent'], (result) => {
        if (result._pendingInstallEvent) {
          this.track('extension_installed', {
            extension_version: chrome.runtime.getManifest().version
          });
          chrome.storage.local.remove(['_pendingInstallEvent']);
        }
      });
    } catch (e) {
      // chrome.storage may not be available in all contexts
    }
  }
}

const analytics = new AnalyticsTracker();
window.analytics = analytics;
