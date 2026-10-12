// backend/src/routes/inventory.routes.js
// Routes for inventory movements, mounted at /api/inventory.
const express = require("express");
const inventoryController = require("../controllers/inventory.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All inventory routes require authentication
router.use(requireAuth);

// GET /api/inventory/movements - all movements with filters
router.get("/movements", inventoryController.listMovements);

module.exports = router;