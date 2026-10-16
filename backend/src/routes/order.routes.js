// backend/src/routes/order.routes.js
// Routes for orders, mounted at /api/orders.
const express = require("express");
const orderController = require("../controllers/order.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All order routes require authentication
router.use(requireAuth);

// Main order listing and creation
router.get("/", orderController.listOrders);
router.post("/", orderController.createOrder);

// Individual order routes (with :id parameter)
router.get("/:id", orderController.getOrder);
router.put("/:id", orderController.updateOrder);
router.patch("/:id/status", orderController.updateOrderStatus);
router.patch("/:id/payment", orderController.recordPayment);

// No DELETE endpoint for orders.

module.exports = router;
