/**
 * Validation utilities for input data
 */

const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity');

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const MAX_ANNOTATIONS = 100;
const MAX_ANNOTATION_TEXT_LENGTH = 500;
const MAX_TITLE_LENGTH = 255;

/**
 * Validate YouTube video ID format
 * @param {string} videoId
 * @returns {boolean}
 */
function isValidVideoId(videoId) {
  return typeof videoId === 'string' && VIDEO_ID_REGEX.test(videoId);
}

/**
 * Validate annotations array
 * @param {Array} annotations
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateAnnotations(annotations) {
  if (!Array.isArray(annotations)) {
    return { valid: false, error: 'Annotations must be an array' };
  }

  if (annotations.length === 0) {
    return { valid: false, error: 'Annotations array cannot be empty' };
  }

  if (annotations.length > MAX_ANNOTATIONS) {
    return { valid: false, error: `Maximum ${MAX_ANNOTATIONS} annotations allowed` };
  }

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];

    if (!annotation || typeof annotation !== 'object') {
      return { valid: false, error: `Annotation at index ${i} must be an object` };
    }

    if (typeof annotation.timestamp !== 'number' || annotation.timestamp < 0) {
      return { valid: false, error: `Invalid timestamp at index ${i}` };
    }

    if (typeof annotation.text !== 'string') {
      return { valid: false, error: `Annotation text at index ${i} must be a string` };
    }

    if (annotation.text.length > MAX_ANNOTATION_TEXT_LENGTH) {
      return { valid: false, error: `Annotation text at index ${i} exceeds ${MAX_ANNOTATION_TEXT_LENGTH} characters` };
    }
  }

  return { valid: true };
}

/**
 * Validate share title
 * @param {string} title
 * @returns {boolean}
 */
function isValidTitle(title) {
  if (title === undefined || title === null) {
    return true; // Title is optional
  }

  return typeof title === 'string' && title.length <= MAX_TITLE_LENGTH;
}

/**
 * Validate share token format
 * @param {string} token
 * @returns {boolean}
 */
function isValidShareToken(token) {
  return typeof token === 'string' && /^[a-z0-9]{8}$/.test(token);
}

/**
 * Sanitize text input (basic XSS prevention)
 * @param {string} text
 * @returns {string}
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

/**
 * Validate display name for profanity
 * @param {string} name
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateDisplayName(name) {
  if (matcher.hasMatch(name)) {
    return { valid: false, error: 'Display name contains inappropriate language. Please choose a different name.' };
  }
  return { valid: true };
}

module.exports = {
  isValidVideoId,
  validateAnnotations,
  isValidTitle,
  isValidShareToken,
  sanitizeText,
  validateDisplayName,
  MAX_ANNOTATIONS,
  MAX_ANNOTATION_TEXT_LENGTH,
  MAX_TITLE_LENGTH
};
