// backend/src/repositories/settings.repository.js
// All SQL for business_settings. One row per user (user_id UNIQUE).
const { query } = require("../config/db");

function normalizeRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id !== null && row.id !== undefined ? Number(row.id) : null,
    user_id: row.user_id !== null && row.user_id !== undefined ? Number(row.user_id) : null,
    default_low_stock_threshold: row.default_low_stock_threshold !== null && row.default_low_stock_threshold !== undefined
      ? Number(row.default_low_stock_threshold)
      : null,
  };
}

async function findByUserId(userId) {
  const sql = `SELECT id, user_id, business_name, email, phone, address, currency_code, default_low_stock_threshold, created_at, updated_at
               FROM business_settings
               WHERE user_id = $1`;
  const result = await query(sql, [userId]);
  return normalizeRow(result.rows[0]) || null;
}

async function create(userId, data) {
  const sql = `INSERT INTO business_settings (user_id, business_name, email, phone, address, currency_code, default_low_stock_threshold)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id, user_id, business_name, email, phone, address, currency_code, default_low_stock_threshold, created_at, updated_at`;
  const params = [
    userId,
    data.business_name,
    data.email,
    data.phone,
    data.address,
    data.currency_code,
    data.default_low_stock_threshold,
  ];
  const result = await query(sql, params);
  return normalizeRow(result.rows[0]);
}

async function update(userId, data) {
  const fields = [];
  const params = [userId];
  let idx = 2;

  if (data.business_name !== undefined) { fields.push(`business_name = $${idx++}`); params.push(data.business_name); }
  if (data.email !== undefined) { fields.push(`email = $${idx++}`); params.push(data.email); }
  if (data.phone !== undefined) { fields.push(`phone = $${idx++}`); params.push(data.phone); }
  if (data.address !== undefined) { fields.push(`address = $${idx++}`); params.push(data.address); }
  if (data.currency_code !== undefined) { fields.push(`currency_code = $${idx++}`); params.push(data.currency_code); }
  if (data.default_low_stock_threshold !== undefined) { fields.push(`default_low_stock_threshold = $${idx++}`); params.push(data.default_low_stock_threshold); }

  if (fields.length === 0) return findByUserId(userId);

  const sql = `UPDATE business_settings
               SET ${fields.join(", ")}, updated_at = now()
               WHERE user_id = $1
               RETURNING id`;
  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  return findByUserId(userId);
}

async function upsert(userId, data) {
  // Try update first; if no row, create (upsert by user_id)
  const updated = await update(userId, data);
  if (updated) return updated;
  return create(userId, data);
}

module.exports = {
  findByUserId,
  create,
  update,
  upsert,
};