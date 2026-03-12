// Fetch all annotations from backend — separate module to avoid circular deps

import * as state from './state.js';
import { api } from './globals.js';
import { getAnnotationsStorageKey } from './storage.js';
import { getVideoChannelId, updateCreatorMode } from './creatorMode.js';
import { renderMarkers } from './markers.js';

// Fetch all annotations from all users for current video.
export async function fetchAllAnnotations(videoId) {
  try {
    const channelIdPromise = state.currentVideoChannelId
      ? Promise.resolve(state.currentVideoChannelId)
      : getVideoChannelId();
    const [result, videoChannelId] = await Promise.all([
      api.getSharesForVideo(videoId),
      channelIdPromise
    ]);

    state.setCurrentVideoChannelId(videoChannelId);

    const newSharedAnnotations = [];
    let foundUserShareId = null;

    for (const share of result.shares) {
      if (!share.annotations || !Array.isArray(share.annotations)) continue;

      const isOwn = share.isOwner || false;

      if (isOwn && !foundUserShareId) {
        foundUserShareId = share.shareToken;
        const nonDeletedAnnotations = share.annotations.filter(ann => !ann.deleted_at);
        state.annotations[videoId] = nonDeletedAnnotations;
        const storageKey = getAnnotationsStorageKey(videoId);
        chrome.storage.local.set({ [storageKey]: nonDeletedAnnotations });
      }

      const isCreatorCitation = !!(
        videoChannelId &&
        share.creatorYoutubeChannelId &&
        share.creatorYoutubeChannelId === videoChannelId
      );

      const suggestionCounts = share.suggestionCounts || {};

      const mapped = share.annotations
        .filter(ann => {
          if (!ann.deleted_at) return true;
          return isOwn && !!ann.deleted_by;
        })
        .map(ann => {
          const sc = suggestionCounts[ann.id];
          const adminDeleted = !!(ann.deleted_at && ann.deleted_by);
          return {
            ...ann,
            shareToken: share.shareToken,
            isOwn,
            creatorDisplayName: share.creatorDisplayName,
            creatorUserId: share.userId,
            isCreatorCitation,
            adminDeleted,
            suggestionCount: sc ? sc.count : 0,
            userHasSuggestion: sc ? sc.userHasSuggestion : false
          };
        });

      newSharedAnnotations.push(...mapped);
    }

    state.setUserShareId(foundUserShareId);
    state.setSharedAnnotations(newSharedAnnotations);

    if (!foundUserShareId) {
      state.annotations[videoId] = [];
      const storageKey = getAnnotationsStorageKey(videoId);
      chrome.storage.local.set({ [storageKey]: [] });
    }

    renderMarkers();
    updateCreatorMode();
  } catch (error) {
    console.error('Failed to fetch annotations:', error);
  }
}
