// backend/src/app.js
// Creates and configures the Express application.
// (The HTTP server itself is started in server.js so tests can import app.js.)
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const { NODE_ENV } = require("./config/env");
const sessionMiddleware = require("./config/session");
const csrfOriginCheck = require("./middleware/csrfOriginCheck");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// In production the app typically sits behind a reverse
// proxy: trust X-Forwarded-* headers from exactly 1 hop
// (so req.hostname / secure are correct for CSRF checks).
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security: set sensible HTTP headers (XSS protection, HSTS, etc.).
app.use(helmet());

// Logging: "dev" format gives short colored logs for each request.
app.use(morgan("dev"));

// Parse JSON request bodies, capped at 1 MB to avoid oversized payloads.
app.use(express.json({ limit: "1mb" }));

// Session middleware (PostgreSQL-backed, httpOnly cookie).
// Must come before any route that uses req.session.
app.use(sessionMiddleware);

// CSRF origin check for state-changing /api/* requests.
app.use(csrfOriginCheck);

// API routes.
app.use(healthRoutes);
app.use(authRoutes);

// Serve static files (CSS/JS/images/HTML) from the "frontend" folder.
// __dirname is backend/src, so two levels up is the project root.
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

// The root URL serves the placeholder page.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "frontend", "pages", "index.html"));
});

// Everything that matched nothing above gets a JSON 404.
app.use(notFound);

// Centralized error handler must be registered last.
app.use(errorHandler);

module.exports = app;
