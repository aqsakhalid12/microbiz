// backend/src/repositories/product.repository.js
// All SQL for the products table. Parameterized queries only:
// user input is always passed via $1, $2, ... placeholders.
const { query } = require("../config/db");

/**
 * Convert numeric fields from pg string format to JS numbers.
 * PostgreSQL returns NUMERIC columns as strings; we convert them
 * to proper numbers for consistent JSON responses.
 * @param {Object} row - database row
 * @returns {Object} row with numeric fields converted
 */
function normalizeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    selling_price: Number(row.selling_price),
    cost_price: Number(row.cost_price),
    stock_quantity: Number(row.stock_quantity),
    low_stock_threshold: Number(row.low_stock_threshold),
  };
}

/**
 * List products for a user with filtering, pagination, and sorting.
 * Soft-deleted products (deleted_at IS NOT NULL) are excluded.
 *
 * @param {number} userId - authenticated user id from session
 * @param {Object} options - query options
 * @param {string} options.search - search term for name/sku (ILIKE)
 * @param {string} options.category - category filter
 * @param {string} options.stock - stock filter: 'low', 'out', 'in'
 * @param {number} options.page - page number (1-based)
 * @param {number} options.limit - items per page (max 50)
 * @param {string} options.sort - sort field:direction (whitelisted)
 * @returns {Promise<{items: Array, total: number}>}
 */
async function list(userId, { search, category, stock, page, limit, sort }) {
  // Build WHERE clause
  const conditions = ["user_id = $1", "deleted_at IS NULL"];
  const params = [userId];
  let paramIndex = 2;

  if (search) {
    conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (category) {
    conditions.push(`category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (stock === "low") {
    // low: stock_quantity <= low_stock_threshold AND > 0
    conditions.push("stock_quantity > 0 AND stock_quantity <= low_stock_threshold");
  } else if (stock === "out") {
    // out: stock_quantity = 0
    conditions.push("stock_quantity = 0");
  } else if (stock === "in") {
    // in: stock_quantity > low_stock_threshold
    conditions.push("stock_quantity > low_stock_threshold");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Sort whitelist - never put raw input into SQL
  const sortWhitelist = {
    name: "name",
    selling_price: "selling_price",
    stock_quantity: "stock_quantity",
    created_at: "created_at",
  };
  const [sortField, sortDir] = sort.split(":");
  const safeSortField = sortWhitelist[sortField] || "name";
  const safeSortDir = sortDir === "desc" ? "DESC" : "ASC";
  const orderBy = `${safeSortField} ${safeSortDir}`;

  // Count total
  const countSql = `SELECT COUNT(*) FROM products ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Paginated results
  const offset = (page - 1) * limit;
  const selectSql = `
    SELECT
      id, name, sku, description, category,
      selling_price, cost_price, stock_quantity,
      low_stock_threshold, image_url,
      created_at, updated_at
    FROM products
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);
  const result = await query(selectSql, params);

  return { items: result.rows.map(normalizeProduct), total };
}

/**
 * Find a product by id for a specific user.
 * Excludes soft-deleted products.
 * @param {number} userId
 * @param {number} id
 * @param {import("pg").PoolClient} [client] - optional transaction client
 * @returns {Promise<Object|null>}
 */
async function findById(userId, id, client = null) {
  const sql = `
    SELECT
      id, name, sku, description, category,
      selling_price, cost_price, stock_quantity,
      low_stock_threshold, image_url,
      created_at, updated_at, deleted_at
    FROM products
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
  `;
  const params = [id, userId];
  const runner = client || query;
  const result = await runner(sql, params);
  return normalizeProduct(result.rows[0] || null);
}

/**
 * List distinct categories for a user's products.
 * Excludes soft-deleted products.
 * @param {number} userId
 * @returns {Promise<string[]>}
 */
async function listCategories(userId) {
  const result = await query(
    `SELECT DISTINCT category
     FROM products
     WHERE user_id = $1 AND deleted_at IS NULL AND category IS NOT NULL
     ORDER BY category`,
    [userId]
  );
  return result.rows.map((r) => r.category);
}

/**
 * Create a new product.
 * Runs inside a transaction provided by the caller.
 * @param {import("pg").PoolClient} client
 * @param {Object} data - validated product data
 * @param {number} userId
 * @returns {Promise<Object>} created product
 */
async function create(client, { userId, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url }) {
  const result = await client.query(
    `INSERT INTO products (
       user_id, name, sku, description, category,
       selling_price, cost_price, stock_quantity,
       low_stock_threshold, image_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING
       id, name, sku, description, category,
       selling_price, cost_price, stock_quantity,
       low_stock_threshold, image_url,
       created_at, updated_at`,
    [userId, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url]
  );
  return normalizeProduct(result.rows[0]);
}

/**
 * Update a product.
 * Only updates fields that are provided (not undefined).
 * stock_quantity is intentionally NOT updated here (use adjustStock).
 * @param {import("pg").PoolClient} client
 * @param {number} userId
 * @param {number} id
 * @param {Object} data - validated update data (only provided fields)
 * @returns {Promise<Object|null>} updated product or null if not found
 */
async function update(client, userId, id, data) {
  const fields = [];
  const params = [id, userId];
  let paramIndex = 3;

  const fieldMap = {
    name: "name",
    sku: "sku",
    description: "description",
    category: "category",
    selling_price: "selling_price",
    cost_price: "cost_price",
    low_stock_threshold: "low_stock_threshold",
    image_url: "image_url",
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = $${paramIndex}`);
      params.push(data[key]);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    // Nothing to update, but still verify the product exists
    return findById(userId, id, client);
  }

  fields.push("updated_at = now()");

  const sql = `
    UPDATE products
    SET ${fields.join(", ")}
    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
    RETURNING
      id, name, sku, description, category,
      selling_price, cost_price, stock_quantity,
      low_stock_threshold, image_url,
      created_at, updated_at
  `;

  const result = await client.query(sql, params);
  return normalizeProduct(result.rows[0] || null);
}

/**
 * Soft delete a product (set deleted_at).
 * @param {import("pg").PoolClient} client
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function softDelete(client, userId, id) {
  const result = await client.query(
    `UPDATE products
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return result.rowCount > 0;
}

/**
 * List low-stock products for a user.
 * Low stock = stock_quantity <= low_stock_threshold AND stock_quantity > 0
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function lowStockList(userId) {
  const result = await query(
    `SELECT
       id, name, sku, category,
       selling_price, cost_price, stock_quantity,
       low_stock_threshold, image_url,
       created_at, updated_at
     FROM products
     WHERE user_id = $1
       AND deleted_at IS NULL
       AND stock_quantity > 0
       AND stock_quantity <= low_stock_threshold
     ORDER BY stock_quantity ASC, name ASC`,
    [userId]
  );
  return result.rows.map(normalizeProduct);
}

module.exports = {
  list,
  findById,
  listCategories,
  create,
  update,
  softDelete,
  lowStockList,
};