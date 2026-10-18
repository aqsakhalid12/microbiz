// backend/src/validators/report.validator.js
// Server-side validation for report query parameters.
// All validation happens on the server; never trust client input.
const AppError = require("../utils/AppError");

// Date format YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Maximum allowed range in days (inclusive of both endpoints).
const MAX_RANGE_DAYS = 366;

// Whitelisted grouping values for the sales-trend endpoint.
const GROUP_BY_WHITELIST = ["day", "week", "month"];

/**
 * Parse a YYYY-MM-DD string into a local Date at 00:00:00.
 * Returns null when the string is not a real calendar date.
 */
function parseDate(value) {
  if (typeof value !== "string" || !DATE_REGEX.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Format a local Date back to YYYY-MM-DD.
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Return the first day of the current month and today (both local).
 */
function defaultRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  return { date_from: formatDate(firstDay), date_to: formatDate(today) };
}

/**
 * Validate and normalise the date range for report endpoints.
 * Throws AppError(400) on any problem.
 *
 * @returns {{ date_from: string, date_to: string, rangeDays: number }}
 */
function validateDateRange(query) {
  const q = query || {};
  let dateFrom = typeof q.date_from === "string" ? q.date_from.trim() : "";
  let dateTo = typeof q.date_to === "string" ? q.date_to.trim() : "";

  const fields = {};

  // Defaults: current month when either side is missing.
  if (!dateFrom || !dateTo) {
    const def = defaultRange();
    if (!dateFrom) dateFrom = def.date_from;
    if (!dateTo) dateTo = def.date_to;
  }

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);

  if (!from) fields.date_from = "date_from must be a valid date (YYYY-MM-DD).";
  if (!to) fields.date_to = "date_to must be a valid date (YYYY-MM-DD).";

  if (from && to) {
    if (from > to) {
      fields.date_to = "date_to must be on or after date_from.";
    } else {
      const diffMs = to.getTime() - from.getTime();
      const rangeDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
      if (rangeDays > MAX_RANGE_DAYS) {
        fields.date_to = `Date range must be at most ${MAX_RANGE_DAYS} days.`;
      }
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return { date_from: dateFrom, date_to: dateTo };
}

/**
 * Validate the group_by parameter for the sales-trend endpoint.
 * Defaults to "day", auto-switches to "month" when the range exceeds
 * 120 days (so the client never receives hundreds of daily points).
 *
 * @param {{ date_from: string, date_to: string }} range
 * @param {string} [requestedGroupBy]
 * @returns {string}
 */
function validateGroupBy(range, requestedGroupBy) {
  if (requestedGroupBy !== undefined && requestedGroupBy !== null) {
    if (typeof requestedGroupBy !== "string" || !GROUP_BY_WHITELIST.includes(requestedGroupBy)) {
      throw new AppError("Validation failed", 400, {
        fields: { group_by: "group_by must be one of: day, week, month." },
      });
    }
    return requestedGroupBy;
  }

  const from = parseDate(range.date_from);
  const to = parseDate(range.date_to);
  const rangeDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  return rangeDays > 120 ? "month" : "day";
}

/**
 * Validate the limit parameter (used by top-products, low-stock and
 * recent-orders). Defaults to `def`, clamped to [1, max].
 *
 * @param {*} value
 * @param {number} def
 * @param {number} max
 * @returns {number}
 */
function validateLimit(value, def, max) {
  let n = def;
  if (value !== undefined && value !== null && value !== "") {
    n = parseInt(value, 10);
  }
  if (!Number.isInteger(n) || n < 1) n = def;
  if (n > max) n = max;
  return n;
}

module.exports = {
  validateDateRange,
  validateGroupBy,
  validateLimit,
};