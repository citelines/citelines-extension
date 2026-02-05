/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Default error status
  const statusCode = err.statusCode || 500;

  // Log full error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Full error details:', err);
  }

  // Send error response
  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    message: err.userMessage || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

/**
 * Async error wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
