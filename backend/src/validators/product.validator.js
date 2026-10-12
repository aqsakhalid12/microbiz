// backend/src/validators/product.validator.js
// Server-side validation for product input and stock adjustments.
// All validation happens on the server; the frontend may validate too,
// but the server never trusts client input.
const AppError = require("../utils/AppError");

// URL regex for image_url validation (http/https only)
const URL_REGEX = /^https?:\/\/.+/i;

/**
 * Validate product creation input.
 * Throws an AppError (400) with per-field "details.fields" object
 * when anything is invalid, so the frontend can show field errors.
 *
 * @returns {{
 *   name: string,
 *   sku: string|null,
 *   description: string,
 *   category: string|null,
 *   selling_price: number,
 *   cost_price: number,
 *   stock_quantity: number,
 *   low_stock_threshold: number,
 *   image_url: string|null
 * }}
 */
function validateCreateProduct(input, defaultLowStockThreshold = 5) {
  const fields = {};
  const data = input || {};

  // name: required, 1-150 characters
  if (
    typeof data.name !== "string" ||
    data.name.trim().length < 1 ||
    data.name.trim().length > 150
  ) {
    fields.name = "Product name is required (1-150 characters).";
  }

  // sku: optional, max 64, trimmed, empty string becomes null
  if (data.sku !== undefined && data.sku !== null) {
    if (typeof data.sku !== "string") {
      fields.sku = "SKU must be a string.";
    } else {
      const trimmed = data.sku.trim();
      if (trimmed.length > 64) {
        fields.sku = "SKU must be at most 64 characters.";
      }
    }
  }

  // description: optional, max 2000
  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== "string") {
      fields.description = "Description must be a string.";
    } else if (data.description.length > 2000) {
      fields.description = "Description must be at most 2000 characters.";
    }
  }

  // category: optional, max 80
  if (data.category !== undefined && data.category !== null) {
    if (typeof data.category !== "string") {
      fields.category = "Category must be a string.";
    } else if (data.category.trim().length > 80) {
      fields.category = "Category must be at most 80 characters.";
    }
  }

  // selling_price: required, number >= 0, max 2 decimals, max 9999999999.99
  if (data.selling_price === undefined || data.selling_price === null) {
    fields.selling_price = "Selling price is required.";
  } else {
    const price = Number(data.selling_price);
    if (isNaN(price) || price < 0) {
      fields.selling_price = "Selling price must be a number >= 0.";
    } else if (!/^\d+(\.\d{1,2})?$/.test(price.toFixed(2)) || price > 9999999999.99) {
      fields.selling_price = "Selling price must have at most 2 decimal places and be <= 9999999999.99.";
    }
  }

  // cost_price: required, number >= 0, max 2 decimals, max 9999999999.99
  if (data.cost_price === undefined || data.cost_price === null) {
    fields.cost_price = "Cost price is required.";
  } else {
    const price = Number(data.cost_price);
    if (isNaN(price) || price < 0) {
      fields.cost_price = "Cost price must be a number >= 0.";
    } else if (!/^\d+(\.\d{1,2})?$/.test(price.toFixed(2)) || price > 9999999999.99) {
      fields.cost_price = "Cost price must have at most 2 decimal places and be <= 9999999999.99.";
    }
  }

  // stock_quantity: integer >= 0, only used on create
  if (data.stock_quantity !== undefined && data.stock_quantity !== null) {
    const qty = Number(data.stock_quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      fields.stock_quantity = "Initial stock must be an integer >= 0.";
    }
  }

  // low_stock_threshold: integer >= 0, default from business_settings
  if (data.low_stock_threshold !== undefined && data.low_stock_threshold !== null) {
    const threshold = Number(data.low_stock_threshold);
    if (!Number.isInteger(threshold) || threshold < 0) {
      fields.low_stock_threshold = "Low stock threshold must be an integer >= 0.";
    }
  }

  // image_url: optional, must be http/https URL, max 500
  if (data.image_url !== undefined && data.image_url !== null && data.image_url !== "") {
    if (typeof data.image_url !== "string") {
      fields.image_url = "Image URL must be a string.";
    } else if (data.image_url.length > 500) {
      fields.image_url = "Image URL must be at most 500 characters.";
    } else if (!URL_REGEX.test(data.image_url)) {
      fields.image_url = "Image URL must be a valid http/https URL.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return {
    name: data.name.trim(),
    sku: typeof data.sku === "string" && data.sku.trim().length > 0 ? data.sku.trim() : null,
    description: typeof data.description === "string" ? data.description : "",
    category: typeof data.category === "string" && data.category.trim().length > 0 ? data.category.trim() : null,
    selling_price: Number(data.selling_price),
    cost_price: Number(data.cost_price),
    stock_quantity: data.stock_quantity !== undefined && data.stock_quantity !== null ? Number(data.stock_quantity) : 0,
    low_stock_threshold: data.low_stock_threshold !== undefined && data.low_stock_threshold !== null ? Number(data.low_stock_threshold) : defaultLowStockThreshold,
    image_url: typeof data.image_url === "string" && data.image_url.trim().length > 0 ? data.image_url.trim() : null,
  };
}

