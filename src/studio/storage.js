// Backend sync for Studio — no local chrome.storage cache

import * as state from './state.js';
import { api } from './globals.js';

// Fetch own citations for a video from the backend
export async function fetchOwnCitations(videoId) {
  const result = await api.getSharesForVideo(videoId);
  const shares = result.shares || [];

  // Find the user's own share
  const ownShare = shares.find(s => s.isOwner);

  if (ownShare) {
    state.setUserShareToken(ownShare.shareToken);
    state.setAnnotations(ownShare.annotations || []);
  } else {
    state.setUserShareToken(null);
    state.setAnnotations([]);
  }

  return state.annotations;
}

// Save a new annotation to the backend
export async function saveAnnotation(videoId, annotation) {
  const updatedAnnotations = [...state.annotations, annotation];

  if (state.userShareToken) {
    await api.updateShare(state.userShareToken, {
      annotations: updatedAnnotations,
      title: getVideoTitle()
    });
  } else {
    const result = await api.createShare(videoId, updatedAnnotations, getVideoTitle());
    state.setUserShareToken(result.shareToken);
  }

  state.setAnnotations(updatedAnnotations);
  return updatedAnnotations;
}

// Update an existing annotation
export async function updateAnnotation(annotationId, changes) {
  const updatedAnnotations = state.annotations.map(ann => {
    if (ann.id === annotationId) {
      const updated = { ...ann };
      if (changes.text !== undefined) updated.text = changes.text;
      if (changes.citation !== undefined) {
        updated.citation = { ...(updated.citation || {}), ...changes.citation };
      }
      if (changes.timestamp !== undefined) updated.timestamp = changes.timestamp;
      return updated;
    }
    return ann;
  });

  await api.updateShare(state.userShareToken, {
    annotations: updatedAnnotations,
    title: getVideoTitle()
  });

  state.setAnnotations(updatedAnnotations);
  return updatedAnnotations;
}

// Delete an annotation
export async function deleteAnnotation(annotationId) {
  const updatedAnnotations = state.annotations.filter(ann => ann.id !== annotationId);

  if (updatedAnnotations.length === 0 && state.userShareToken) {
    await api.deleteShare(state.userShareToken);
    state.setUserShareToken(null);
  } else if (state.userShareToken) {
    await api.updateShare(state.userShareToken, {
      annotations: updatedAnnotations,
      title: getVideoTitle()
    });
  }

  state.setAnnotations(updatedAnnotations);
  return updatedAnnotations;
}

function getVideoTitle() {
  // Studio edit page has the title in an input field
  const titleInput = document.querySelector('#title-wrapper input, #textbox[aria-label="Add a title"]');
  return titleInput?.value || 'YouTube Video';
}
