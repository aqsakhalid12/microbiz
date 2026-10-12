// backend/src/routes/health.routes.js
// Route definitions for the health endpoint.
const express = require("express");
const { healthCheck } = require("../controllers/health.controller");

const router = express.Router();

// GET /api/health -> liveness/readiness probe
router.get("/api/health", healthCheck);

module.exports = router;
