// backend/src/routes/product.routes.js
// Routes for products, mounted at /api/products.
const express = require("express");
const productController = require("../controllers/product.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All product routes require authentication
router.use(requireAuth);

// Fixed routes (categories, low-stock) MUST come before /:id
router.get("/api/products/categories", productController.listCategories);
router.get("/api/products/low-stock", productController.listLowStock);

// Main product listing and creation
router.get("/api/products", productController.listProducts);
router.post("/api/products", productController.createProduct);

// Individual product routes (with :id parameter)
router.get("/api/products/:id", productController.getProduct);
router.put("/api/products/:id", productController.updateProduct);
router.delete("/api/products/:id", productController.deleteProduct);

// Stock adjustments
router.post("/api/products/:id/stock-adjustments", productController.adjustStock);

// Product movement history
router.get("/api/products/:id/movements", productController.getProductMovements);

module.exports = router;