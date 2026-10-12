// backend/src/middleware/requireAuth.js
// Protects routes: only requests with a valid server-side
// session may pass. The user id comes ONLY from the session
// stored on the server -- never from the request body,
// query string, or headers (those are client-controlled).
const userRepository = require("../repositories/user.repository");

async function requireAuth(req, res, next) {
  // The session id arrives via the httpOnly cookie; the
  // session content (userId) is read from the server store.
  const userId = req.session && req.session.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  }

  // Load the user to make sure it still exists
  // (e.g. the account may have been deleted).
  const user = await userRepository.findById(userId);
  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  }

  // From here on, handlers use req.user.id (server-trusted).
  req.user = { id: user.id };
  next();
}

module.exports = requireAuth;
