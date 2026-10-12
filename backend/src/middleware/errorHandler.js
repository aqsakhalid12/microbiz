// backend/src/middleware/errorHandler.js
// Centralized error handler: every error thrown or passed via next(err)
// in the app ends up here, so all API errors return the same JSON shape.
// Response shape: { success: false, message, details? }

// Map common PostgreSQL error codes to client-friendly HTTP responses.
const PG_ERROR_MAP = {
  "23505": { statusCode: 409, message: "Duplicate record" }, // unique_violation
  "23503": { statusCode: 400, message: "Invalid reference" }, // foreign_key_violation
  "23514": { statusCode: 400, message: "Constraint violation" }, // check_violation
  "22P02": { statusCode: 400, message: "Invalid input" }, // invalid_text_representation
};

// Express error handlers take exactly 4 arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Always log the full error on the server (stack trace included) for debugging.
  console.error(err);

  const isProd = process.env.NODE_ENV === "production";

  // Known errors (AppError) keep their status code and safe message.
  // Anything else is a bug and becomes a generic 500.
  const isAppError = err instanceof Error && err.isOperational === true;
  const pgMapping = PG_ERROR_MAP[err.code]; // set by the pg driver on DB errors

  let statusCode = 500;
  let message = "Internal server error";
  let details;

  if (pgMapping) {
    statusCode = pgMapping.statusCode;
    message = pgMapping.message;
  } else if (isAppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (!isProd) {
    // In development only, attach the stack trace to help debugging.
    details = err.stack;
  }
  // In production: stack traces and raw DB messages are never sent to clients.

  const body = { success: false, message };
  if (details !== undefined) body.details = details;
  res.status(statusCode).json(body);
}

module.exports = errorHandler;
