// backend/src/repositories/expense.repository.js
// All SQL for the expenses table. Parameterized queries only.
// Every query is filtered by user_id so users only ever see their own expenses.
const { query } = require("../config/db");

// pg returns BIGINT (id) and NUMERIC (amount) as strings, and DATE as a JS
// Date object, so normalize them here so callers never deal with string
// ids/amounts or ISO datetime date strings.
function normalizeRow(row) {
  if (!row) return null;
  let expenseDate = row.expense_date;
  if (expenseDate instanceof Date) {
    // node-pg returns DATE as local midnight; use local components so the
    // calendar date round-trips correctly regardless of server timezone.
    const d = expenseDate;
    expenseDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } else if (typeof expenseDate === "string") {
    expenseDate = expenseDate.slice(0, 10);
  }
  return {
    ...row,
    id: row.id !== null && row.id !== undefined ? Number(row.id) : null,
    amount: row.amount !== null && row.amount !== undefined ? Number(row.amount) : null,
    expense_date: expenseDate,
  };
}

async function list(userId, { search, category, dateFrom, dateTo, page, limit, sort }) {
  const conditions = ["e.user_id = $1"];
  const params = [userId];
  let paramIndex = 2;

  if (search) {
    conditions.push(`(e.description ILIKE $${paramIndex} OR e.category ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (category) {
    conditions.push(`e.category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (dateFrom) {
    conditions.push(`e.expense_date >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`e.expense_date <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Count and total amount for the SAME filters (used by the summary strip).
  const countSql = `SELECT COUNT(*) AS cnt, COALESCE(SUM(e.amount), 0) AS total_amount FROM expenses e ${whereClause}`;
  const aggResult = await query(countSql, params);
  const count = parseInt(aggResult.rows[0].cnt, 10);
  const totalAmount = Number(aggResult.rows[0].total_amount);

  const sortWhitelist = { expense_date: "e.expense_date", amount: "e.amount", created_at: "e.created_at" };
  const [sortFieldRaw, sortDirRaw] = sort ? sort.split(":") : ["expense_date", "desc"];
  const safeSortField = sortWhitelist[sortFieldRaw] || "e.expense_date";
  const safeSortDir = sortDirRaw === "desc" ? "DESC" : "ASC";
  const orderBy = `${safeSortField} ${safeSortDir}`;

  const offset = (page - 1) * limit;
  const selectSql = `SELECT e.id, e.category, e.description, e.amount, TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date, e.notes, e.created_at, e.updated_at FROM expenses e ${whereClause} ORDER BY ${orderBy} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);
  const result = await query(selectSql, params);

  return {
    items: result.rows.map(normalizeRow),
    total: count,
    summary: { total_amount: totalAmount, count },
  };
}

async function findById(userId, id) {
  const sql = `SELECT e.id, e.category, e.description, e.amount, TO_CHAR(e.expense_date, 'YYYY-MM-DD') AS expense_date, e.notes, e.created_at, e.updated_at FROM expenses e WHERE e.id = $2 AND e.user_id = $1`;
  const result = await query(sql, [userId, id]);
  return normalizeRow(result.rows[0]) || null;
}

async function create(userId, data) {
  const sql = `INSERT INTO expenses (user_id, category, description, amount, expense_date, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, category, description, amount, expense_date, notes, created_at, updated_at`;
  const params = [userId, data.category, data.description, data.amount, data.expense_date, data.notes];
  const result = await query(sql, params);
  return normalizeRow(result.rows[0]);
}

async function update(userId, id, data) {
  const fields = [];
  const params = [userId, id];
  let idx = 3;
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); params.push(data.category); }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); params.push(data.description); }
  if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); params.push(data.amount); }
  if (data.expense_date !== undefined) { fields.push(`expense_date = $${idx++}`); params.push(data.expense_date); }
  if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); params.push(data.notes); }
  if (fields.length === 0) return findById(userId, id);
  const sql = `UPDATE expenses SET ${fields.join(", ")}, updated_at = now() WHERE user_id = $1 AND id = $2 RETURNING id`;
  const result = await query(sql, params);
  if (result.rows.length === 0) return null;
  return findById(userId, id);
}

async function remove(userId, id) {
  const sql = `DELETE FROM expenses WHERE user_id = $1 AND id = $2`;
  const params = [userId, id];
  const result = await query(sql, params);
  return result.rowCount > 0;
}

async function listCategories(userId) {
  const sql = `SELECT DISTINCT category FROM expenses WHERE user_id = $1 ORDER BY category`;
  const result = await query(sql, [userId]);
  return result.rows.map((row) => row.category);
}

module.exports = { list, findById, create, update, remove, listCategories };
