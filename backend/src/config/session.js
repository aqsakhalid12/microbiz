// backend/src/config/session.js
// Configures express-session with server-side storage in PostgreSQL
// (connect-pg-simple). Sessions live in the "session" table so they
// survive server restarts and can be inspected or revoked.
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);

const { pool } = require("./db");
const { NODE_ENV, SESSION_SECRET } = require("./env");

// The placeholder value from .env.example. It must never be used
// as a real secret in production.
const PLACEHOLDER_SECRET = "replace_with_a_long_random_string";

// In production, refuse to start unless SESSION_SECRET is a real,
// long, non-placeholder value. Failing fast is safer than running
// with a guessable session secret.
if (NODE_ENV === "production") {
  if (!SESSION_SECRET) {
    throw new Error(
      "FATAL: SESSION_SECRET is required in production. Set it in your environment."
    );
  }
  if (SESSION_SECRET.length < 32) {
    throw new Error(
      "FATAL: SESSION_SECRET must be at least 32 characters in production."
    );
  }
  if (SESSION_SECRET === PLACEHOLDER_SECRET) {
    throw new Error(
      "FATAL: SESSION_SECRET is still the placeholder value from .env.example. Set a real secret."
    );
  }
}

// In development a weak secret is acceptable; in production the checks
// above guarantee a strong one.
const secret = SESSION_SECRET || "dev-only-secret-change-in-production";

const sessionMiddleware = session({
  // Store sessions in the "session" table using the existing pg pool.
  store: new pgSession({ pool, tableName: "session" }),

  // Cookie name shown in the browser; avoid the default "connect.sid".
  name: "microbiz.sid",

  secret,

  // Do not save sessions that were never modified, and do not
  // re-save unchanged sessions (recommended defaults).
  resave: false,
  saveUninitialized: false,

  cookie: {
    // Not readable by JavaScript (helps against XSS stealing the cookie).
    httpOnly: true,
    // Send the cookie only on same-site requests (CSRF defense in depth).
    sameSite: "lax",
    // Only send over HTTPS in production (localhost is HTTP in development).
    secure: NODE_ENV === "production",
    // 7 days.
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
});

module.exports = sessionMiddleware;
