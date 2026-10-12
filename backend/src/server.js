// backend/src/server.js
// Entry point: imports the app, starts listening, and handles graceful shutdown.
const app = require("./app");
const { PORT } = require("./config/env");
const { pool } = require("./config/db");

// Start the HTTP server and log where the app is reachable.
const server = app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode at http://localhost:${PORT}`
  );
});

// Graceful shutdown: stop accepting new requests, close the server,
// then close all database connections before exiting.
function shutdown(signal) {
  console.log(`${signal} received: shutting down gracefully...`);
  server.close(async () => {
    try {
      await pool.end(); // releases every connection in the pool
    } catch (err) {
      console.error("Error closing the database pool:", err.message);
    }
    console.log("Server and database pool closed.");
    process.exit(0);
  });
}

// SIGINT = Ctrl+C, SIGTERM = stop signal from process managers.
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Log unhandled promise rejections (they would otherwise be silent).
process.on("unhandledRejection", (err) => {
  console.error("Unhandled promise rejection:", err);
});
