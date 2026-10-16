// backend/src/repositories/order.repository.js
// All SQL for orders, order_items and stock-related product updates.
// Parameterized queries only: user input via $1, $2, ... placeholders.
// Functions accepting a `client` run inside a transaction started by the caller.
const { query } = require("../config/db");

const ORDER_FIELDS = `
  id, user_id, customer_id, order_number, status,
  payment_status, subtotal, discount, total,
  amount_paid, order_date, completed_at, stock_deducted,
  notes, created_at, updated_at
`;

const ORDER_FIELDS_PREFIXED = `
  o.id, o.user_id, o.customer_id, o.order_number, o.status,
  o.payment_status, o.subtotal, o.discount, o.total,
  o.amount_paid, o.order_date, o.completed_at, o.stock_deducted,
  o.notes, o.created_at, o.updated_at
`;

/**
 * Normalize NUMERIC columns (returned as strings by pg) to JS numbers.
 * @param {Object} row - database row
 * @returns {Object} row with money fields converted
 */
function normalizeOrderMoney(row) {
  if (!row) return null;
  return {
    ...row,
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    total: Number(row.total),
    amount_paid: Number(row.amount_paid),
  };
}

function normalizeOrderItem(row) {
  if (!row) return null;
  return {
    ...row,
    unit_price: Number(row.unit_price),
    unit_cost: Number(row.unit_cost),
    line_total: Number(row.line_total),
    quantity: Number(row.quantity),
  };
}

/**
 * Insert a new order inside the caller's transaction.
 * @param {import("pg").PoolClient} client
 * @param {Object} data
 * @returns {Promise<Object>} inserted order row
 */
async function createOrder(client, { userId, orderNumber, customerId, subtotal, discount, total, notes }) {
  const result = await client.query(
    `INSERT INTO orders (
       user_id, customer_id, order_number, status, payment_status,
       subtotal, discount, total, amount_paid, notes
     )
     VALUES ($1, $2, $3, 'Pending', 'Unpaid', $4, $5, $6, 0, $7)
     RETURNING ${ORDER_FIELDS}`,
    [userId, customerId, orderNumber, subtotal, discount, total, notes]
  );
  return normalizeOrderMoney(result.rows[0]);
}

/**
 * Insert a single order line item inside the caller's transaction.
 * @param {import("pg").PoolClient} client
 * @param {Object} data
 * @returns {Promise<Object>} inserted order item row
 */
async function createOrderItem(client, { orderId, productId, productName, sku, quantity, unitPrice, unitCost, lineTotal }) {
  const result = await client.query(
    `INSERT INTO order_items (
       order_id, product_id, product_name, sku, quantity,
       unit_price, unit_cost, line_total
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total, created_at`,
    [orderId, productId, productName, sku, quantity, unitPrice, unitCost, lineTotal]
  );
  return normalizeOrderItem(result.rows[0]);
}

/**
 * Lock an order row for update, scoped to the owning user.
 * @param {import("pg").PoolClient} client
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findOrderForUpdate(client, userId, id) {
  const result = await client.query(
    `SELECT ${ORDER_FIELDS} FROM orders WHERE id = $2 AND user_id = $1 FOR UPDATE`,
    [userId, id]
  );
  return normalizeOrderMoney(result.rows[0] || null);
}

/**
 * Get a single order with its customer and items, scoped to the owning user.
 * Other users' orders -> null (404 in the service layer).
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findOrderWithItems(userId, id) {
  const orderResult = await query(
    `SELECT ${ORDER_FIELDS_PREFIXED},
            c.name AS customer_name,
            c.email AS customer_email,
            c.phone AS customer_phone
     FROM orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $2 AND o.user_id = $1`,
    [userId, id]
  );
  const order = normalizeOrderMoney(orderResult.rows[0] || null);
  if (!order) return null;

  const itemsResult = await query(
    `SELECT id, order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total, created_at
     FROM order_items
     WHERE order_id = $1
     ORDER BY id`,
    [id]
  );

  return {
    ...order,
    customer: order.customer_id
      ? {
        id: order.customer_id,
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone,
      }
      : null,
    items: itemsResult.rows.map(normalizeOrderItem),
    item_count: itemsResult.rows.length,
  };
}

/**
 * List orders for a user with search, status, payment status and date filters,
 * pagination and sorting. Includes customer name and item count per order.
 * @param {number} userId
 * @param {Object} options
 * @returns {Promise<{items: Array, total: number}>}
 */
