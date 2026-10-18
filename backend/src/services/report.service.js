// backend/src/services/report.service.js
// Business logic for report endpoints. The query object passed in is
// already validated by report.validator.js (camelCase keys).
const reportRepository = require("../repositories/report.repository");
const reportQueries = require("../repositories/report.queries");

// Convert dollars to integer cents, do the math, then convert back to a
// 2-decimal number so float arithmetic never leaks into the API.
function toCents(x) { return Math.round(x * 100); }
function fromCents(c) { return Number((c / 100).toFixed(2)); }

async function getSummary(userId, q) {
  const range = { date_from: q.dateFrom, date_to: q.dateTo };
  const summary = await reportRepository.getSummary(userId, range);

  const revenue = toCents(summary.revenue);
  const costOfGoods = toCents(summary.cost_of_goods);
  const expenses = toCents(summary.expenses);
  const cashCollected = toCents(summary.cash_collected);

  const grossProfit = revenue - costOfGoods;
  const netProfit = grossProfit - expenses;
  const completed = summary.orders.completed;
  const averageOrderValue = completed > 0 ? Math.round(revenue / completed) : 0;

  return {
    range: { date_from: q.dateFrom, date_to: q.dateTo },
    revenue: fromCents(revenue),
    cost_of_goods: fromCents(costOfGoods),
    gross_profit: fromCents(grossProfit),
    expenses: fromCents(expenses),
    net_profit: fromCents(netProfit),
    cash_collected: fromCents(cashCollected),
    orders: {
      total: summary.orders.total,
      completed: summary.orders.completed,
      pending: summary.orders.pending,
      cancelled: summary.orders.cancelled,
    },
    low_stock_count: summary.low_stock_count,
    out_of_stock_count: summary.out_of_stock_count,
    average_order_value: fromCents(averageOrderValue),
  };
}

async function getSalesTrend(userId, q) {
  return reportQueries.getSalesTrend(userId, q.dateFrom, q.dateTo, q.groupBy);
}

async function getTopProducts(userId, q) {
  return reportQueries.getTopProducts(userId, q.dateFrom, q.dateTo, q.limit);
}

async function getExpensesByCategory(userId, q) {
  return reportQueries.getExpensesByCategory(userId, q.dateFrom, q.dateTo);
}

async function getLowStock(userId, q) {
  return reportQueries.getLowStock(userId, q.limit);
}

async function getRecentOrders(userId, q) {
  return reportQueries.getRecentOrders(userId, q.limit);
}

async function getDashboard(userId, q) {
  const [summary, trend, topProducts, expensesByCategory, lowStock, recentOrders] =
    await Promise.all([
      getSummary(userId, q),
      getSalesTrend(userId, q),
      getTopProducts(userId, q),
      getExpensesByCategory(userId, q),
      getLowStock(userId, q),
      getRecentOrders(userId, q),
    ]);

  return {
    summary,
    sales_trend: trend,
    top_products: topProducts,
    expenses_by_category: expensesByCategory,
    low_stock,
    recent_orders: recentOrders,
  };
}

module.exports = {
  getSummary,
  getSalesTrend,
  getTopProducts,
  getExpensesByCategory,
  getLowStock,
  getRecentOrders,
  getDashboard,
};