/**
 * Validate product update input.
 * Same rules as create, but all fields are optional (except at least one must be provided).
 * stock_quantity is NOT allowed (stock changes use stock adjustments).
 *
 * @returns {object} validated data with only provided fields
 */
function validateUpdateProduct(input) {
  const fields = {};
  const data = input || {};

  // At least one field must be provided
  const allowedFields = ["name", "sku", "description", "category", "selling_price", "cost_price", "low_stock_threshold", "image_url"];
  const providedFields = allowedFields.filter((f) => data[f] !== undefined);
  if (providedFields.length === 0) {
    fields._general = "At least one field must be provided for update.";
  }

  // Reject stock_quantity explicitly with a clear message
  if (data.stock_quantity !== undefined) {
    fields.stock_quantity = "Stock quantity cannot be updated directly. Use the stock adjustment endpoint.";
  }

  // name: 1-150 characters
  if (data.name !== undefined) {
    if (
      typeof data.name !== "string" ||
      data.name.trim().length < 1 ||
      data.name.trim().length > 150
    ) {
      fields.name = "Product name must be 1-150 characters.";
    }
  }

  // sku: optional, max 64, trimmed, empty string becomes null
  if (data.sku !== undefined) {
    if (data.sku === null) {
      // null is allowed to clear SKU
    } else if (typeof data.sku !== "string") {
      fields.sku = "SKU must be a string or null.";
    } else {
      const trimmed = data.sku.trim();
      if (trimmed.length > 64) {
        fields.sku = "SKU must be at most 64 characters.";
      }
    }
  }

  // description: max 2000
  if (data.description !== undefined) {
    if (typeof data.description !== "string") {
      fields.description = "Description must be a string.";
    } else if (data.description.length > 2000) {
      fields.description = "Description must be at most 2000 characters.";
    }
  }

  // category: max 80
  if (data.category !== undefined) {
    if (data.category === null) {
      // null is allowed to clear category
    } else if (typeof data.category !== "string") {
      fields.category = "Category must be a string or null.";
    } else if (data.category.trim().length > 80) {
      fields.category = "Category must be at most 80 characters.";
    }
  }

  // selling_price: number >= 0, max 2 decimals, max 9999999999.99
  if (data.selling_price !== undefined) {
    const price = Number(data.selling_price);
    if (isNaN(price) || price < 0) {
      fields.selling_price = "Selling price must be a number >= 0.";
    } else if (!/^\d+(\.\d{1,2})?$/.test(price.toFixed(2)) || price > 9999999999.99) {
      fields.selling_price = "Selling price must have at most 2 decimal places and be <= 9999999999.99.";
    }
  }

  // cost_price: number >= 0, max 2 decimals, max 9999999999.99
  if (data.cost_price !== undefined) {
    const price = Number(data.cost_price);
    if (isNaN(price) || price < 0) {
      fields.cost_price = "Cost price must be a number >= 0.";
    } else if (!/^\d+(\.\d{1,2})?$/.test(price.toFixed(2)) || price > 9999999999.99) {
      fields.cost_price = "Cost price must have at most 2 decimal places and be <= 9999999999.99.";
    }
  }

  // low_stock_threshold: integer >= 0
  if (data.low_stock_threshold !== undefined) {
    if (data.low_stock_threshold === null) {
      fields.low_stock_threshold = "Low stock threshold cannot be null. Use 0 to disable.";
    } else {
      const threshold = Number(data.low_stock_threshold);
      if (!Number.isInteger(threshold) || threshold < 0) {
        fields.low_stock_threshold = "Low stock threshold must be an integer >= 0.";
      }
    }
  }

  // image_url: optional, must be http/https URL, max 500
  if (data.image_url !== undefined) {
    if (data.image_url === null || data.image_url === "") {
      // null/empty allowed to clear
    } else if (typeof data.image_url !== "string") {
      fields.image_url = "Image URL must be a string or null.";
    } else if (data.image_url.length > 500) {
      fields.image_url = "Image URL must be at most 500 characters.";
    } else if (!URL_REGEX.test(data.image_url)) {
      fields.image_url = "Image URL must be a valid http/https URL.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  // Build result with only provided fields
  const result = {};
  if (data.name !== undefined) result.name = data.name.trim();
  if (data.sku !== undefined) result.sku = typeof data.sku === "string" && data.sku.trim().length > 0 ? data.sku.trim() : null;
  if (data.description !== undefined) result.description = typeof data.description === "string" ? data.description : "";
  if (data.category !== undefined) result.category = typeof data.category === "string" && data.category.trim().length > 0 ? data.category.trim() : null;
  if (data.selling_price !== undefined) result.selling_price = Number(data.selling_price);
  if (data.cost_price !== undefined) result.cost_price = Number(data.cost_price);
  if (data.low_stock_threshold !== undefined) result.low_stock_threshold = Number(data.low_stock_threshold);
  if (data.image_url !== undefined) result.image_url = typeof data.image_url === "string" && data.image_url.trim().length > 0 ? data.image_url.trim() : null;

  return result;
}

/**
 * Validate stock adjustment input.
 * Throws AppError (400) with per-field details.
 *
 * @returns {{
 *   movement_type: 'purchase'|'adjustment',
 *   quantity_change: number, // non-zero integer
 *   reason: string
 * }}
 */
function validateStockAdjustment(input) {
  const fields = {};
  const data = input || {};

  // movement_type: required, in ('purchase', 'adjustment')
  if (!data.movement_type || !["purchase", "adjustment"].includes(data.movement_type)) {
    fields.movement_type = "Movement type must be 'purchase' or 'adjustment'.";
  }

  // quantity_change: required, non-zero integer
  // purchase must be positive, adjustment can be positive or negative
  if (data.quantity_change === undefined || data.quantity_change === null) {
    fields.quantity_change = "Quantity change is required.";
  } else {
    const qty = Number(data.quantity_change);
    if (!Number.isInteger(qty)) {
      fields.quantity_change = "Quantity change must be an integer.";
    } else if (qty === 0) {
      fields.quantity_change = "Quantity change must be non-zero.";
    } else if (data.movement_type === "purchase" && qty <= 0) {
      fields.quantity_change = "Purchase quantity must be positive.";
    }
  }

  // reason: required for adjustment, max 255
  if (data.movement_type === "adjustment") {
    if (!data.reason || typeof data.reason !== "string" || data.reason.trim().length === 0) {
      fields.reason = "Reason is required for adjustment.";
    } else if (data.reason.trim().length > 255) {
      fields.reason = "Reason must be at most 255 characters.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  return {
    movement_type: data.movement_type,
    quantity_change: Number(data.quantity_change),
    reason: data.movement_type === "adjustment" ? data.reason.trim() : "Stock purchase",
  };
}

/**
 * Validate query parameters for product listing.
 * Returns sanitized query object.
 */
function validateProductListQuery(query) {
  const q = query || {};

  // search: optional string
  const search = typeof q.search === "string" ? q.search.trim() : "";

  // category: optional string
  const category = typeof q.category === "string" ? q.category.trim() : "";

  // stock: optional, one of 'low', 'out', 'in'
  const stock = ["low", "out", "in"].includes(q.stock) ? q.stock : "";

  // page: integer >= 1, default 1
  const page = Math.max(1, parseInt(q.page, 10) || 1);

  // limit: integer 1-50, default 10
  const limit = Math.min(50, Math.max(1, parseInt(q.limit, 10) || 10));

  // sort: field:direction, field whitelist, direction asc/desc
  const sortWhitelist = ["name", "selling_price", "stock_quantity", "created_at"];
  let sort = "name:asc";
  if (typeof q.sort === "string") {
    const parts = q.sort.split(":");
    if (parts.length === 2 && sortWhitelist.includes(parts[0]) && ["asc", "desc"].includes(parts[1])) {
      sort = q.sort;
    }
  }

  return { search, category, stock, page, limit, sort };
}

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateStockAdjustment,
  validateProductListQuery,
};