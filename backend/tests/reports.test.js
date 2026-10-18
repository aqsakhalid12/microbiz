require("dotenv").config();
// backend/tests/reports.test.js — PART 1

const BASE = "http://localhost:3000";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UNIQUE = Date.now();

const EMAIL_A = `rep-a-${UNIQUE}@example.test`;
const EMAIL_B = `rep-b-${UNIQUE}@example.test`;
const PASSWORD = "ValidPass123";

let passed = 0;
let failed = 0;

function check(name, condition, extra) {
  if (condition) {
    passed++;
    console.log(`PASS: ${name}`);
  } else {
    failed++;
    console.log(`FAIL: ${name}${extra ? " -> " + extra : ""}`);
  }
}

function extractSessionCookie(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  for (const header of setCookieHeaders) {
    const pair = header.split(";")[0].trim();
    if (pair.startsWith("microbiz.sid=")) return pair;
  }
  return null;
}

async function register(email) {
  return fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName: "Test User", email, password: PASSWORD }),
  });
}

async function login(email) {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = extractSessionCookie(resp.headers.getSetCookie());
  return { resp, cookie };
}

async function api(path, options, cookie) {
  const headers = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const opts = { ...options, headers };
  const resp = await fetch(`${BASE}${path}`, opts);
  let data = null;
  try {
    data = await resp.json();
  } catch {
    // non-JSON
  }
  return { resp, data };
}

async function getUserId(email) {
  const res = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  return res.rows[0] ? res.rows[0].id : null;
}

