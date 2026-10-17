// backend/src/routes/expense.routes.js
// Routes for expenses, mounted at /api/expenses.
const express = require("express");
const expenseController = require("../controllers/expense.controller");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// All expense routes require authentication
router.use(requireAuth);

// Fixed routes MUST come before /:id
router.get("/categories", expenseController.listExpenseCategories);

// Main expense listing and creation
router.get("/", expenseController.listExpenses);
router.post("/", expenseController.createExpense);

// Individual expense routes
router.get("/:id", expenseController.getExpense);
router.put("/:id", expenseController.updateExpense);
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;
