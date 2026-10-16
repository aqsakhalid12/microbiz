// backend/src/controllers/order.controller.js
// HTTP handlers for /api/orders/* endpoints.
// Express 5 forwards rejected promises to the error handler.
const orderService = require("../services/order.service");
const {
  validateOrderListQuery,
  validateCreateOrder,
  validateUpdateStatus,
  validatePayment,
} = require("../validators/order.validator");
const AppError = require("../utils/AppError");

/**
 * Validate and parse :id parameter as positive integer.
 * Throws 400 if invalid.
 */
function parseIdParam(idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid order ID", 400);
  }
  return id;
}

/**
 * GET /api/orders
 * Query: search, status, payment_status, date_from, date_to, page, limit, sort
 */
async function listOrders(req, res) {
  const query = validateOrderListQuery(req.query);
  const result = await orderService.listOrders(req.user.id, query);
  const limitVal = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
  const pageVal = Math.max(1, parseInt(query.page, 10) || 1);
  res.json({
    success: true,
    data: result.items,
    pagination: {
      page: pageVal,
      limit: limitVal,
      total: result.total,
      totalPages: Math.ceil(result.total / limitVal),
    },
  });
}

/**
 * POST /api/orders
 */
async function createOrder(req, res) {
  const data = validateCreateOrder(req.body);
  const order = await orderService.createOrder(req.user.id, data);
  res.status(201).json({ success: true, data: order });
}

/**
 * GET /api/orders/:id
 */
async function getOrder(req, res) {
  const id = parseIdParam(req.params.id);
  const order = await orderService.getOrder(req.user.id, id);
  res.json({ success: true, data: order });
}

/**
 * PUT /api/orders/:id
 * Only Pending orders can be edited.
 */
async function updateOrder(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateCreateOrder(req.body);
  const order = await orderService.updateOrder(req.user.id, id, data);
  res.json({ success: true, data: order });
}

/**
 * PATCH /api/orders/:id/status
 */
async function updateOrderStatus(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateUpdateStatus(req.body);
  const order = await orderService.updateOrderStatus(req.user.id, id, data.status);
  res.json({ success: true, data: order });
}

/**
 * PATCH /api/orders/:id/payment
 */
async function recordPayment(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validatePayment(req.body);
  const order = await orderService.recordPayment(req.user.id, id, data.amount_paid);
  res.json({ success: true, data: order });
}

module.exports = {
  listOrders,
  createOrder,
  getOrder,
  updateOrder,
  updateOrderStatus,
  recordPayment,
};
