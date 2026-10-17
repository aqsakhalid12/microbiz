// backend/src/validators/expense.validator.js
// Server-side validation for expense input.
// All validation happens on the server; never trust client input.
const AppError = require("../utils/AppError");

// Date format YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Amount: positive number, max 2 decimals, max 9999999999.99
const MAX_AMOUNT = 9999999999.99;

/**
 * Amount validation error message or null.
 * Required only when `required` is true.
 */
function amountError(value, required) {
  if (value === undefined || value === null || value === "") {
    return required ? "Amount is required." : null;
  }
  const amount = Number(value);
  if (isNaN(amount) || amount <= 0) {
    return "Amount must be a number greater than 0.";
  }
  if (amount > MAX_AMOUNT) {
    return "Amount must be <= 9999999999.99.";
  }
  const decPart = String(amount).split(".")[1];
  if (decPart && decPart.length > 2) {
    return "Amount must have at most 2 decimal places.";
  }
  return null;
}

/**
 * Expense date validation error message or null.
 * Required only when `required` is true.
 */
function dateError(value, required) {
  if (value === undefined || value === null || value === "") {
    return required ? "Expense date is required (YYYY-MM-DD)." : null;
  }
  const s = String(value);
  if (!DATE_REGEX.test(s)) {
    return "Expense date must be a valid date (YYYY-MM-DD).";
  }
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
    return "Expense date must be a valid date (YYYY-MM-DD).";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return "Expense date cannot be in the future.";
  }
  return null;
}

/**
 * Validate expense creation input.
 * Throws an AppError (400) with per-field "details.fields" object.
 * @returns {{category: string, description: string|null, amount: number, expense_date: string, notes: string|null}}
 */
function validateCreateExpense(input) {
  const fields = {};
  const data = input || {};

  if (
    typeof data.category !== "string" ||
    data.category.trim().length < 1 ||
    data.category.trim().length > 80
  ) {
    fields.category = "Category is required (1-80 characters).";
  }

  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string") {
      fields.description = "Description must be a string.";
    } else if (data.description.length > 255) {
      fields.description = "Description must be at most 255 characters.";
    }
  }

  const amountErr = amountError(data.amount, true);
  if (amountErr) fields.amount = amountErr;

  const dateErr = dateError(data.expense_date, true);
  if (dateErr) fields.expense_date = dateErr;

  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== "string") {
      fields.notes = "Notes must be a string.";
    } else if (data.notes.length > 2000) {
      fields.notes = "Notes must be at most 2000 characters.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return {
    category: data.category.trim(),
    description:
      typeof data.description === "string" && data.description.trim().length > 0
        ? data.description.trim()
        : null,
    amount: Number(data.amount),
    expense_date: String(data.expense_date),
    notes:
      typeof data.notes === "string" && data.notes.trim().length > 0
        ? data.notes.trim()
        : null,
  };
}

/**
 * Validate expense update input.
 * All fields optional; at least one must be provided.
 * @returns {object} validated data with only provided fields
 */
function validateUpdateExpense(input) {
  const fields = {};
  const data = input || {};

  const allowedFields = ["category", "description", "amount", "expense_date", "notes"];
  const providedFields = allowedFields.filter((f) => data[f] !== undefined);
  if (providedFields.length === 0) {
    fields._general = "At least one field must be provided for update.";
  }

  if (data.category !== undefined) {
    if (
      typeof data.category !== "string" ||
      data.category.trim().length < 1 ||
      data.category.trim().length > 80
    ) {
      fields.category = "Category must be 1-80 characters.";
    }
  }

  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string") {
      fields.description = "Description must be a string or null.";
    } else if (data.description.length > 255) {
      fields.description = "Description must be at most 255 characters.";
    }
  }

  if (data.amount !== undefined) {
    const err = amountError(data.amount, false);
    if (err) fields.amount = err;
  }

  if (data.expense_date !== undefined) {
    const err = dateError(data.expense_date, false);
    if (err) fields.expense_date = err;
  }

  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== "string") {
      fields.notes = "Notes must be a string or null.";
    } else if (data.notes.length > 2000) {
      fields.notes = "Notes must be at most 2000 characters.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  const result = {};
  if (data.category !== undefined) result.category = data.category.trim();
  if (data.description !== undefined) {
    result.description =
      typeof data.description === "string" && data.description.trim().length > 0
        ? data.description.trim()
        : null;
  }
  if (data.amount !== undefined) result.amount = Number(data.amount);
  if (data.expense_date !== undefined) result.expense_date = String(data.expense_date);
  if (data.notes !== undefined) {
    result.notes =
      typeof data.notes === "string" && data.notes.trim().length > 0
        ? data.notes.trim()
        : null;
  }
  return result;
}

/**
 * Validate query parameters for expense listing.
 * Returns sanitized query object.
 */
function validateExpenseListQuery(query) {
  const q = query || {};
  const search = typeof q.search === "string" ? q.search.trim() : "";
  const category = typeof q.category === "string" ? q.category.trim() : "";
  let dateFrom = "";
  let dateTo = "";
  if (typeof q.date_from === "string" && DATE_REGEX.test(q.date_from)) dateFrom = q.date_from;
  if (typeof q.date_to === "string" && DATE_REGEX.test(q.date_to)) dateTo = q.date_to;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 10));
  const sortWhitelist = ["expense_date", "amount", "created_at"];
  let sort = "expense_date:desc";
  if (typeof q.sort === "string") {
    const parts = q.sort.split(":");
    if (parts.length === 2 && sortWhitelist.includes(parts[0]) && ["asc", "desc"].includes(parts[1])) {
      sort = q.sort;
    }
  }
  return { search, category, dateFrom, dateTo, page, limit, sort };
}

module.exports = {
  validateCreateExpense,
  validateUpdateExpense,
  validateExpenseListQuery,
};
