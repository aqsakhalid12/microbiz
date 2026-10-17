// backend/src/services/expense.service.js
// Business logic for expenses.
const { pool } = require("../config/db");
const expenseRepository = require("../repositories/expense.repository");
const AppError = require("../utils/AppError");

async function listExpenses(userId, { search, category, dateFrom, dateTo, page, limit, sort }) {
  const result = await expenseRepository.list(userId, { search, category, dateFrom, dateTo, page, limit, sort });

  // Business currency (used by the frontend for formatting amounts).
  const currencyRes = await pool.query("SELECT currency_code FROM business_settings WHERE user_id = $1", [userId]);
  const currencyCode = currencyRes.rows[0]?.currency_code || "USD";

  return { ...result, currencyCode };
}

async function getExpense(userId, id) {
  const expense = await expenseRepository.findById(userId, id);
  if (!expense) {
    throw new AppError("Expense not found", 404);
  }
  return expense;
}

async function createExpense(userId, data) {
  return expenseRepository.create(userId, data);
}

async function updateExpense(userId, id, data) {
  const expense = await expenseRepository.update(userId, id, data);
  if (!expense) {
    throw new AppError("Expense not found", 404);
  }
  return expense;
}

async function deleteExpense(userId, id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deleted = await expenseRepository.remove(userId, id);
    if (!deleted) {
      await client.query("ROLLBACK");
      throw new AppError("Expense not found", 404);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listExpenseCategories(userId) {
  return expenseRepository.listCategories(userId);
}

module.exports = {
  createExpense,
  updateExpense,
  getExpense,
  deleteExpense,
  listExpenses,
  listExpenseCategories,
};
