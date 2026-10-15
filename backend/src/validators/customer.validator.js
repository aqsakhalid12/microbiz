// backend/src/validators/customer.validator.js
// Server-side validation for customer input.
// All validation happens on the server; never trust client input.
const AppError = require("../utils/AppError");

// Email regex for basic validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone: only digits, spaces, + - ( )
const PHONE_REGEX = /^[0-9\s()+\-]+$/;

/**
 * Validate customer creation input.
 * Throws an AppError (400) with per-field \"details.fields\" object
 * when anything is invalid, so the frontend can show field errors.
 */
function validateCreateCustomer(input) {
  const fields = {};
  const data = input || {};

  // name: required, 1-150 characters, trimmed
  if (
    typeof data.name !== "string" ||
    data.name.trim().length < 1 ||
    data.name.trim().length > 150
  ) {
    fields.name = "Customer name is required (1-150 characters).";
  }

  // email: optional, valid format, max 255, lowercase, empty string becomes null
  if (data.email !== undefined && data.email !== null && data.email !== "") {
    if (typeof data.email !== "string") {
      fields.email = "Email must be a string.";
    } else {
      const trimmed = data.email.trim();
      if (trimmed.length > 255) {
        fields.email = "Email must be at most 255 characters.";
      } else if (!EMAIL_REGEX.test(trimmed)) {
        fields.email = "Email format is invalid.";
      }
    }
  }

  // phone: optional, max 30, only digits, spaces, + - ( )
  if (data.phone !== undefined && data.phone !== null && data.phone !== "") {
    if (typeof data.phone !== "string") {
      fields.phone = "Phone must be a string.";
    } else {
      const trimmed = data.phone.trim();
      if (trimmed.length > 30) {
        fields.phone = "Phone must be at most 30 characters.";
      } else if (!PHONE_REGEX.test(trimmed)) {
        fields.phone = "Phone can only contain digits, spaces, +, -, (, ).";
      }
    }
  }

  // address: optional, max 500
  if (data.address !== undefined && data.address !== null) {
    if (typeof data.address !== "string") {
      fields.address = "Address must be a string.";
    } else if (data.address.length > 500) {
      fields.address = "Address must be at most 500 characters.";
    }
  }

  // notes: optional, max 2000
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
    name: data.name.trim(),
    email:
      typeof data.email === "string" && data.email.trim().length > 0
        ? data.email.trim().toLowerCase()
        : null,
    phone:
      typeof data.phone === "string" && data.phone.trim().length > 0
        ? data.phone.trim()
        : null,
    address:
      typeof data.address === "string" && data.address.trim().length > 0
        ? data.address.trim()
        : null,
    notes:
      typeof data.notes === "string" && data.notes.trim().length > 0
        ? data.notes.trim()
        : null,
  };
}

/**
 * Validate customer update input.
 * All fields optional; at least one must be provided.
 */
function validateUpdateCustomer(input) {
  const fields = {};
  const data = input || {};

  // At least one field must be provided
  const allowedFields = ["name", "email", "phone", "address", "notes"];
  const providedFields = allowedFields.filter((f) => data[f] !== undefined);
  if (providedFields.length === 0) {
    fields._general = "At least one field must be provided for update.";
  }

  // name: 1-150 characters, trimmed
  if (data.name !== undefined) {
    if (
      typeof data.name !== "string" ||
      data.name.trim().length < 1 ||
      data.name.trim().length > 150
    ) {
      fields.name = "Customer name must be 1-150 characters.";
    }
  }

  // email: optional, valid format, max 255, lowercase, empty string becomes null
  if (data.email !== undefined) {
    if (data.email === null || data.email === "") {
      // null/empty is allowed to clear email
    } else if (typeof data.email !== "string") {
      fields.email = "Email must be a string or null.";
    } else {
      const trimmed = data.email.trim();
      if (trimmed.length > 255) {
        fields.email = "Email must be at most 255 characters.";
      } else if (!EMAIL_REGEX.test(trimmed)) {
        fields.email = "Email format is invalid.";
      }
    }
  }

  // phone: optional, max 30, only digits, spaces, + - ( )
  if (data.phone !== undefined) {
    if (data.phone === null || data.phone === "") {
      // null/empty is allowed to clear phone
    } else if (typeof data.phone !== "string") {
      fields.phone = "Phone must be a string or null.";
    } else {
      const trimmed = data.phone.trim();
      if (trimmed.length > 30) {
        fields.phone = "Phone must be at most 30 characters.";
      } else if (!PHONE_REGEX.test(trimmed)) {
        fields.phone = "Phone can only contain digits, spaces, +, -, (, ).";
      }
    }
  }

  // address: max 500
  if (data.address !== undefined) {
    if (data.address === null || data.address === "") {
      // null/empty allowed to clear
    } else if (typeof data.address !== "string") {
      fields.address = "Address must be a string or null.";
    } else if (data.address.length > 500) {
      fields.address = "Address must be at most 500 characters.";
    }
  }

  // notes: max 2000
  if (data.notes !== undefined) {
    if (data.notes === null || data.notes === "") {
      // null/empty allowed to clear
    } else if (typeof data.notes !== "string") {
      fields.notes = "Notes must be a string or null.";
    } else if (data.notes.length > 2000) {
      fields.notes = "Notes must be at most 2000 characters.";
    }
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  const result = {};
  if (data.name !== undefined) result.name = data.name.trim();
  if (data.email !== undefined) {
    result.email =
      typeof data.email === "string" && data.email.trim().length > 0
        ? data.email.trim().toLowerCase()
        : null;
  }
  if (data.phone !== undefined) {
    result.phone =
      typeof data.phone === "string" && data.phone.trim().length > 0
        ? data.phone.trim()
        : null;
  }
  if (data.address !== undefined) {
    result.address =
      typeof data.address === "string" && data.address.trim().length > 0
        ? data.address.trim()
        : null;
  }
  if (data.notes !== undefined) {
    result.notes =
      typeof data.notes === "string" && data.notes.trim().length > 0
        ? data.notes.trim()
        : null;
  }
  return result;
}

module.exports = {
  validateCreateCustomer,
  validateUpdateCustomer,
};
