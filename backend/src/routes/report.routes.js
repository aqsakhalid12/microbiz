// backend/src/routes/report.routes.js
// Routes for reports, mounted at /api/reports.
const express = require("express");
const reportController = require("../controllers/report.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All report routes require authentication
router.use(requireAuth);

router.get("/summary", reportController.summary);
router.get("/sales-trend", reportController.salesTrend);
router.get("/top-products", reportController.topProducts);
router.get("/expenses-by-category", reportController.expensesByCategory);
router.get("/low-stock", reportController.lowStock);
router.get("/recent-orders", reportController.recentOrders);

module.exports = router;