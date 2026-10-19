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
const productRoutes = require("./routes/product.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const customerRoutes = require("./routes/customer.routes");
const expenseRoutes = require("./routes/expense.routes");
const orderRoutes = require("./routes/order.routes");
const reportRoutes = require("./routes/report.routes");
const settingsRoutes = require("./routes/settings.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
// Directory for HTML page files (served via custom routes).
const PAGES_DIR = path.join(__dirname, "..", "..", "frontend", "pages");

const app = express();

// In production the app typically sits behind a reverse
// proxy: trust X-Forwarded-* headers from exactly 1 hop
// (so req.hostname / secure are correct for CSRF checks).
if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Security: set sensible HTTP headers (XSS protection, HSTS, etc.).
// The Content-Security-Policy is customized so the Bootstrap /
// Bootstrap Icons CDN (cdn.jsdelivr.net) works:
//   - scripts and fonts may load from that CDN
//   - styles may load from that CDN, and 'unsafe-inline' is allowed
//     for style-src ONLY (Bootstrap's JS sets inline styles)
//   - inline <script> blocks are NOT allowed (all our JS is external)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
        
      },
    },
  }),
);

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
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", settingsRoutes);

// Page routes (before static so these URLs stay stable even if
// files with the same names are added to the static root).
app.get("/", (req, res) => res.redirect("/dashboard"));

app.get(["/login", "/register"], (req, res) => {
  if (req.session.userId) return res.redirect("/dashboard");
  res.sendFile(
    path.join(
      PAGES_DIR,
      req.path === "/login" ? "login.html" : "register.html",
    ),
  );
});

app.get("/dashboard", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "dashboard.html"));
});

app.get("/products", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "products.html"));
});

app.get("/inventory", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "inventory.html"));
});

app.get("/customers", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "customers.html"));
});

app.get("/orders", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "orders.html"));
});

app.get("/expenses", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "expenses.html"));
});

app.get("/settings", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "settings.html"));
});

app.get("/reports", (req, res) => {
  if (!req.session.userId) return res.redirect("/login");
  res.sendFile(path.join(PAGES_DIR, "reports.html"));
});

// Serve static files (CSS/JS/images/HTML) from the "frontend" folder.
// __dirname is backend/src, so two levels up is the project root.
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

// Everything that matched nothing above gets a JSON 404.
app.use(notFound);

// Centralized error handler must be registered last.
app.use(errorHandler);

module.exports = app;





