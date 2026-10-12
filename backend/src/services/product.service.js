// backend/src/services/product.service.js
// Business logic for products and inventory.
// All database operations run inside transactions where needed.
const { pool } = require("../config/db");
const productRepository = require("../repositories/product.repository");
const inventoryRepository = require("../repositories/inventory.repository");
const AppError = require("../utils/AppError");

/**
 * Get default low stock threshold from user's business settings.
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function getDefaultLowStockThreshold(userId) {
  const result = await pool.query(
    `SELECT default_low_stock_threshold FROM business_settings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.default_low_stock_threshold ?? 5;
}

/**
 * Create a new product.
 * ONE transaction: insert product; if stock_quantity > 0 insert an 'initial_stock' movement.
 * @param {number} userId
 * @param {Object} data - validated product data from validator
 * @returns {Promise<Object>} created product
 */
async function createProduct(userId, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get default low stock threshold
    const defaultThreshold = await getDefaultLowStockThreshold(userId);
    const lowStockThreshold = data.low_stock_threshold ?? defaultThreshold;

    const product = await productRepository.create(client, {
      userId,
      name: data.name,
      sku: data.sku,
      description: data.description,
      category: data.category,
      selling_price: data.selling_price,
      cost_price: data.cost_price,
      stock_quantity: data.stock_quantity,
      low_stock_threshold: lowStockThreshold,
      image_url: data.image_url,
    });

    // If initial stock > 0, create initial_stock movement
    if (data.stock_quantity > 0) {
      await inventoryRepository.insertMovement(client, {
        userId,
        productId: product.id,
        orderId: null,
        movement_type: "initial_stock",
        quantity_change: data.stock_quantity,
        stock_after: data.stock_quantity,
        reason: "Initial stock on product creation",
      });
    }

    await client.query("COMMIT");
    return product;
  } catch (err) {
    await client.query("ROLLBACK");
    // Duplicate SKU (unique violation on partial index)
    if (err.code === "23505") {
      throw new AppError("SKU already exists", 409);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update a product.
 * Updates all fields EXCEPT stock_quantity (ignored/rejected with clear message).
 * @param {number} userId
 * @param {number} id
 * @param {Object} data - validated update data
 * @returns {Promise<Object>} updated product
 */
async function updateProduct(userId, id, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const product = await productRepository.update(client, userId, id, data);

    if (!product) {
      await client.query("ROLLBACK");
      throw new AppError("Product not found", 404);
    }

    await client.query("COMMIT");
    return product;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw new AppError("SKU already exists", 409);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Soft delete a product (set deleted_at).
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<void>}
 */
async function deleteProduct(userId, id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deleted = await productRepository.softDelete(client, userId, id);

    if (!deleted) {
      await client.query("ROLLBACK");
      throw new AppError("Product not found", 404);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Adjust stock for a product.
 * ONE transaction:
 * - SELECT ... FOR UPDATE on the product row scoped by user_id
 * - Compute new stock on the server
 * - Reject if result would be negative (400 "Insufficient stock")
 * - Update stock_quantity
 * - Insert movement (quantity_change, stock_after, reason)
 * Movement types: 'purchase' (positive) or 'adjustment' (positive or negative)
 * @param {number} userId
 * @param {number} id
 * @param {Object} data - validated adjustment data { movement_type, quantity_change, reason }
 * @returns {Promise<Object>} updated product with new stock
 */
async function adjustStock(userId, id, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the product row for this user
    const lockResult = await client.query(
      `SELECT id, stock_quantity, low_stock_threshold
       FROM products
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       FOR UPDATE`,
      [id, userId]
    );

    if (lockResult.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new AppError("Product not found", 404);
    }

    const currentStock = lockResult.rows[0].stock_quantity;
    const quantityChange = data.quantity_change;
    const newStock = currentStock + quantityChange;

    if (newStock < 0) {
      await client.query("ROLLBACK");
      throw new AppError("Insufficient stock", 400);
    }

    // Update stock_quantity
    const updateResult = await client.query(
      `UPDATE products
       SET stock_quantity = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING
         id, name, sku, description, category,
         selling_price, cost_price, stock_quantity,
         low_stock_threshold, image_url,
         created_at, updated_at`,
      [newStock, id, userId]
    );

    const updatedProduct = updateResult.rows[0];

     // Insert movement record
    await inventoryRepository.insertMovement(client, {
      userId,
      productId: id,
      orderId: null,
      movement_type: data.movement_type,
      quantity_change: quantityChange,
      stock_after: newStock,
      reason: data.reason,
    });

    await client.query("COMMIT");

    // Normalize numeric fields to JS numbers
    return {
      ...updatedProduct,
      selling_price: Number(updatedProduct.selling_price),
      cost_price: Number(updatedProduct.cost_price),
      stock_quantity: Number(updatedProduct.stock_quantity),
      low_stock_threshold: Number(updatedProduct.low_stock_threshold),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * List products with filtering, pagination, sorting.
 * @param {number} userId
 * @param {Object} query - validated query params
 * @returns {Promise<{items: Array, total: number}>}
 */
async function listProducts(userId, query) {
  return productRepository.list(userId, query);
}

/**
 * Get a single product by id.
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getProduct(userId, id) {
  return productRepository.findById(userId, id);
}

/**
 * List categories for a user.
 * @param {number} userId
 * @returns {Promise<string[]>}
 */
async function getCategories(userId) {
  return productRepository.listCategories(userId);
}

/**
 * List low-stock products for a user.
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function getLowStockProducts(userId) {
  return productRepository.lowStockList(userId);
}

/**
 * List inventory movements for a specific product.
 * @param {number} userId
 * @param {number} productId
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<{items: Array, total: number}>}
 */
async function getProductMovements(userId, productId, page, limit) {
  // Verify product exists and belongs to user (not soft-deleted)
  const product = await productRepository.findById(userId, productId);
  if (!product) {
    throw new AppError("Product not found", 404);
  }
  return inventoryRepository.listByProduct(userId, productId, page, limit);
}

/**
 * List all inventory movements for a user (with filters).
 * @param {number} userId
 * @param {Object} options
 * @returns {Promise<{items: Array, total: number}>}
 */
async function getAllMovements(userId, options) {
  return inventoryRepository.listAll(userId, options);
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  listProducts,
  getProduct,
  getCategories,
  getLowStockProducts,
  getProductMovements,
  getAllMovements,
};