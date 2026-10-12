// database/scripts/set-demo-password.js
// Dev-only helper: sets a known password for the seeded demo user
// so you can log in during development.
// Refuses to run in production.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

if (process.env.NODE_ENV === "production") {
  console.error("ERROR: set-demo-password refused in production (NODE_ENV=production).");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEMO_EMAIL = "demo@microbiz.test";
const DEMO_PASSWORD = "Demo@12345";
const BCRYPT_COST = 12;

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_COST);

  const result = await pool.query(
    `UPDATE users
     SET password_hash = $1
     WHERE lower(email) = lower($2)
     RETURNING id, email`,
    [passwordHash, DEMO_EMAIL]
  );

  if (result.rowCount === 0) {
    console.log(`Demo user "${DEMO_EMAIL}" not found. Run "npm run db:seed" first.`);
  } else {
    const row = result.rows[0];
    console.log(`Password updated for ${row.email} (user id ${row.id}).`);
    console.log(`Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (development only)`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Failed to set demo password:", err.message);
  process.exit(1);
});
