// backend/src/repositories/inventory.repository.js
// All SQL for the inventory_movements table.
// Parameterized queries only: user input via $1, $2, ... placeholders.
const { query } = require("../config/db");

/**
 * Insert an inventory movement record.
 * Runs inside a transaction provided by the caller.
 * @param {import("pg").PoolClient} client
 * @param {Object} data - movement data
 * @param {number} data.userId
 * @param {number} data.productId
 * @param {number|null} data.orderId
 * @param {string} data.movement_type - 'initial_stock' | 'purchase' | 'sale' | 'cancellation_restore' | 'adjustment'
 * @param {number} data.quantity_change - non-zero integer
 * @param {number} data.stock_after - >= 0
 * @param {string} data.reason
 * @returns {Promise<Object>} created movement
 */
async function insertMovement(client, { userId, productId, orderId, movement_type, quantity_change, stock_after, reason }) {
  const result = await client.query(
    `INSERT INTO inventory_movements (
       user_id, product_id, order_id, movement_type,
       quantity_change, stock_after, reason
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING
       id, user_id, product_id, order_id, movement_type,
       quantity_change, stock_after, reason, created_at`,
    [userId, productId, orderId, movement_type, quantity_change, stock_after, reason]
  );
  return result.rows[0];
}

/**
 * List inventory movements for a specific product, scoped to user.
 * Verifies the product belongs to the user before returning movements.
 * @param {number} userId
 * @param {number} productId
 * @param {number} page - page number (1-based)
 * @param {number} limit - items per page
 * @returns {Promise<{items: Array, total: number}>}
 */
async function listByProduct(userId, productId, page, limit) {
  // First verify product belongs to user and is not deleted
  const productCheck = await query(
    `SELECT 1 FROM products WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [productId, userId]
  );
  if (productCheck.rows.length === 0) {
    return { items: [], total: 0 };
  }

  const offset = (page - 1) * limit;

  // Count total
  const countResult = await query(
    `SELECT COUNT(*) FROM inventory_movements WHERE product_id = $1 AND user_id = $2`,
    [productId, userId]
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get movements
  const result = await query(
    `SELECT
       id, user_id, product_id, order_id, movement_type,
       quantity_change, stock_after, reason, created_at
     FROM inventory_movements
     WHERE product_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [productId, userId, limit, offset]
  );

  return { items: result.rows, total };
}

/**
 * List all inventory movements for a user, with optional filters.
 * Joins product names for display.
 * @param {number} userId
 * @param {Object} options
 * @param {number} [options.productId] - filter by product
 * @param {string} [options.type] - filter by movement_type
 * @param {number} options.page - page number (1-based)
 * @param {number} options.limit - items per page
 * @returns {Promise<{items: Array, total: number}>}
 */
async function listAll(userId, { productId, type, page, limit }) {
  const conditions = ["im.user_id = $1"];
  const params = [userId];
  let paramIndex = 2;

  if (productId) {
    conditions.push(`im.product_id = $${paramIndex}`);
    params.push(productId);
    paramIndex++;
  }

  if (type) {
    conditions.push(`im.movement_type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count total
  const countSql = `
    SELECT COUNT(*)
    FROM inventory_movements im
    ${whereClause}
  `;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Get movements with product name join
  const offset = (page - 1) * limit;
  const selectSql = `
    SELECT
      im.id, im.user_id, im.product_id, im.order_id, im.movement_type,
      im.quantity_change, im.stock_after, im.reason, im.created_at,
      p.name AS product_name, p.sku AS product_sku
    FROM inventory_movements im
    LEFT JOIN products p ON p.id = im.product_id
    ${whereClause}
    ORDER BY im.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);
  const result = await query(selectSql, params);

  return { items: result.rows, total };
}

module.exports = {
  insertMovement,
  listByProduct,
  listAll,
};