// backend/src/controllers/report.controller.js
// HTTP handlers for /api/reports/* endpoints.
// Express 5 forwards rejected promises to the error handler.
const reportService = require("../services/report.service");
const {
  validateDateRange,
  validateGroupBy,
  validateLimit,
} = require("../validators/report.validator");

/**
 * Map the validator's snake_case result to the service's camelCase query.
 */
function buildQuery(v, extra) {
  return {
    dateFrom: v.date_from,
    dateTo: v.date_to,
    groupBy: extra.group_by,
    limit: extra.limit,
  };
}

async function summary(req, res) {
  const v = validateDateRange(req.query);
  const groupBy = validateGroupBy(v, req.query.group_by);
  const data = await reportService.getSummary(req.user.id, buildQuery(v, { group_by: groupBy, limit: 0 }));
  res.json({ success: true, data });
}

async function salesTrend(req, res) {
  const v = validateDateRange(req.query);
  const groupBy = validateGroupBy(v, req.query.group_by);
  const data = await reportService.getSalesTrend(req.user.id, buildQuery(v, { group_by: groupBy, limit: 0 }));
  res.json({ success: true, data });
}

async function topProducts(req, res) {
  const v = validateDateRange(req.query);
  const limit = validateLimit(req.query.limit, 10, 100);
  const data = await reportService.getTopProducts(req.user.id, buildQuery(v, { group_by: null, limit }));
  res.json({ success: true, data });
}

async function expensesByCategory(req, res) {
  const v = validateDateRange(req.query);
  const data = await reportService.getExpensesByCategory(req.user.id, buildQuery(v, { group_by: null, limit: 0 }));
  res.json({ success: true, data });
}

async function lowStock(req, res) {
  const v = validateDateRange(req.query);
  const limit = validateLimit(req.query.limit, 20, 100);
  const data = await reportService.getLowStock(req.user.id, buildQuery(v, { group_by: null, limit }));
  res.json({ success: true, data });
}

async function recentOrders(req, res) {
  const v = validateDateRange(req.query);
  const limit = validateLimit(req.query.limit, 10, 50);
  const data = await reportService.getRecentOrders(req.user.id, buildQuery(v, { group_by: null, limit }));
  res.json({ success: true, data });
}

module.exports = {
  summary,
  salesTrend,
  topProducts,
  expensesByCategory,
  lowStock,
  recentOrders,
};