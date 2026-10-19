// backend/src/routes/settings.routes.js
// Routes for business settings, mounted at /api/settings.
const express = require("express");
const settingsController = require("../controllers/settings.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All settings routes require authentication
router.use(requireAuth);

// GET /api/settings - get business settings for current user
router.get("/", settingsController.getSettings);

// PUT /api/settings - update business settings for current user
router.put("/", settingsController.updateSettings);

module.exports = router;