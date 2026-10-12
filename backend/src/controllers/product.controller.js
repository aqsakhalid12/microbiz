// backend/src/controllers/product.controller.js
// HTTP handlers for /api/products/* endpoints.
// Express 5 forwards rejected promises to the error handler.
const productService = require("../services/product.service");
const { validateCreateProduct, validateUpdateProduct, validateStockAdjustment, validateProductListQuery } = require("../validators/product.validator");
const AppError = require("../utils/AppError");

/**
 * Validate and parse :id parameter as positive integer.
 * Throws 400 if invalid.
 */
function parseIdParam(idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid product ID", 400);
  }
  return id;
}

/**
 * GET /api/products
 * Query: search, category, stock, page, limit, sort
 */
async function listProducts(req, res) {
  const query = validateProductListQuery(req.query);
  const result = await productService.listProducts(req.user.id, query);
  res.json({
    success: true,
    data: result.items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  });
}

/**
 * GET /api/products/categories
 */
async function listCategories(req, res) {
  const categories = await productService.getCategories(req.user.id);
  res.json({ success: true, data: categories });
}

/**
 * GET /api/products/low-stock
 */
async function listLowStock(req, res) {
  const products = await productService.getLowStockProducts(req.user.id);
  res.json({ success: true, data: products });
}

/**
 * GET /api/products/:id
 */
async function getProduct(req, res) {
  const id = parseIdParam(req.params.id);
  const product = await productService.getProduct(req.user.id, id);
  if (!product) {
    throw new AppError("Product not found", 404);
  }
  res.json({ success: true, data: product });
}

/**
 * POST /api/products
 */
async function createProduct(req, res) {
  const data = validateCreateProduct(req.body);
  const product = await productService.createProduct(req.user.id, data);
  res.status(201).json({ success: true, data: product });
}

/**
 * PUT /api/products/:id
 * stock_quantity is NOT updatable via this endpoint.
 */
async function updateProduct(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateUpdateProduct(req.body);
  const product = await productService.updateProduct(req.user.id, id, data);
  res.json({ success: true, data: product });
}

/**
 * DELETE /api/products/:id
 */
async function deleteProduct(req, res) {
  const id = parseIdParam(req.params.id);
  await productService.deleteProduct(req.user.id, id);
  res.json({ success: true, message: "Product deleted" });
}

/**
 * POST /api/products/:id/stock-adjustments
 * Adjust stock (purchase or adjustment).
 */
async function adjustStock(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateStockAdjustment(req.body);
  const product = await productService.adjustStock(req.user.id, id, data);
  res.json({ success: true, data: product });
}

/**
 * GET /api/products/:id/movements
 * Inventory movement history for a product.
 */
async function getProductMovements(req, res) {
  const id = parseIdParam(req.params.id);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const result = await productService.getProductMovements(req.user.id, id, page, limit);
  res.json({
    success: true,
    data: result.items,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    },
  });
}

module.exports = {
  listProducts,
  listCategories,
  listLowStock,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getProductMovements,
};