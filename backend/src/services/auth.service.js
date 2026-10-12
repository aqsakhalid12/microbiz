// backend/src/services/auth.service.js
// Business logic for registration and login.
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const userRepository = require("../repositories/user.repository");
const { validateRegister, validateLogin } = require("../validators/auth.validator");
const AppError = require("../utils/AppError");

// Bcrypt cost factor. 12 is a good balance of safety vs. speed
// (~200-400 ms per hash on typical hardware).
const BCRYPT_COST = 12;

// Lazily-created hash used ONLY to keep login timing constant
// when the email does not exist (see login()).
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash("microbiz-dummy-password", BCRYPT_COST);
  }
  return dummyHashPromise;
}

/**
 * Register a new user.
 * - validates input
 * - rejects already-registered emails (also catches the
 *   rare unique-violation race when two requests collide)
 * - hashes the password with bcrypt
 * - creates the user AND its business_settings row in ONE
 *   database transaction (all-or-nothing)
 * Returns a safe user object (never the password hash).
 */
async function register(rawInput) {
  // 1. Validate on the server. Throws AppError 400 on bad input.
  const data = validateRegister(rawInput);

  // 2. Check for a duplicate email (case-insensitive).
  const existing = await userRepository.findByEmailForLogin(data.email);
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  // 3. Hash the password (never store it in plain text).
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);

  // 4. Create user + business_settings in a single transaction.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await userRepository.createUser(client, {
      fullName: data.fullName,
      email: data.email,
      passwordHash,
    });

    const settings = await userRepository.createBusinessSettings(client, {
      userId: user.id,
      businessName: data.businessName,
    });

    await client.query("COMMIT");

    // Return only safe fields (no password hash).
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      business_name: settings.business_name,
      currency_code: settings.currency_code,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    // Safety net: if two registrations race past the check above,
    // the unique index on lower(email) fires -> still a 409.
    if (err.code === "23505") {
      throw new AppError("Email already registered", 409);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Log a user in.
 * Always answers with the SAME generic error whether the email
 * exists or the password is wrong, so attackers cannot discover
 * which emails are registered.
 * Returns a safe user object (never the password hash).
 */
async function login(rawInput) {
  const { email, password } = validateLogin(rawInput);

  const user = await userRepository.findByEmailForLogin(email);

  if (!user) {
    // Run a dummy bcrypt compare so a "user not found" response
    // takes the same time as a real one (timing-attack defense).
    await bcrypt.compare(password, await getDummyHash());
    throw new AppError("Invalid email or password", 401);
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new AppError("Invalid email or password", 401);
  }

  // Load the full profile (with business settings) for the response.
  return userRepository.findByIdWithBusiness(user.id);
}

/**
 * Load the profile for the currently logged-in user (used by /me).
 */
async function getProfile(userId) {
  return userRepository.findByIdWithBusiness(userId);
}

module.exports = { register, login, getProfile };
