// backend/src/config/db.js
// Creates the PostgreSQL connection pool and a small query helper.
const { Pool } = require("pg");
const { DATABASE_URL, NODE_ENV } = require("./env");

// The pool keeps a set of open connections and reuses them.
// SSL is only enabled in production (e.g. hosted databases like Render).
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: process.env.VERCEL ? 1 : undefined,
  ...(NODE_ENV === "production" ? { ssl: { rejectUnauthorized: false } } : {}),
});

// Pool-level errors (e.g. an idle client disconnecting) would otherwise
// crash the process, so log them instead.
pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

/**
 * Run a parameterized SQL query.
 * Always pass user input through `params` (never concatenate SQL strings)
 * so PostgreSQL treats it as data, not code (prevents SQL injection).
 *
 * @param {string} text SQL with $1, $2, ... placeholders
 * @param {Array} [params] values for the placeholders
 * @returns {Promise<import("pg").QueryResult>}
 */
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

module.exports = { pool, query };
