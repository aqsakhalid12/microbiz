// backend/src/controllers/auth.controller.js
// HTTP handlers for /api/auth/*.
// Express 5 forwards rejected promises to the error handler,
// so handlers can be plain async functions (no try/catch needed).
const authService = require("../services/auth.service");

/**
 * Replace the current session with a fresh empty one.
 * Done on every login to prevent session fixation attacks.
 */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// POST /api/auth/register
// Creates an account and logs the user in immediately.
async function register(req, res) {
  const user = await authService.register(req.body);

  // Fresh session, then store only the user id in it.
  await regenerateSession(req);
  req.session.userId = user.id;

  res.status(201).json({ success: true, user });
}

// POST /api/auth/login
async function login(req, res) {
  const user = await authService.login(req.body);

  // Regenerate first (session fixation defense), then store
  // ONLY the user id. Never put email/roles in the session.
  await regenerateSession(req);
  req.session.userId = user.id;

  res.json({ success: true, user });
}

// POST /api/auth/logout
function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    // Also tell the browser to drop the cookie.
    res.clearCookie("microbiz.sid");
    res.json({ success: true, message: "Logged out" });
  });
}

// GET /api/auth/me  (protected by requireAuth)
// Profile is loaded fresh from the database on every call,
// keyed by the id from the SERVER session (req.user.id),
// never from client-supplied ids.
async function getMe(req, res) {
  const user = await authService.getProfile(req.user.id);
  res.json({ success: true, user });
}

module.exports = { register, login, logout, getMe };
