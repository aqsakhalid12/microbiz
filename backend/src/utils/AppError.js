// backend/src/utils/AppError.js
// Custom error class for "expected" errors (bad input, not found, conflicts).
// Controllers throw AppError instances; the centralized error handler
// turns them into clean JSON responses with the right status code.
class AppError extends Error {
  /**
   * @param {string} message Human-readable message (safe to send to clients)
   * @param {number} statusCode HTTP status code (e.g. 400, 404, 409)
   * @param {*} [details] Optional extra context (e.g. validation errors)
   */
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    // Marks this as an operational (expected) error, not a programming bug.
    this.isOperational = true;
    // Keep the stack trace starting at where AppError was constructed.
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
