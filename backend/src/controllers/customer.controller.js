// backend/src/controllers/customer.controller.js
// HTTP handlers for /api/customers/* endpoints.
// Express 5 forwards rejected promises to the error handler.
const customerService = require("../services/customer.service");
const { validateCreateCustomer, validateUpdateCustomer } = require("../validators/customer.validator");
const AppError = require("../utils/AppError");

/**
 * Validate and parse :id parameter as positive integer.
 * Throws 400 if invalid.
 */
function parseIdParam(idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid customer ID", 400);
  }
  return id;
}

/**
 * GET /api/customers
 */
async function listCustomers(req, res) {
  const { search, page, limit, sort } = req.query;
  const result = await customerService.listCustomers(req.user.id, { search, page, limit, sort });
  res.json({
    success: true,
    data: result.items,
    pagination: {
      page: Math.max(1, parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
      total: result.total,
      totalPages: Math.ceil(result.total / Math.min(50, Math.max(1, parseInt(limit, 10) || 10))),
    },
  });
}

/**
 * POST /api/customers
 */
async function createCustomer(req, res) {
  const data = validateCreateCustomer(req.body);
  const customer = await customerService.createCustomer(req.user.id, data);
  res.status(201).json({ success: true, data: customer });
}

/**
 * GET /api/customers/:id
 */
async function getCustomer(req, res) {
  const id = parseIdParam(req.params.id);
  const customer = await customerService.getCustomer(req.user.id, id);
  res.json({ success: true, data: customer });
}

/**
 * PUT /api/customers/:id
 */
async function updateCustomer(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateUpdateCustomer(req.body);
  const customer = await customerService.updateCustomer(req.user.id, id, data);
  res.json({ success: true, data: customer });
}

/**
 * DELETE /api/customers/:id
 */
async function deleteCustomer(req, res) {
  const id = parseIdParam(req.params.id);
  await customerService.deleteCustomer(req.user.id, id);
  res.json({ success: true, message: "Customer deleted" });
}

/**
 * GET /api/customers/:id/orders
 */
async function getCustomerOrders(req, res) {
  const id = parseIdParam(req.params.id);
  const { page, limit } = req.query;
  const result = await customerService.getCustomerOrders(req.user.id, id, { page, limit });
  const limitVal = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const pageVal = Math.max(1, parseInt(page, 10) || 1);
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

module.exports = {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerOrders,
};
