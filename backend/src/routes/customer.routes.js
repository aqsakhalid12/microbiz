// backend/src/routes/customer.routes.js
// Routes for customers, mounted at /api/customers.
const express = require("express");
const customerController = require("../controllers/customer.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All customer routes require authentication
router.use(requireAuth);

// Main customer listing and creation
router.get("/", customerController.listCustomers);
router.post("/", customerController.createCustomer);

// Individual customer routes
router.get("/:id", customerController.getCustomer);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", customerController.deleteCustomer);

// Customer orders
router.get("/:id/orders", customerController.getCustomerOrders);

module.exports = router;
