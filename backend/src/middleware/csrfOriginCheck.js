// backend/src/middleware/csrfOriginCheck.js
// CSRF defense for state-changing API requests.
//
// Strategy (see docs/security.md):
//   1. Cookies use SameSite=lax (browsers won't send them
//      on cross-site POSTs).
//   2. This middleware adds a second layer: for
//      POST/PUT/PATCH/DELETE on /api/*, an Origin header
//      (sent by browsers) must match the request's own host.
//
// Requests WITHOUT an Origin header (Postman, server-to-server
// calls) are allowed in development. In production they are
// rejected only when a session cookie is present, i.e. when
// a logged-in browser session could be abused.
const { NODE_ENV } = require("../config/env");

const STATE_CHANGING = ["POST", "PUT", "PATCH", "DELETE"];

function csrfOriginCheck(req, res, next) {
  // Only care about state-changing API requests.
  if (!STATE_CHANGING.includes(req.method)) return next();
  if (!req.path.startsWith("/api/")) return next();

  const origin = req.get("Origin");

  if (origin) {
    // Browser request: Origin must equal our own host
    // (host + port, e.g. "localhost:3000").
    let originHost = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null; // malformed Origin (e.g. "null")
    }
    if (!originHost || originHost !== req.get("host")) {
      return res
        .status(403)
        .json({ success: false, message: "Cross-origin request rejected" });
    }
    return next();
  }

  // No Origin header: tools like Postman.
  if (NODE_ENV === "production") {
    // In production every request rides a cookie session, so
    // only allow it when no session cookie is attached
    // (e.g. a first-time login attempt from a script).
    const cookieHeader = req.get("cookie") || "";
    if (cookieHeader.includes("microbiz.sid=")) {
      return res
        .status(403)
        .json({ success: false, message: "Origin header required" });
    }
  }
  next();
}

module.exports = csrfOriginCheck;