async function listOrders(userId, { search, status, paymentStatus, dateFrom, dateTo, page, limit, sort }) {
  const conditions = ["o.user_id = $1"];
  const params = [userId];
  let paramIndex = 2;

  if (search) {
    conditions.push(`(o.order_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (status) {
    conditions.push(`o.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (paymentStatus) {
    conditions.push(`o.payment_status = $${paramIndex}`);
    params.push(paymentStatus);
    paramIndex++;
  }

  if (dateFrom) {
    conditions.push(`o.order_date >= $${paramIndex}`);
    params.push(`${dateFrom} 00:00:00`);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`o.order_date < $${paramIndex}`);
    params.push(`${dateTo} 00:00:00`);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const countSql = `
    SELECT COUNT(*)
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${whereClause}
  `;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const sortWhitelist = { order_date: "o.order_date", total: "o.total", order_number: "o.order_number" };
  const [sortFieldRaw, sortDirRaw] = sort ? sort.split(":") : ["order_date", "desc"];
  const safeSortField = sortWhitelist[sortFieldRaw] || "o.order_date";
  const safeSortDir = sortDirRaw === "asc" ? "ASC" : "DESC";

  const offset = (page - 1) * limit;
  const selectSql = `
    SELECT ${ORDER_FIELDS_PREFIXED},
           c.name AS customer_name,
           (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    ${whereClause}
    ORDER BY ${safeSortField} ${safeSortDir}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);
  const result = await query(selectSql, params);

  return {
    items: result.rows.map((row) => normalizeOrderMoney({
      ...row,
      item_count: Number(row.item_count),
    })),
    total,
  };
}

/**
 * Replace all items of an order inside the caller's transaction.
 * Deletes existing line items, then inserts the new ones.
 * @param {import("pg").PoolClient} client
 * @param {number} orderId
 * @param {Array} items - array of { product_id, product_name, sku, quantity, unit_price, unit_cost, line_total }
 * @returns {Promise<Array>} inserted order item rows
 */
async function replaceOrderItems(client, orderId, items) {
  await client.query(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);

  const createdItems = [];
  for (const item of items) {
    createdItems.push(await createOrderItem(client, {
      orderId,
      productId: item.product_id,
      productName: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      unitCost: item.unit_cost,
      lineTotal: item.line_total,
    }));
  }
  return createdItems;
}

/**
 * Update scalar columns on an order inside the caller's transaction.
 * @param {import("pg").PoolClient} client
 * @param {number} id
 * @param {Object} updates - column -> value map (columns already SQL-safe)
 * @returns {Promise<Object|null>} updated row or null if not found
 */
async function updateOrderColumns(client, id, updates) {
  const fields = [];
  const params = [id];
  let paramIndex = 2;
  for (const [column, value] of Object.entries(updates)) {
    fields.push(`${column} = $${paramIndex}`);
    params.push(value);
    paramIndex++;
  }
  fields.push("updated_at = now()");

  const result = await client.query(
    `UPDATE orders SET ${fields.join(", ")} WHERE id = $1 RETURNING ${ORDER_FIELDS}`,
    params
  );
  return normalizeOrderMoney(result.rows[0] || null);
}

/**
 * Lock product rows for update, ordered by id (deadlock prevention),
 * scoped to the owning user and excluding soft-deleted products.
 * @param {import("pg").PoolClient} client
 * @param {number} userId
 * @param {number[]} productIds
 * @returns {Promise<Array>} locked product rows
 */
async function lockProductsForUpdate(client, userId, productIds) {
    const result = await client.query(
      `SELECT id, name, sku, stock_quantity, deleted_at, selling_price, cost_price
       FROM products
       WHERE id = ANY($1::bigint[]) AND user_id = $2
       ORDER BY id
       FOR UPDATE`,
      [productIds, userId]
    );
  return result.rows;
}

/**
 * Update a product's stock quantity inside the caller's transaction.
 * @param {import("pg").PoolClient} client
 * @param {number} productId
 * @param {number} newQuantity
 * @returns {Promise<number>} new stock quantity
 */
async function updateProductStock(client, productId, newQuantity) {
  const result = await client.query(
    `UPDATE products
     SET stock_quantity = $1, updated_at = now()
     WHERE id = $2
     RETURNING stock_quantity`,
    [newQuantity, productId]
  );
  return Number(result.rows[0].stock_quantity);
}

module.exports = {
  createOrder,
  createOrderItem,
  findOrderForUpdate,
  findOrderWithItems,
  listOrders,
  replaceOrderItems,
  updateOrderColumns,
  lockProductsForUpdate,
  updateProductStock,
};
