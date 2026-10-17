// backend/src/services/order.service.js
// Business logic for orders.
// All database operations run inside transactions where needed.
// Money is handled as integer cents internally to avoid float errors.
const { pool } = require("../config/db");
const orderRepository = require("../repositories/order.repository");
const AppError = require("../utils/AppError");
const {
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
} = require("../validators/order.validator");

// Convert a dollar amount (number or string) to integer cents.
function toCents(amount) {
  return Math.round(Number(amount) * 100);
}

// Convert integer cents to a 2-decimal string for NUMERIC columns.
function centsToMoney(cents) {
  return (cents / 100).toFixed(2);
}

/**
 * Create a new order.
 * ONE transaction:
 * - Generate order number ORD-YYYY-NNNN per user (retry once on 23505).
 * - Read selling_price/cost_price from products, snapshot into order_items.
 * - Merge duplicate product lines.
 * - subtotal = sum of line totals (cents). discount <= subtotal.
 * - total = subtotal - discount.
 * - Starts Pending, Unpaid, amount_paid 0, stock_deducted false.
 * - NO stock change. Reject if quantity exceeds current stock (validation only).
 * @param {number} userId - from session (server-trusted)
 * @param {Object} data - validated create data
 * @returns {Promise<Object>} created order with customer and items
 */
