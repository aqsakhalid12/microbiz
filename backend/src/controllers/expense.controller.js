// backend/src/controllers/expense.controller.js
// HTTP handlers for /api/expenses/* endpoints.
// Express 5 forwards rejected promises to the error handler.
const expenseService = require("../services/expense.service");
const {
  validateCreateExpense,
  validateUpdateExpense,
  validateExpenseListQuery,
} = require("../validators/expense.validator");
const AppError = require("../utils/AppError");

/**
 * Validate and parse :id parameter as positive integer.
 * Throws 400 if invalid.
 */
function parseIdParam(idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Invalid expense ID", 400);
  }
  return id;
}

/**
 * GET /api/expenses
 * Query: search, category, date_from, date_to, page, limit, sort
 * Returns items + pagination + summary { total_amount, count } for the same filters.
 */
async function listExpenses(req, res) {
  const filters = validateExpenseListQuery(req.query);
  const result = await expenseService.listExpenses(req.user.id, filters);
  const limitVal = Math.min(50, Math.max(1, parseInt(filters.limit, 10) || 10));
  const pageVal = Math.max(1, parseInt(filters.page, 10) || 1);
  res.json({
    success: true,
    data: result.items,
    pagination: {
      page: pageVal,
      limit: limitVal,
      total: result.total,
      totalPages: Math.ceil(result.total / limitVal),
    },
    summary: result.summary,
  });
}

/**
 * GET /api/expenses/categories
 */
async function listExpenseCategories(req, res) {
  const categories = await expenseService.listExpenseCategories(req.user.id);
  res.json({ success: true, data: categories });
}

/**
 * POST /api/expenses
 */
async function createExpense(req, res) {
  const data = validateCreateExpense(req.body);
  const expense = await expenseService.createExpense(req.user.id, data);
  res.status(201).json({ success: true, data: expense });
}

/**
 * GET /api/expenses/:id
 */
async function getExpense(req, res) {
  const id = parseIdParam(req.params.id);
  const expense = await expenseService.getExpense(req.user.id, id);
  res.json({ success: true, data: expense });
}

/**
 * PUT /api/expenses/:id
 */
async function updateExpense(req, res) {
  const id = parseIdParam(req.params.id);
  const data = validateUpdateExpense(req.body);
  const expense = await expenseService.updateExpense(req.user.id, id, data);
  res.json({ success: true, data: expense });
}

/**
 * DELETE /api/expenses/:id (hard delete)
 */
async function deleteExpense(req, res) {
  const id = parseIdParam(req.params.id);
  await expenseService.deleteExpense(req.user.id, id);
  res.json({ success: true, message: "Expense deleted" });
}

module.exports = {
  listExpenses,
  listExpenseCategories,
  createExpense,
  getExpense,
  updateExpense,
  deleteExpense,
};
