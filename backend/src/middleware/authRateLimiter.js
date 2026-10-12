// backend/src/middleware/authRateLimiter.js
// Brute-force protection for the login/register endpoints.
const rateLimit = require("express-rate-limit");
const { NODE_ENV } = require("../config/env");

// In development allow many more attempts so testing and
// Postman work smoothly; production stays strict.
const MAX_REQUESTS = NODE_ENV === "development" ? 100 : 10;
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

const authRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  // Return rate-limit info in the RateLimit-* headers.
  standardHeaders: true,
  legacyHeaders: false,
  // JSON error, same shape as every other API error.
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many attempts, please try again later.",
    });
  },
});

module.exports = authRateLimiter;
