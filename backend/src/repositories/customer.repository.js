// backend/src/repositories/customer.repository.js
// All SQL for the customers table. Parameterized queries only.
const { query } = require("../config/db");

async function list(userId, { search, page, limit, sort }) {
  const conditions = ["c.user_id = $1"];
  const params = [userId];
  let paramIndex = 2;

  if (search) {
    conditions.push(`(c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sortWhitelist = { name: "c.name", created_at: "c.created_at" };
  const [sortFieldRaw, sortDirRaw] = sort ? sort.split(":") : ["name", "asc"];
  const safeSortField = sortWhitelist[sortFieldRaw] || "c.name";
  const safeSortDir = sortDirRaw === "desc" ? "DESC" : "ASC";
  const orderBy = `${safeSortField} ${safeSortDir}`;

  const countSql = `SELECT COUNT(*) FROM customers c ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = (page - 1) * limit;
  const selectSql = `SELECT c.id, c.name, c.email, c.phone, c.address, c.notes, c.created_at, c.updated_at, COALESCE(o.order_count, 0) AS order_count, COALESCE(o.total_spent, 0) AS total_spent FROM customers c LEFT JOIN (SELECT customer_id, COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent FROM orders WHERE status = 'Completed' AND user_id = $1 GROUP BY customer_id) o ON o.customer_id = c.id ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  const result = await query(selectSql, params);

  return {
    items: result.rows.map((row) => ({
      ...row,
      order_count: Number(row.order_count),
      total_spent: Number(row.total_spent),
    })),
    total,
  };
}

async function findById(userId, id) {
  const sql = `SELECT c.id, c.name, c.email, c.phone, c.address, c.notes, c.created_at, c.updated_at, COALESCE(o.order_count, 0) AS order_count, COALESCE(o.total_spent, 0) AS total_spent FROM customers c LEFT JOIN (SELECT customer_id, COUNT(*) AS order_count, COALESCE(SUM(total), 0) AS total_spent FROM orders WHERE status = 'Completed' AND user_id = $1 GROUP BY customer_id) o ON o.customer_id = c.id WHERE c.id = $2 AND c.user_id = $1`;
  const params = [userId, id];
  const result = await query(sql, params);
  const row = result.rows[0] || null;
  if (!row) return null;
  return { ...row, order_count: Number(row.order_count), total_spent: Number(row.total_spent) };
}

async function create(userId, data) {
  const sql = `INSERT INTO customers (user_id, name, email, phone, address, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, address, notes, created_at, updated_at`;
  const params = [userId, data.name, data.email, data.phone, data.address, data.notes];
  const result = await query(sql, params);
  const row = result.rows[0];
  return { ...row, order_count: 0, total_spent: 0 };
}

async function update(userId, id, data) {
  const fields = [];
  const params = [userId, id];
  let idx = 3;
  if (data.name !== undefined) { fields.push(`name = $${idx++}`); params.push(data.name); }
  if (data.email !== undefined) { fields.push(`email = $${idx++}`); params.push(data.email); }
  if (data.phone !== undefined) { fields.push(`phone = $${idx++}`); params.push(data.phone); }
  if (data.address !== undefined) { fields.push(`address = $${idx++}`); params.push(data.address); }
  if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(data.notes); }
  if (fields.length === 0) return findById(userId, id);
  const sql = `UPDATE customers SET ${fields.join(", ")}, updated_at = now() WHERE user_id = $1 AND id = $2 RETURNING id`;
  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  return findById(userId, id);
}

async function remove(userId, id) {
  const sql = `DELETE FROM customers WHERE user_id = $1 AND id = $2`;
  const params = [userId, id];
  const result = await query(sql, params);
  return result.rowCount > 0;
}

async function listOrders(userId, customerId, page, limit) {
  const verifySql = `SELECT id FROM customers WHERE user_id = $1 AND id = $2`;
  const verifyRes = await query(verifySql, [userId, customerId]);
  if (verifyRes.rows.length === 0) return null;
  const offset = (page - 1) * limit;
  const countSql = `SELECT COUNT(*) FROM orders WHERE user_id = $1 AND customer_id = $2`;
  const countRes = await query(countSql, [userId, customerId]);
  const total = parseInt(countRes.rows[0].count, 10);
  const sql = `SELECT id, order_number, status, payment_status, total, order_date FROM orders WHERE user_id = $1 AND customer_id = $2 ORDER BY order_date DESC, id DESC LIMIT $3 OFFSET $4`;
  const result = await query(sql, [userId, customerId, limit, offset]);
  return { items: result.rows.map((row) => ({ ...row, total: Number(row.total) })), total };
}

module.exports = { list, findById, create, update, remove, listOrders };
