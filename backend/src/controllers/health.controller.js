// backend/src/controllers/health.controller.js
// Handles GET /api/health: reports whether the app and database are up.
const { query } = require("../config/db");

/**
 * GET /api/health
 * - 200 with { success, status: "ok", database: "connected", timestamp }
 *   when the app can run "SELECT 1" against the database.
 * - 503 with { success: false, status: "error", database: "disconnected" }
 *   when the database is unreachable (no internal details exposed).
 */
async function healthCheck(req, res) {
  try {
    await query("SELECT 1"); // simplest possible database round-trip
    res.status(200).json({
      success: true,
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Log the real error server-side only; the client gets a generic status.
    console.error("Health check: database unreachable -", err.message);
    res.status(503).json({
      success: false,
      status: "error",
      database: "disconnected",
    });
  }
}

module.exports = { healthCheck };
