// backend/src/routes/product.routes.js
// Routes for products, mounted at /api/products.
const express = require("express");
const productController = require("../controllers/product.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All product routes require authentication
router.use(requireAuth);

// Fixed routes (categories, low-stock) MUST come before /:id
router.get("/categories", productController.listCategories);
router.get("/low-stock", productController.listLowStock);

// Main product listing and creation
router.get("/", productController.listProducts);
router.post("/", productController.createProduct);

// Individual product routes (with :id parameter)
router.get("/:id", productController.getProduct);
router.put("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

// Stock adjustments
router.post("/:id/stock-adjustments", productController.adjustStock);

// Product movement history
router.get("/:id/movements", productController.getProductMovements);

module.exports = router;