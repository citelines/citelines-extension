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
    let foundBookmarkShareId = null;

    for (const share of result.shares) {
      if (!share.annotations || !Array.isArray(share.annotations)) continue;

      const isOwn = share.isOwner || false;
      const isBookmarkShare = isOwn && share.isPublic === false;

      if (isBookmarkShare && !foundBookmarkShareId) {
        foundBookmarkShareId = share.shareToken;
        const nonDeletedBookmarks = share.annotations.filter(ann => !ann.deleted_at);
        state.setBookmarkAnnotations(nonDeletedBookmarks);
      } else if (isOwn && !foundUserShareId) {
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
        .filter(ann => !ann.deleted_at)
        .map(ann => {
          const sc = suggestionCounts[ann.id];
          return {
            ...ann,
            shareToken: share.shareToken,
            isOwn,
            isBookmark: isBookmarkShare,
            creatorDisplayName: share.creatorDisplayName,
            creatorUserId: share.userId,
            isCreatorCitation,
            suggestionCount: sc ? sc.count : 0,
            userHasSuggestion: sc ? sc.userHasSuggestion : false
          };
        });

      newSharedAnnotations.push(...mapped);
    }

    state.setUserShareId(foundUserShareId);
    state.setBookmarkShareId(foundBookmarkShareId);
    state.setSharedAnnotations(newSharedAnnotations);

    if (!foundUserShareId) {
      state.annotations[videoId] = [];
      const storageKey = getAnnotationsStorageKey(videoId);
      chrome.storage.local.set({ [storageKey]: [] });
    }

    if (!foundBookmarkShareId) {
      state.setBookmarkAnnotations([]);
    }

    renderMarkers();
    updateCreatorMode();
  } catch (error) {
    console.error('Failed to fetch annotations:', error);
  }
}
