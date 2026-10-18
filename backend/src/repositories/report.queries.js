// backend/src/repositories/report.queries.js — parameterized SQL for
// /api/reports detail endpoints. Every query is filtered by user_id;
// groupBy is validated and mapped to a fixed unit string here, never
// interpolated raw into the query.
const { query } = require("../config/db");
const { rangeBounds } = require("./report.repository");

// pg returns BIGINT ids and NUMERIC amounts as JS strings; normalise every
// scalar to a number so callers never deal with stringified numerics.
function num(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

const SALES_TREND_UNITS = { day: "day", week: "week", month: "month" };

async function getSalesTrend(userId, dateFrom, dateTo, groupBy) {
  const unit = SALES_TREND_UNITS[groupBy];
  if (!unit) throw new Error(`Invalid groupBy: ${groupBy}. Expected one of day, week, month.`);
  const { startTs, endTs } = rangeBounds(dateFrom, dateTo);
  // generate_series must stop at dateTo (or the last period start <= dateTo),
  // so the series bounds use the raw dates while the subquery window uses
  // the [startTs, endTs) timestamp range.
  const sql = `
    SELECT
      TO_CHAR(gs.period, 'YYYY-MM-DD') AS period,
      COALESCE(sq.revenue, 0) AS revenue,
      COALESCE(sq.gross_profit, 0) AS gross_profit,
      COALESCE(sq.orders, 0) AS orders
    FROM generate_series(
      date_trunc($6, $2::date),
      date_trunc($6, $3::date),
      ('1 ' || $6)::interval
    ) AS gs(period)
    LEFT JOIN (
      SELECT
        date_trunc($6, o.completed_at)::date AS period,
        SUM(o.total) AS revenue,
        SUM(o.total) - COALESCE(SUM(oi.cost), 0) AS gross_profit,
        COUNT(*) AS orders
      FROM orders o
      LEFT JOIN (
        SELECT order_id, SUM(quantity * unit_cost) AS cost
        FROM order_items
        GROUP BY order_id
      ) oi ON oi.order_id = o.id
      WHERE o.user_id = $1 AND o.status = 'Completed'
        AND o.completed_at >= $4::timestamptz
        AND o.completed_at <  $5::timestamptz
      GROUP BY date_trunc($6, o.completed_at)
    ) sq ON sq.period = gs.period::date
    ORDER BY gs.period
  `;
  const result = await query(sql, [userId, dateFrom, dateTo, startTs, endTs, unit]);
  return result.rows.map((row) => ({
    period: row.period,
    revenue: num(row.revenue),
    gross_profit: num(row.gross_profit),
    orders: num(row.orders),
  }));
}

async function getTopProducts(userId, dateFrom, dateTo, limit) {
  const { startTs, endTs } = rangeBounds(dateFrom, dateTo);
  const sql = `
    SELECT
      p.id AS product_id, p.name AS name, p.sku AS sku,
      SUM(oi.quantity) AS quantity_sold,
      SUM(oi.quantity * oi.unit_price) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.user_id = $1 AND o.status = 'Completed'
      AND o.completed_at >= $2::timestamptz
      AND o.completed_at < $3::timestamptz
    GROUP BY p.id, p.name, p.sku
    ORDER BY quantity_sold DESC, revenue DESC
    LIMIT $4
  `;
  const result = await query(sql, [userId, startTs, endTs, limit]);
  return result.rows.map((row) => ({
    product_id: num(row.product_id), name: row.name, sku: row.sku,
    quantity_sold: num(row.quantity_sold), revenue: num(row.revenue),
  }));
}

async function getExpensesByCategory(userId, dateFrom, dateTo) {
  const sql = `
    SELECT category, SUM(amount) AS total
    FROM expenses
    WHERE user_id = $1 AND expense_date >= $2 AND expense_date <= $3
    GROUP BY category
    ORDER BY total DESC, category ASC
  `;
  const result = await query(sql, [userId, dateFrom, dateTo]);
  return result.rows.map((row) => ({ category: row.category, total: num(row.total) }));
}

async function getLowStock(userId, limit) {
  const sql = `
    SELECT id, name, sku, stock_quantity, low_stock_threshold
    FROM products
    WHERE user_id = $1 AND deleted_at IS NULL
      AND stock_quantity <= low_stock_threshold
    ORDER BY stock_quantity ASC, name ASC
    LIMIT $2
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows.map((row) => ({
    id: num(row.id), name: row.name, sku: row.sku,
    stock_quantity: num(row.stock_quantity),
    low_stock_threshold: num(row.low_stock_threshold),
  }));
}

async function getRecentOrders(userId, limit) {
  const sql = `
    SELECT o.id, o.order_number, o.status, o.payment_status,
      o.total, o.order_date, c.name AS customer_name
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.user_id = $1
    ORDER BY o.order_date DESC, o.id DESC
    LIMIT $2
  `;
  const result = await query(sql, [userId, limit]);
  return result.rows.map((row) => ({
    id: num(row.id), order_number: row.order_number, status: row.status,
    payment_status: row.payment_status, total: num(row.total),
    order_date: row.order_date, customer_name: row.customer_name,
  }));
}

module.exports = { getSalesTrend, getTopProducts, getExpensesByCategory, getLowStock, getRecentOrders };