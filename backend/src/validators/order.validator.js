// backend/src/validators/order.validator.js
// Server-side validation for order input.
// All validation happens on the server; never trust client input.
// Never accepts user_id, prices, costs, totals, subtotal, stock or order_number
// from the client -- those are computed server-side.
const AppError = require("../utils/AppError");

const ORDER_STATUSES = ["Pending", "Confirmed", "Processing", "Completed", "Cancelled"];
const PAYMENT_STATUSES = ["Unpaid", "Partially Paid", "Paid"];

const ALLOWED_TRANSITIONS = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Completed", "Cancelled"],
  Processing: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const MAX_ORDER_ITEMS = 50;
const MAX_ITEM_QUANTITY = 100000;

// Money amounts are handled as integer cents to avoid float errors.
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Validate query parameters for order listing.
 * Returns sanitized query object.
 * @param {Object} query - raw req.query
 * @returns {{search: string|null, status: string|null, paymentStatus: string|null, dateFrom: string|null, dateTo: string|null, page: number, limit: number, sort: string}}
 */
function validateOrderListQuery(query) {
  const q = query || {};

  // search: optional, matches order_number or customer name
  const search =
    typeof q.search === "string" && q.search.trim().length > 0
      ? q.search.trim()
      : null;

  // status: optional, must be a valid order status
  const status = ORDER_STATUSES.includes(q.status) ? q.status : null;

  // payment_status: optional, must be a valid payment status
  const paymentStatus = PAYMENT_STATUSES.includes(q.payment_status)
    ? q.payment_status
    : null;

  // date_from / date_to: optional YYYY-MM-DD dates
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  let dateFrom = null;
  if (typeof q.date_from === "string" && DATE_REGEX.test(q.date_from)) {
    if (isNaN(new Date(`${q.date_from}T00:00:00`).getTime())) {
      dateFrom = null;
    } else {
      dateFrom = q.date_from;
    }
  }
  let dateTo = null;
  if (typeof q.date_to === "string" && DATE_REGEX.test(q.date_to)) {
    if (isNaN(new Date(`${q.date_to}T00:00:00`).getTime())) {
      dateTo = null;
    } else {
      dateTo = q.date_to;
    }
  }

  // page: integer >= 1, default 1
  const page = Math.max(1, parseInt(q.page, 10) || 1);

  // limit: integer 1-50, default 10
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 10));

  // sort: field:direction, whitelisted fields
  const sortWhitelist = ["order_date", "total", "order_number"];
  let sort = "order_date:desc";
  if (typeof q.sort === "string") {
    const parts = q.sort.split(":");
    if (
      parts.length === 2 &&
      sortWhitelist.includes(parts[0]) &&
      ["asc", "desc"].includes(parts[1])
    ) {
      sort = q.sort;
    }
  }

  return { search, status, paymentStatus, dateFrom, dateTo, page, limit, sort };
}

/**
 * Validate order creation input.
 * Throws AppError (400) with per-field "details.fields" on failure.
 * @param {Object} input - raw req.body
 * @returns {{customer_id: number|null, items: Array<{product_id: number, quantity: number}>, discount: number, notes: string|null}}
 */
function validateCreateOrder(input) {
  const fields = {};
  const data = input || {};

  // customer_id: optional, positive integer. Null/absent = walk-in order.
  let customerId = null;
  if (data.customer_id !== undefined && data.customer_id !== null) {
    const cid = Number(data.customer_id);
    if (!Number.isInteger(cid) || cid <= 0) {
      fields.customer_id = "Customer ID must be a positive integer.";
    } else {
      customerId = cid;
    }
  }

  // items: required, array with 1..50 lines
  let items = [];
  if (!Array.isArray(data.items)) {
    fields.items = "Items are required and must be an array.";
  } else if (data.items.length < 1 || data.items.length > MAX_ORDER_ITEMS) {
    fields.items = `Order must have between 1 and ${MAX_ORDER_ITEMS} item lines.`;
  } else {
    data.items.forEach((item, index) => {
      const prefix = `items[${index}]`;
      if (!item || typeof item !== "object") {
        fields[prefix] = "Item must be an object.";
        return;
      }
      const productId = Number(item.product_id);
      if (!Number.isInteger(productId) || productId <= 0) {
        fields[`${prefix}.product_id`] = "Product ID must be a positive integer.";
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_QUANTITY) {
        fields[`${prefix}.quantity`] = `Quantity must be an integer between 1 and ${MAX_ITEM_QUANTITY}.`;
      }
    });
    items = data.items;
  }

  // discount: optional number >= 0, max 2 decimals. Defaults to 0.
  // Checked against computed subtotal (subtotal = sum of line totals) in the service.
  let discount = 0;
  if (data.discount !== undefined && data.discount !== null) {
    const discountNum = Number(data.discount);
    if (isNaN(discountNum) || discountNum < 0 || !MONEY_REGEX.test(discountNum.toFixed(2))) {
      fields.discount = "Discount must be a number >= 0 with at most 2 decimal places.";
    } else {
      discount = discountNum;
    }
  }

  // notes: optional, max 1000 characters
  let notes = null;
  if (data.notes !== undefined && data.notes !== null) {
    if (typeof data.notes !== "string") {
      fields.notes = "Notes must be a string.";
    } else if (data.notes.length > 1000) {
      fields.notes = "Notes must be at most 1000 characters.";
    } else {
      notes = data.notes.trim() || null;
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return { customer_id: customerId, items, discount, notes };
}

/**
 * Validate status change input for PATCH /:id/status.
 * @param {Object} input - raw req.body
 * @returns {{status: string}}
 */
function validateUpdateStatus(input) {
  const fields = {};
  const data = input || {};

  if (!ORDER_STATUSES.includes(data.status)) {
    fields.status = `Status must be one of: ${ORDER_STATUSES.join(", ")}.`;
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return { status: data.status };
}

/**
 * Validate payment input for PATCH /:id/payment.
 * amount_paid <= total is checked in the service (total is server-known).
 * @param {Object} input - raw req.body
 * @returns {{amount_paid: number}}
 */
function validatePayment(input) {
  const fields = {};
  const data = input || {};

  if (data.amount_paid === undefined || data.amount_paid === null) {
    fields.amount_paid = "Amount paid is required.";
  } else {
    const amount = Number(data.amount_paid);
    if (isNaN(amount) || amount < 0 || !MONEY_REGEX.test(amount.toFixed(2))) {
      fields.amount_paid = "Amount paid must be a number >= 0 with at most 2 decimal places.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return { amount_paid: Number(data.amount_paid) };
}

module.exports = {
  validateOrderListQuery,
  validateCreateOrder,
  validateUpdateStatus,
  validatePayment,
  ORDER_STATUSES,
  ALLOWED_TRANSITIONS,
};
