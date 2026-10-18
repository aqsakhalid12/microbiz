// backend/src/repositories/report.repository.js
// SQL for the summary endpoint of /api/reports.
// Parameterized queries only: user input is always passed via $1, $2, ...
// Every query is filtered by user_id so users only ever see their own data.
const { query } = require("../config/db");

/**
 * pg returns BIGINT ids and NUMERIC amounts as JS strings, and COUNT(*)
 * as a string too. Normalise every scalar to a number here so callers
 * never deal with stringified numerics.
 */
function num(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/**
 * Build the timestamp bounds for a [date_from 00:00, date_to + 1 day)
 * range in the server timezone.
 *
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 * @returns {{ startTs: string, endTs: string, nextDate: string }}
 */
function rangeBounds(dateFrom, dateTo) {
  // date_to + 1 day, computed in JS so the SQL stays simple.
  const [y, m, d] = dateTo.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, "0");
  const nd = String(dt.getDate()).padStart(2, "0");
  const nextDate = `${ny}-${nm}-${nd}`;
  return {
    startTs: `${dateFrom} 00:00:00`,
    endTs: `${nextDate} 00:00:00`,
  };
}

/**
 * GET /api/reports/summary
 *
 * All money and count aggregates in a single round-trip. The completed-
 * order window uses completed_at; the cash/created/cancelled windows use
 * order_date; expenses use expense_date; stock counts are point-in-time.
 *
 * @param {number} userId
 * @param {{ date_from: string, date_to: string }} range
 * @returns {Promise<Object>}
 */
async function getSummary(userId, range) {
  const { startTs, endTs } = rangeBounds(range.date_from, range.date_to);

  const sql = `
    SELECT
      (SELECT COALESCE(SUM(o.total), 0)
         FROM orders o
        WHERE o.user_id = $1
          AND o.status = 'Completed'
          AND o.completed_at >= $2::timestamptz
          AND o.completed_at <  $3::timestamptz) AS revenue,

      (SELECT COALESCE(SUM(oi.quantity * oi.unit_cost), 0)
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.user_id = $1
          AND o.status = 'Completed'
          AND o.completed_at >= $2::timestamptz
          AND o.completed_at <  $3::timestamptz) AS cost_of_goods,

      (SELECT COALESCE(SUM(e.amount), 0)
         FROM expenses e
        WHERE e.user_id = $1
          AND e.expense_date >= $4
          AND e.expense_date <= $5) AS expenses,

      (SELECT COALESCE(SUM(o.amount_paid), 0)
         FROM orders o
        WHERE o.user_id = $1
          AND o.status <> 'Cancelled'
          AND o.order_date >= $2::timestamptz
          AND o.order_date <  $3::timestamptz) AS cash_collected,

      (SELECT COUNT(*)
         FROM orders o
        WHERE o.user_id = $1
          AND o.order_date >= $2::timestamptz
          AND o.order_date <  $3::timestamptz) AS orders_total,

      (SELECT COUNT(*)
         FROM orders o
        WHERE o.user_id = $1
          AND o.status = 'Completed'
          AND o.completed_at >= $2::timestamptz
          AND o.completed_at <  $3::timestamptz) AS orders_completed,

      (SELECT COUNT(*)
         FROM orders o
        WHERE o.user_id = $1
          AND o.status = 'Pending') AS orders_pending,

      (SELECT COUNT(*)
         FROM orders o
        WHERE o.user_id = $1
          AND o.status = 'Cancelled'
          AND o.order_date >= $2::timestamptz
          AND o.order_date <  $3::timestamptz) AS orders_cancelled,

      (SELECT COUNT(*)
         FROM products p
        WHERE p.user_id = $1
          AND p.deleted_at IS NULL
          AND p.stock_quantity <= p.low_stock_threshold) AS low_stock_count,

      (SELECT COUNT(*)
         FROM products p
        WHERE p.user_id = $1
          AND p.deleted_at IS NULL
          AND p.stock_quantity = 0) AS out_of_stock_count
  `;

  const params = [userId, startTs, endTs, range.date_from, range.date_to];
  const result = await query(sql, params);
  const row = result.rows[0] || {};

  const revenue = num(row.revenue);
  const costOfGoods = num(row.cost_of_goods);
  const expenses = num(row.expenses);
  const cashCollected = num(row.cash_collected);
  const ordersTotal = num(row.orders_total);
  const ordersCompleted = num(row.orders_completed);
  const ordersPending = num(row.orders_pending);
  const ordersCancelled = num(row.orders_cancelled);
  const lowStockCount = num(row.low_stock_count);
  const outOfStockCount = num(row.out_of_stock_count);

  const grossProfit = revenue - costOfGoods;
  const netProfit = grossProfit - expenses;
  const averageOrderValue = ordersCompleted > 0 ? revenue / ordersCompleted : 0;

  return {
    range: { date_from: range.date_from, date_to: range.date_to },
    revenue,
    cost_of_goods: costOfGoods,
    gross_profit: grossProfit,
    expenses,
    net_profit: netProfit,
    cash_collected: cashCollected,
    orders: {
      total: ordersTotal,
      completed: ordersCompleted,
      pending: ordersPending,
      cancelled: ordersCancelled,
    },
    low_stock_count: lowStockCount,
    out_of_stock_count: outOfStockCount,
    average_order_value: averageOrderValue,
  };
}

module.exports = { getSummary, rangeBounds };