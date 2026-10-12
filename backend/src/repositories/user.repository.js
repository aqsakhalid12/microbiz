// backend/src/repositories/user.repository.js
// All SQL for the users table. Parameterized queries only:
// user input is always passed via $1, $2, ... placeholders.
const { query } = require("../config/db");

/**
 * Find a user by email WITHOUT the password hash.
 * Use this whenever the password hash is not needed.
 * Email is normalized to lowercase so "A@x.com" and "a@x.com" match.
 */
async function findByEmail(email) {
  const result = await query(
    `SELECT id, full_name, email, created_at
     FROM users
     WHERE lower(email) = lower($1)`,
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by id WITHOUT the password hash.
 */
async function findById(id) {
  const result = await query(
    `SELECT id, full_name, email, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Find a user by email WITH the password hash.
 * ONLY the login flow may call this (it needs the hash to compare).
 */
async function findByEmailForLogin(email) {
  const result = await query(
    `SELECT id, full_name, email, password_hash
     FROM users
     WHERE lower(email) = lower($1)`,
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Load a user's profile together with their business settings.
 * Used by /api/auth/me and after login/register.
 */
async function findByIdWithBusiness(id) {
  const result = await query(
    `SELECT u.id, u.full_name, u.email,
            bs.business_name, bs.currency_code
     FROM users u
     LEFT JOIN business_settings bs ON bs.user_id = u.id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a user. Runs inside a transaction provided by the caller
 * (register creates the user AND the business_settings row atomically).
 * @param {import("pg").PoolClient} client Transaction client
 */
async function createUser(client, { fullName, email, passwordHash }) {
  const result = await client.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, full_name, email`,
    [fullName, email.toLowerCase(), passwordHash]
  );
  return result.rows[0];
}

/**
 * Create the business_settings row for a new user (same transaction).
 * @param {import("pg").PoolClient} client Transaction client
 */
async function createBusinessSettings(client, { userId, businessName }) {
  const result = await client.query(
    `INSERT INTO business_settings (user_id, business_name)
     VALUES ($1, $2)
     RETURNING business_name, currency_code`,
    [userId, businessName]
  );
  return result.rows[0];
}

module.exports = {
  findByEmail,
  findById,
  findByEmailForLogin,
  findByIdWithBusiness,
  createUser,
  createBusinessSettings,
};
