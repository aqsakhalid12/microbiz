// backend/src/config/env.js
// Loads environment variables from .env and exports validated configuration.
require("dotenv").config();

// Fail fast: the server cannot run without a database connection string.
// We check this before exporting anything so a missing value stops the app
// immediately with a clear message (instead of failing later on a bad query).
if (!process.env.DATABASE_URL) {
  console.error(
    "FATAL: DATABASE_URL is not defined. " +
      "Copy .env.example to .env and set DATABASE_URL to your PostgreSQL connection string."
  );
  process.exit(1);
}

/** Port the HTTP server listens on (default 3000). */
const PORT = process.env.PORT || 3000;

/** Current environment: "development" unless overridden. */
const NODE_ENV = process.env.NODE_ENV || "development";

/** PostgreSQL connection string (required, validated above). */
const DATABASE_URL = process.env.DATABASE_URL;

/** Secret for future session cookies (Phase 4). Kept optional for now. */
const SESSION_SECRET = process.env.SESSION_SECRET;

// NOTE: never log or export any other secrets here.
module.exports = { PORT, NODE_ENV, DATABASE_URL, SESSION_SECRET };
