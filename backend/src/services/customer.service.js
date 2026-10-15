// backend/src/services/customer.service.js
// Business logic for customers.
const { pool } = require("../config/db");
const customerRepository = require("../repositories/customer.repository");
const AppError = require("../utils/AppError");

async function listCustomers(userId, { search, page, limit, sort }) {
  // normalize pagination
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  return customerRepository.list(userId, { search, page: p, limit: l, sort });
}

async function getCustomer(userId, id) {
  const customer = await customerRepository.findById(userId, id);
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }
  return customer;
}

async function createCustomer(userId, data) {
  return customerRepository.create(userId, data);
}

async function updateCustomer(userId, id, data) {
  const customer = await customerRepository.update(userId, id, data);
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }
  return customer;
}

async function deleteCustomer(userId, id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check if customer has any orders (any order linked to this customer, regardless of status)
    const checkOrdersSql = "SELECT COUNT(*) AS cnt FROM orders WHERE customer_id = $1 AND user_id = $2";
    const orderCount = parseInt(ordersRes.rows[0].cnt, 10);
    if (orderCount > 0) {
      await client.query("ROLLBACK");
      throw new AppError("Customer has orders and cannot be deleted", 409);
    }

    const deleted = await customerRepository.remove(userId, id);
    if (!deleted) {
      await client.query("ROLLBACK");
      throw new AppError("Customer not found", 404);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23503") {
      // FK violation - likely has orders or references
      throw new AppError("Customer has orders and cannot be deleted", 409);
    }
    throw err;
  } finally {
    client.release();
  }
}

async function getCustomerOrders(userId, customerId, { page, limit }) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const result = await customerRepository.listOrders(userId, customerId, p, l);
  if (result === null) {
    throw new AppError("Customer not found", 404);
  }
  return result;
}

module.exports = {
  createCustomer,
  updateCustomer,
  getCustomer,
  deleteCustomer,
  listCustomers,
  getCustomerOrders,
};