async function createOrder(userId, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // --- Resolve and validate products (must exist, belong to user, not soft-deleted) ---
    const productIds = data.items.map((item) => item.product_id);
    const productRows = await orderRepository.lockProductsForUpdate(
      client,
      userId,
      productIds
    );

    const productById = new Map();
    for (const row of productRows) {
      productById.set(Number(row.id), row);
    }

    // Merge duplicate product lines (sum quantities).
    const mergedItems = new Map();
    for (const item of data.items) {
      const pid = Number(item.product_id);
      const product = productById.get(pid);
      if (!product) {
        throw new AppError(`Product not found (invalid id: ${pid})`, 404);
      }
      if (product.deleted_at !== null) {
        throw new AppError(
          `Product "${product.name}" is soft-deleted and cannot be ordered.`,
          400
        );
      }
      if (!mergedItems.has(pid)) {
        mergedItems.set(pid, {
          product_id: pid,
          product_name: product.name,
          sku: product.sku,
          quantity: 0,
          unit_price: toCents(product.selling_price),
          unit_cost: toCents(product.cost_price),
        });
      }
      const merged = mergedItems.get(pid);
      merged.quantity += item.quantity;
    }

    // Validate stock (check only, no deduction yet).
    for (const merged of mergedItems.values()) {
      const product = productById.get(merged.product_id);
      if (merged.quantity > product.stock_quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name} (available: ${product.stock_quantity}).`,
          400
        );
      }
    }

    // Compute totals in cents.
    let subtotalCents = 0;
    const lineItems = [];
    for (const merged of mergedItems.values()) {
      const lineTotalCents = merged.unit_price * merged.quantity;
      subtotalCents += lineTotalCents;
      lineItems.push({
        ...merged,
        line_total: lineTotalCents,
      });
    }

    const discountCents = toCents(data.discount);
    if (discountCents < 0 || discountCents > subtotalCents) {
      throw new AppError(
        "Discount must be >= 0 and <= subtotal.",
        400
      );
    }
    const totalCents = subtotalCents - discountCents;

    // --- Generate order number ORD-YYYY-NNNN per user ---
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    const numResult = await client.query(
      `SELECT order_number FROM orders WHERE user_id = $1 AND order_number LIKE $2`,
      [userId, `${prefix}%`]
    );
    let seq = 1;
    for (const row of numResult.rows) {
      const match = String(row.order_number).match(/-(\d{4})$/);
      if (match) {
        seq = Math.max(seq, parseInt(match[1], 10) + 1);
      }
    }
    const orderNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    // --- Insert order ---
    const order = await orderRepository.createOrder(client, {
      userId,
      orderNumber,
      customerId: data.customer_id,
      subtotal: centsToMoney(subtotalCents),
      discount: centsToMoney(discountCents),
      total: centsToMoney(totalCents),
      notes: data.notes,
    });

    // --- Insert order items (snapshot) ---
    const createdItems = [];
    for (const item of lineItems) {
      createdItems.push(
        await orderRepository.createOrderItem(client, {
          orderId: order.id,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: centsToMoney(item.unit_price),
          unitCost: centsToMoney(item.unit_cost),
          lineTotal: centsToMoney(item.line_total),
        })
      );
    }

    await client.query("COMMIT");

    return {
      ...order,
      customer: data.customer_id
        ? { id: data.customer_id }
        : null,
      items: createdItems,
      item_count: createdItems.length,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    // Unique violation on order_number -> retry once.
    if (err.code === "23505" && !data.__retry) {
      return createOrder(userId, { ...data, __retry: true });
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get a single order with customer and items. 404 if not found or not owned.
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function getOrder(userId, id) {
  const order = await orderRepository.findOrderWithItems(userId, id);
  if (!order) {
    throw new AppError("Order not found", 404);
  }
  return order;
}

/**
 * List orders for a user with filtering, pagination, sorting.
 * @param {number} userId
 * @param {Object} options - validated query options
 * @returns {Promise<{items: Array, total: number}>}
 */
async function listOrders(userId, options) {
  return orderRepository.listOrders(userId, options);
}

/**
 * Replace items of a Pending order in one transaction; recalc totals.
 * amount_paid must still be <= new total.
 * @param {number} userId
 * @param {number} id
 * @param {Object} data - validated update data
 * @returns {Promise<Object>} updated order with items
 */
async function updateOrder(userId, id, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the order row for this user.
    const order = await orderRepository.findOrderForUpdate(client, userId, id);
    if (!order) {
      await client.query("ROLLBACK");
      throw new AppError("Order not found", 404);
    }

    if (order.status !== "Pending") {
      await client.query("ROLLBACK");
      throw new AppError("Only Pending orders can be edited.", 400);
    }

    // Resolve products (must exist, belong to user, not soft-deleted).
    const productIds = data.items.map((item) => item.product_id);
    const productRows = await orderRepository.lockProductsForUpdate(
      client,
      userId,
      productIds
    );
    const productById = new Map();
    for (const row of productRows) {
      productById.set(Number(row.id), row);
    }

    // Merge duplicate product lines.
    const mergedItems = new Map();
    for (const item of data.items) {
      const pid = Number(item.product_id);
      const product = productById.get(pid);
      if (!product) {
        await client.query("ROLLBACK");
        throw new AppError(`Product not found (invalid id: ${pid})`, 404);
      }
      if (product.deleted_at !== null) {
        await client.query("ROLLBACK");
        throw new AppError(
          `Product "${product.name}" is soft-deleted and cannot be ordered.`,
          400
        );
      }
      if (!mergedItems.has(pid)) {
        mergedItems.set(pid, {
          product_id: pid,
          product_name: product.name,
          sku: product.sku,
          quantity: 0,
          unit_price: toCents(product.selling_price),
          unit_cost: toCents(product.cost_price),
        });
      }
      mergedItems.get(pid).quantity += item.quantity;
    }

    // Stock check (validation only, no deduction for Pending orders).
    for (const merged of mergedItems.values()) {
      const product = productById.get(merged.product_id);
      if (merged.quantity > product.stock_quantity) {
        await client.query("ROLLBACK");
        throw new AppError(
          `Insufficient stock for ${product.name} (available: ${product.stock_quantity}).`,
          400
        );
      }
    }

    // Recalc totals in cents.
    let subtotalCents = 0;
    const lineItems = [];
    for (const merged of mergedItems.values()) {
      const lineTotalCents = merged.unit_price * merged.quantity;
      subtotalCents += lineTotalCents;
      lineItems.push({
        ...merged,
        line_total: lineTotalCents,
      });
    }

    const discountCents = toCents(data.discount);
    if (discountCents < 0 || discountCents > subtotalCents) {
      await client.query("ROLLBACK");
      throw new AppError(
        "Discount must be >= 0 and <= subtotal.",
        400
      );
    }
    const totalCents = subtotalCents - discountCents;

    // amount_paid must still be <= new total.
    if (toCents(order.amount_paid) > totalCents) {
      await client.query("ROLLBACK");
      throw new AppError(
        "Amount paid cannot exceed the new order total.",
        400
      );
    }

    // Replace items.
    await orderRepository.replaceOrderItems(client, order.id, lineItems);

    // Update scalar columns.
    const updated = await orderRepository.updateOrderColumns(client, order.id, {
      customer_id: data.customer_id,
      subtotal: centsToMoney(subtotalCents),
      discount: centsToMoney(discountCents),
      total: centsToMoney(totalCents),
    });

    await client.query("COMMIT");

    // Fetch full order with items to return.
    return getOrder(userId, id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transition an order status. All transitions run inside a transaction
 * with SELECT ... FOR UPDATE on the order row.
 * @param {number} userId
 * @param {number} id
 * @param {string} newStatus
 * @returns {Promise<Object>} updated order
 */
async function updateOrderStatus(userId, id, newStatus) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the order row for this user.
    const order = await orderRepository.findOrderForUpdate(client, userId, id);
    if (!order) {
      await client.query("ROLLBACK");
      throw new AppError("Order not found", 404);
    }

    const currentStatus = order.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      await client.query("ROLLBACK");
      throw new AppError(
        `Cannot transition from ${currentStatus} to ${newStatus}.`,
        400
      );
    }

    const updates = { status: newStatus };
    if (newStatus === "Completed") {
      updates.completed_at = "now()";
    }

    // Pending -> Confirmed: deduct stock.
    if (currentStatus === "Pending" && newStatus === "Confirmed") {
      await confirmOrderAndDeductStock(client, order);
      updates.stock_deducted = true;
    }

    // Any -> Cancelled: restore stock if previously deducted.
    if (newStatus === "Cancelled" && order.stock_deducted) {
      await restoreStockOnCancel(client, order);
      updates.stock_deducted = false;
    }

    const updated = await orderRepository.updateOrderColumns(
      client,
      order.id,
      updates
    );

    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Pending -> Confirmed: lock product rows FOR UPDATE ordered by product_id,
 * verify stock for all items, deduct, insert 'sale' movements, set stock_deducted.
 * Runs inside the caller's transaction (order row already locked).
 * @param {import("pg").PoolClient} client
 * @param {Object} order - locked order row
 */
async function confirmOrderAndDeductStock(client, order) {
  // Fetch order items.
  const itemsResult = await client.query(
    `SELECT id, product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY id`,
    [order.id]
  );
  const items = itemsResult.rows;

  if (items.length === 0) {
    throw new AppError("Cannot confirm an order with no items.", 400);
  }

  // Lock product rows FOR UPDATE ordered by product_id (deadlock prevention).
  const productIds = items.map((item) => item.product_id);
  const locked = await orderRepository.lockProductsForUpdate(
    client,
    order.user_id,
    productIds
  );
  const productById = new Map();
  for (const row of locked) {
    productById.set(Number(row.id), row);
  }

  // Verify stock for all items before deducting anything.
  for (const item of items) {
    const product = productById.get(Number(item.product_id));
    if (!product) {
      throw new AppError(`Product not found (invalid id: ${item.product_id})`, 404);
    }
    if (product.deleted_at !== null) {
      throw new AppError(
        `Product "${product.name}" is soft-deleted and cannot be ordered.`,
        400
      );
    }
    if (item.quantity > product.stock_quantity) {
      throw new AppError(
        `Insufficient stock for ${product.name}.`,
        400
      );
    }
  }

  // Deduct stock and insert 'sale' movements.
  for (const item of items) {
    const product = productById.get(Number(item.product_id));
    const newStock = product.stock_quantity - item.quantity;

    await orderRepository.updateProductStock(client, product.id, newStock);

    await client.query(
      `INSERT INTO inventory_movements (
         user_id, product_id, order_id, movement_type,
         quantity_change, stock_after, reason
       )
       VALUES ($1, $2, $3, 'sale', $4, $5, $6)`,
      [
        order.user_id,
        product.id,
        order.id,
        -item.quantity,
        newStock,
        `Order ${order.order_number}`,
      ]
    );
  }
}

/**
 * Cancel: if stock_deducted, restore stock per item with FOR UPDATE,
 * insert 'cancellation_restore' movements (positive), set stock_deducted = false.
 * Cancelling twice never restores twice (stock_deducted guard).
 * @param {import("pg").PoolClient} client
 * @param {Object} order - locked order row
 */
async function restoreStockOnCancel(client, order) {
  const itemsResult = await client.query(
    `SELECT id, product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY id`,
    [order.id]
  );
  const items = itemsResult.rows;

  const productIds = items.map((item) => item.product_id);
  const locked = await orderRepository.lockProductsForUpdate(
    client,
    order.user_id,
    productIds
  );
  const productById = new Map();
  for (const row of locked) {
    productById.set(Number(row.id), row);
  }

  for (const item of items) {
    const product = productById.get(Number(item.product_id));
    if (!product) continue;
    const newStock = product.stock_quantity + item.quantity;

    await orderRepository.updateProductStock(client, product.id, newStock);

    await client.query(
      `INSERT INTO inventory_movements (
         user_id, product_id, order_id, movement_type,
         quantity_change, stock_after, reason
       )
       VALUES ($1, $2, $3, 'cancellation_restore', $4, $5, $6)`,
      [
        order.user_id,
        product.id,
        order.id,
        item.quantity,
        newStock,
        `Cancelled ${order.order_number}`,
      ]
    );
  }
}

/**
 * Record a payment. amount_paid 0..total, 2 decimals.
 * Server derives payment_status (0 Unpaid, < total Partially Paid, = total Paid).
 * Not allowed on Cancelled orders.
 * @param {number} userId
 * @param {number} id
 * @param {number} amountPaid
 * @returns {Promise<Object>} updated order
 */
async function recordPayment(userId, id, amountPaid) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const order = await orderRepository.findOrderForUpdate(client, userId, id);
    if (!order) {
      await client.query("ROLLBACK");
      throw new AppError("Order not found", 404);
    }

    if (order.status === "Cancelled") {
      await client.query("ROLLBACK");
      throw new AppError("Cannot record a payment on a cancelled order.", 400);
    }

    const amountPaidCents = toCents(amountPaid);
    const totalCents = toCents(order.total);

    if (amountPaidCents < 0 || amountPaidCents > totalCents) {
      await client.query("ROLLBACK");
      throw new AppError(
        "Amount paid must be between 0 and the order total.",
        400
      );
    }

    let paymentStatus;
    if (amountPaidCents === 0) {
      paymentStatus = "Unpaid";
    } else if (amountPaidCents < totalCents) {
      paymentStatus = "Partially Paid";
    } else {
      paymentStatus = "Paid";
    }

    const updated = await orderRepository.updateOrderColumns(client, order.id, {
      amount_paid: centsToMoney(amountPaidCents),
      payment_status: paymentStatus,
    });

    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  createOrder,
  getOrder,
  listOrders,
  updateOrder,
  updateOrderStatus,
  recordPayment,
};
