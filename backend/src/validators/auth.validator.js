// backend/src/validators/auth.validator.js
// Server-side validation for register/login input.
// All validation happens on the server; the frontend may validate too,
// but the server never trusts client input.
const AppError = require("../utils/AppError");

// Simple but practical email check (format + length).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate registration input.
 * Throws an AppError (400) with a per-field "details.fields" object
 * when anything is invalid, so the frontend can show field errors.
 *
 * @returns {{ fullName: string, email: string, password: string, businessName: string }}
 */
function validateRegister(input) {
  const fields = {};
  const data = input || {};

  // full_name: required, 2-100 characters.
  if (
    typeof data.fullName !== "string" ||
    data.fullName.trim().length < 2 ||
    data.fullName.trim().length > 100
  ) {
    fields.full_name = "Full name must be 2-100 characters.";
  }

  // email: required, valid format, max 255 characters.
  if (
    typeof data.email !== "string" ||
    data.email.trim().length > 255 ||
    !EMAIL_REGEX.test(data.email.trim())
  ) {
    fields.email = "Enter a valid email address (max 255 characters).";
  }

  // password: 8-72 characters (bcrypt limit is 72),
  // with at least one letter and at least one number.
  if (
    typeof data.password !== "string" ||
    data.password.length < 8 ||
    data.password.length > 72 ||
    !/[A-Za-z]/.test(data.password) ||
    !/\d/.test(data.password)
  ) {
    fields.password =
      "Password must be 8-72 characters and contain at least one letter and one number.";
  }

  // If any field failed, report all of them at once.
  if (Object.keys(fields).length > 0) {
    throw new AppError("Validation failed", 400, { fields });
  }

  // business_name is optional; default to "<full_name>'s Business".
  const fullName = data.fullName.trim();
  const businessName =
    typeof data.businessName === "string" && data.businessName.trim().length > 0
      ? data.businessName.trim().slice(0, 100)
      : `${fullName}'s Business`;

  return {
    fullName,
    // Emails are stored lowercase for case-insensitive uniqueness.
    email: data.email.trim().toLowerCase(),
    password: data.password,
    businessName,
  };
}

/**
 * Validate login input. Kept intentionally loose: login always
 * answers with the same generic message, so there is no field detail
 * to reveal (see auth.service.login).
 */
function validateLogin(input) {
  const data = input || {};
  return {
    email: typeof data.email === "string" ? data.email.trim() : "",
    password: typeof data.password === "string" ? data.password : "",
  };
}

module.exports = { validateRegister, validateLogin };
