// backend/src/routes/auth.routes.js
// Routes for authentication, mounted at /api/auth.
const express = require("express");

const authController = require("../controllers/auth.controller");
const requireAuth = require("../middleware/requireAuth");
const authRateLimiter = require("../middleware/authRateLimiter");

const router = express.Router();

// Login and registration are brute-force protected
// (10 requests / 15 minutes per IP; higher in development).
router.post("/api/auth/register", authRateLimiter, authController.register);
router.post("/api/auth/login", authRateLimiter, authController.login);

// Logout (no rate limit needed; session must exist to be destroyed).
router.post("/api/auth/logout", authController.logout);

// Current user profile; requireAuth rejects unauthenticated calls.
router.get("/api/auth/me", requireAuth, authController.getMe);

module.exports = router;
