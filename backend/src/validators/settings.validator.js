// backend/src/validators/settings.validator.js
// Server-side validation for business settings.
const AppError = require("../utils/AppError");

const CURRENCY_CODES = ["USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "CAD", "AUD"];

// Email validation (simple but reasonable)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation: digits, spaces, + - ( )
const PHONE_REGEX = /^[\d\s+\-()]+$/;

function validateGetSettings() {
  return {};
}

function validateUpdateSettings(input) {
  const fields = {};
  const data = input || {};

  // business_name: required 1-150
  if (typeof data.business_name !== "string") {
    fields.business_name = "Business name is required.";
  } else {
    if (data.business_name.trim().length < 1) {
      fields.business_name = "Business name is required.";
    } else if (data.business_name.trim().length > 150) {
      fields.business_name = "Business name must be at most 150 characters.";
    }
  }

  // email: optional valid format max 255 (empty becomes null)
  if (data.email !== undefined && data.email !== null && data.email !== "") {
    if (typeof data.email !== "string") {
      fields.email = "Email must be a string.";
    } else {
      if (data.email.length > 255) {
        fields.email = "Email must be at most 255 characters.";
      } else if (!EMAIL_REGEX.test(data.email)) {
        fields.email = "Email must be a valid email address.";
      }
    }
  }

  // phone: optional max 30 (digits, spaces, + - ( ))
  if (data.phone !== undefined && data.phone !== null && data.phone !== "") {
    if (typeof data.phone !== "string") {
      fields.phone = "Phone must be a string.";
    } else {
      if (data.phone.length > 30) {
        fields.phone = "Phone must be at most 30 characters.";
      } else if (!PHONE_REGEX.test(data.phone)) {
        fields.phone = "Phone contains invalid characters.";
      }
    }
  }

  // address: max 500
  if (data.address !== undefined && data.address !== null) {
    if (typeof data.address !== "string") {
      fields.address = "Address must be a string.";
    } else if (data.address.length > 500) {
      fields.address = "Address must be at most 500 characters.";
    }
  }

  // currency_code: one of USD, EUR, GBP, PKR, INR, AED, SAR, CAD, AUD
  if (typeof data.currency_code !== "string") {
    fields.currency_code = "Currency code is required.";
  } else {
    const code = data.currency_code.toUpperCase();
    if (!CURRENCY_CODES.includes(code)) {
      fields.currency_code = "Currency code must be one of USD, EUR, GBP, PKR, INR, AED, SAR, CAD, AUD.";
    }
  }

  // default_low_stock_threshold: integer 0-100000
  if (data.default_low_stock_threshold === undefined || data.default_low_stock_threshold === null || data.default_low_stock_threshold === "") {
    fields.default_low_stock_threshold = "Default low stock threshold is required.";
  } else {
    const threshold = Number(data.default_low_stock_threshold);
    if (!Number.isInteger(threshold)) {
      fields.default_low_stock_threshold = "Default low stock threshold must be an integer.";
    } else if (threshold < 0 || threshold > 100000) {
      fields.default_low_stock_threshold = "Default low stock threshold must be between 0 and 100000.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  // Normalize
  let email = null;
  if (typeof data.email === "string" && data.email.trim().length > 0) {
    email = data.email.trim();
  }

  let phone = null;
  if (typeof data.phone === "string" && data.phone.trim().length > 0) {
    phone = data.phone.trim();
  }

  let address = null;
  if (typeof data.address === "string" && data.address.trim().length > 0) {
    address = data.address.trim();
  }

  return {
    business_name: data.business_name.trim(),
    email,
    phone,
    address,
    currency_code: data.currency_code.toUpperCase(),
    default_low_stock_threshold: Number(data.default_low_stock_threshold),
  };
}

module.exports = {
  validateGetSettings,
  validateUpdateSettings,
};