async function main() {
  const regA = await register(EMAIL_A);
  check("setup: register user A returns 201", regA.status === 201, `status ${regA.status}`);

  const regB = await register(EMAIL_B);
  check("setup: register user B returns 201", regB.status === 200 || regB.status === 201, `status ${regB.status}`);

  const loginA = await login(EMAIL_A);
  const cookieA = loginA.cookie;
  check("setup: login A returns 200", loginA.resp.status === 200, `status ${loginA.resp.status}`);

  const loginB = await login(EMAIL_B);
  const cookieB = loginB.cookie;
  check("setup: login B returns 200", loginB.resp.status === 200, `status ${loginB.resp.status}`);

  const userAId = await getUserId(EMAIL_A);
  check("setup: user A id resolved", userAId !== null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString();

  const prod = await pool.query(
    `INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [userAId, "Test Product", `SKU-${UNIQUE}`, "A test product", "General", 25, 10, 1, 2]
  );
  const productId = prod.rows[0].id;

  const ordNum1 = `ORD-${UNIQUE}-001`;
  const ordNum2 = `ORD-${UNIQUE}-002`;
  const ordNumPending = `ORD-${UNIQUE}-003`;
  const ordNumCancelled = `ORD-${UNIQUE}-004`;
  const ordNumOld = `ORD-${UNIQUE}-005`;

  const o1 = await pool.query(
    `INSERT INTO orders (user_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, order_date, completed_at, stock_deducted)
     VALUES ($1, $2, 'Completed', 'Paid', 50, 0, 50, 50, $3::timestamptz, $3::timestamptz, true) RETURNING id`,
    [userAId, ordNum1, todayStr]
  );
  const order1Id = o1.rows[0].id;
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
     VALUES ($1, $2, $3, $4, 2, 25, 10, 50)`,
    [order1Id, productId, "Test Product", `SKU-${UNIQUE}`]
  );

  const o2 = await pool.query(
    `INSERT INTO orders (user_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, order_date, completed_at, stock_deducted)
     VALUES ($1, $2, 'Completed', 'Paid', 75, 0, 75, 75, $3::timestamptz, $3::timestamptz, true) RETURNING id`,
    [userAId, ordNum2, todayStr]
  );
  const order2Id = o2.rows[0].id;
  await pool.query(
    `INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
     VALUES ($1, $2, $3, $4, 3, 25, 10, 75)`,
    [order2Id, productId, "Test Product", `SKU-${UNIQUE}`]
  );

  await pool.query(
    `INSERT INTO orders (user_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, order_date, stock_deducted)
     VALUES ($1, $2, 'Pending', 'Unpaid', 100, 0, 100, 0, $3::timestamptz, false)`,
    [userAId, ordNumPending, todayStr]
  );

  await pool.query(
    `INSERT INTO orders (user_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, order_date, stock_deducted)
     VALUES ($1, $2, 'Cancelled', 'Unpaid', 200, 0, 200, 0, $3::timestamptz, false)`,
    [userAId, ordNumCancelled, todayStr]
  );

  await pool.query(
    `INSERT INTO orders (user_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, order_date, completed_at, stock_deducted)
     VALUES ($1, $2, 'Completed', 'Paid', 500, 0, 500, 500, $3::timestamptz, $4::timestamptz, true)`,
    [userAId, ordNumOld, todayStr, threeMonthsAgoStr]
  );

  await pool.query(
    `INSERT INTO expenses (user_id, category, description, amount, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userAId, "Utilities", "Office electricity", 20.00, todayStr, "Monthly bill"]
  );
  await pool.query(
    `INSERT INTO expenses (user_id, category, description, amount, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userAId, "Supplies", "Paper and pens", 30.00, todayStr, "Restock"]
  );

  // PART 1: GET /api/reports/summary
  {
    const { resp, data } = await api("/api/reports/summary", {}, cookieA);
    check("summary: returns 200", resp.status === 200, `status ${resp.status}`);
    check("summary: success true", data && data.success === true, JSON.stringify(data));
    const s = data && data.data;
    check("summary: revenue 125", s && s.revenue === 125, `revenue=${s && s.revenue}`);
    check("summary: cost_of_goods 50", s && s.cost_of_goods === 50, `cost_of_goods=${s && s.cost_of_goods}`);
    check("summary: gross_profit 75", s && s.gross_profit === 75, `gross_profit=${s && s.gross_profit}`);
    check("summary: expenses 50", s && s.expenses === 50, `expenses=${s && s.expenses}`);
    check("summary: net_profit 25", s && s.net_profit === 25, `net_profit=${s && s.net_profit}`);
    check("summary: average_order_value 62.5", s && s.average_order_value === 62.5, `average_order_value=${s && s.average_order_value}`);
    check("summary: orders completed 2", s && s.orders && s.orders.completed === 2, `completed=${s && s.orders && s.orders.completed}`);
    check("summary: orders pending 1", s && s.orders && s.orders.pending === 1, `pending=${s && s.orders && s.orders.pending}`);
    check("summary: orders cancelled 1", s && s.orders && s.orders.cancelled === 1, `cancelled=${s && s.orders && s.orders.cancelled}`);
  }

// PART 2: detail endpoints and edge cases

{
  const { resp, data } = await api("/api/reports/sales-trend", {}, cookieA);
  check("trend: returns 200", resp.status === 200, `status ${resp.status}`);
  check("trend: is array", Array.isArray(data && data.data), JSON.stringify(data));
  const trend = data && data.data;
  if (trend && trend.length) {
    check("trend: last period equals date_to", trend[trend.length - 1].period === todayStr, `last=${trend[trend.length - 1].period}`);
    check("trend: entries have shape", trend.every((t) => t.period !== undefined && t.revenue !== undefined && t.gross_profit !== undefined && t.orders !== undefined), JSON.stringify(trend));
    const totalRevenue = trend.reduce((sum, t) => sum + (t.revenue || 0), 0);
    check("trend: total revenue matches summary", Math.abs(totalRevenue - 125) < 0.01, `total=${totalRevenue}`);
  }
}

{
  const { resp, data } = await api("/api/reports/top-products", {}, cookieA);
  check("top-products: returns 200", resp.status === 200, `status ${resp.status}`);
  check("top-products: is array", Array.isArray(data && data.data), JSON.stringify(data));
  const tops = data && data.data;
  const testProd = tops && tops.find((p) => p.sku === `SKU-${UNIQUE}`);
  check("top-products: fixture product quantity_sold 5", testProd && testProd.quantity_sold === 5, `found=${JSON.stringify(testProd)}`);
}

{
  const { resp, data } = await api("/api/reports/expenses-by-category", {}, cookieA);
  check("expenses-by-category: returns 200", resp.status === 200, `status ${resp.status}`);
  check("expenses-by-category: is array", Array.isArray(data && data.data), JSON.stringify(data));
  const cats = data && data.data;
  const utilities = cats && cats.find((c) => c.category === "Utilities");
  const supplies = cats && cats.find((c) => c.category === "Supplies");
  check("expenses-by-category: Utilities total 20", utilities && utilities.total === 20, `Utilities=${JSON.stringify(utilities)}`);
  check("expenses-by-category: Supplies total 30", supplies && supplies.total === 30, `Supplies=${JSON.stringify(supplies)}`);
}

{
  const { resp, data } = await api("/api/reports/low-stock", {}, cookieA);
  check("low-stock: returns 200", resp.status === 200, `status ${resp.status}`);
  check("low-stock: is array", Array.isArray(data && data.data), JSON.stringify(data));
  const low = data && data.data;
  const listed = low && low.find((p) => p.sku === `SKU-${UNIQUE}`);
  check("low-stock: lists fixture product", listed !== undefined, JSON.stringify(low));
}

{
  const { resp } = await api("/api/reports/summary?date_from=2026-10-18&date_to=2026-10-01", {}, cookieA);
  check("summary: reversed date range -> 400", resp.status === 400, `status ${resp.status}`);
}

{
  const { resp } = await api("/api/reports/summary?date_from=2026-01-01&date_to=2027-12-31", {}, cookieA);
  check("summary: range over 366 days -> 400", resp.status === 400, `status ${resp.status}`);
}

{
  const { resp } = await api("/api/reports/summary?date_from=2026-13-01&date_to=2026-10-18", {}, cookieA);
  check("summary: invalid date -> 400", resp.status === 400, `status ${resp.status}`);
}

{
  const { resp } = await api("/api/reports/summary", {}, null);
  check("summary: unauthenticated -> 401", resp.status === 401, `status ${resp.status}`);
  const { resp: tResp } = await api("/api/reports/sales-trend", {}, null);
  check("trend: unauthenticated -> 401", tResp.status === 401, `status ${tResp.status}`);
}

{
  const { resp, data } = await api("/api/reports/summary", {}, cookieB);
  check("isolation: B summary returns 200", resp.status === 200, `status ${resp.status}`);
  const s = data && data.data;
  check("isolation: B revenue 0", s && s.revenue === 0, `revenue=${s && s.revenue}`);
  check("isolation: B expenses 0", s && s.expenses === 0, `expenses=${s && s.expenses}`);
  check("isolation: B orders completed 0", s && s.orders && s.orders.completed === 0, `completed=${s && s.orders && s.orders.completed}`);
  check("isolation: B orders pending 0", s && s.orders && s.orders.pending === 0, `pending=${s && s.orders && s.orders.pending}`);
  check("isolation: B orders cancelled 0", s && s.orders && s.orders.cancelled === 0, `cancelled=${s && s.orders && s.orders.cancelled}`);
}


  await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1 AND order_number LIKE $2)", [userAId, `ORD-${UNIQUE}-%`]);
  await pool.query("DELETE FROM orders WHERE user_id = $1 AND order_number LIKE $2", [userAId, `ORD-${UNIQUE}-%`]);
  await pool.query("DELETE FROM expenses WHERE user_id = $1", [userAId]);
  await pool.query("DELETE FROM products WHERE user_id = $1 AND sku LIKE $2", [userAId, `SKU-${UNIQUE}-%`]);

  await pool.end();
  console.log(`\n=== RESULTS ===`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
