// backend/src/controllers/inventory.controller.js
// HTTP handlers for /api/inventory/* endpoints.
const productService = require("../services/product.service");
const AppError = require("../utils/AppError");

/**
 * GET /api/inventory/movements
 * Query: product_id, type, page, limit
 * Returns all inventory movements for the authenticated user,
 * with optional filters, joining product names.
 */
async function listMovements(req, res) {
  const userId = req.user.id;

  // product_id filter (optional)
  let productId = null;
  if (req.query.product_id !== undefined) {
    const parsed = parseInt(req.query.product_id, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError("Invalid product_id", 400);
    }
    productId = parsed;
  }

  // type filter (optional) - validate against enum
  const validTypes = ["initial_stock", "purchase", "sale", "cancellation_restore", "adjustment"];
  const type = validTypes.includes(req.query.type) ? req.query.type : null;

  // pagination
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const result = await productService.getAllMovements(userId, { productId, type, page, limit });

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
  listMovements,
};