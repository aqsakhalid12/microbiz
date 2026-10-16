require('dotenv').config();
// backend/tests/customers.test.js
// Plain Node test script (no extra libraries). Runs against the
// server at http://localhost:3000 — start it first (npm run dev).
// Uses unique emails (Date.now()) so it can be re-run safely.

const BASE = "http://localhost:3000";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UNIQUE = Date.now();

const EMAIL_A = `cust-a-${UNIQUE}@example.test`;
const EMAIL_B = `cust-b-${UNIQUE}@example.test`;
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
  check("setup: register user B returns 201", regB.status === 201, `status ${regB.status}`);

  const loginA = await login(EMAIL_A);
  const cookieA = loginA.cookie;
  check("setup: login A returns 200", loginA.resp.status === 200, `status ${loginA.resp.status}`);

  const loginB = await login(EMAIL_B);
  const cookieB = loginB.cookie;
  check("setup: login B returns 200", loginB.resp.status === 200, `status ${loginB.resp.status}`);

  let customerIdA = null;
  {
    const res = await api("/api/customers", {
      method: "POST",
      body: JSON.stringify({ name: "Alice Smith", email: `alice-${UNIQUE}@example.com`, phone: "+1 555 123 4567", address: "123 Main St", notes: "VIP" }),
    }, cookieA);
    check("1: create customer returns 201", res.resp.status === 201, `status ${res.resp.status}`);
    check("1: success true", res.data && res.data.success === true, "");
    if (res.data && res.data.data) customerIdA = res.data.data.id;
    check("1: id set", customerIdA !== null, "");
  }

  {
    const res = await api("/api/customers", { method: "POST", body: JSON.stringify({ email: "x@y.z" }) }, cookieA);
    check("2: missing name -> 400", res.resp.status === 400, `status ${res.resp.status}`);
  }

  {
    const res = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "Bob", email: "bad" }) }, cookieA);
    check("3: invalid email -> 400", res.resp.status === 400, `status ${res.resp.status}`);
  }

  {
    const res = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "Bob", phone: "abc" }) }, cookieA);
    check("4: invalid phone -> 400", res.resp.status === 400, `status ${res.resp.status}`);
  }

  {
    await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "Carol", email: `carol-${UNIQUE}@example.com` }) }, cookieA);
    const res = await api("/api/customers?search=Alice", {}, cookieA);
    check("5: search returns 200 and finds", res.resp.status === 200 && res.data && res.data.data && res.data.data.length > 0, "");
  }

  {
    const res = await api(`/api/customers/${customerIdA}`, { method: "PUT", body: JSON.stringify({ phone: "+1 555 999 0000", notes: "Updated" }) }, cookieA);
    check("6: update works", res.resp.status === 200 && res.data && res.data.data && res.data.data.phone && res.data.data.phone.includes("999"), "");
  }

  {
    const res = await api(`/api/customers/${customerIdA}`, {}, cookieA);
    check("7: get has order_count 0 total_spent 0", res.resp.status === 200 && res.data && res.data.data && res.data.data.order_count === 0 && res.data.data.total_spent === 0, "");
  }

  {
    const res = await api(`/api/customers/${customerIdA}/orders`, {}, cookieA);
    check("8: orders empty list", res.resp.status === 200 && res.data && Array.isArray(res.data.data) && res.data.data.length === 0, "");
  }

  {
    const del = await api(`/api/customers/${customerIdA}`, { method: "DELETE" }, cookieA);
    check("9a: delete returns 200", del.resp.status === 200, `status ${del.resp.status}`);
    const get = await api(`/api/customers/${customerIdA}`, {}, cookieA);
    check("9b: get after delete -> 404", get.resp.status === 404, `status ${get.resp.status}`);
  }

  // test 10
  let custWithOrderId = null;
  {
    const c = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "Owner", email: `owner-${UNIQUE}@example.com` }) }, cookieA);
    if (c.data && c.data.data) custWithOrderId = c.data.data.id;
  }
  const userAId = await getUserId(EMAIL_A);
  if (custWithOrderId && userAId) {
    await pool.query("INSERT INTO orders (user_id, customer_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, stock_deducted, completed_at) VALUES ($1, $2, $3, 'Completed', 'Paid', 10, 0, 10, 10, true, NOW())", [userAId, custWithOrderId, `ORD-${UNIQUE}-001`]);
  }
  {
    const del = await api(`/api/customers/${custWithOrderId}`, { method: "DELETE" }, cookieA);
    check("10: delete with order -> 409", del.resp.status === 409, `status ${del.resp.status}`);
    await pool.query("DELETE FROM orders WHERE user_id=$1 AND customer_id=$2", [userAId, custWithOrderId]);
  }

  // isolation
  let custAId = null;
  {
    const c = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "A", email: `a-${UNIQUE}@example.com` }) }, cookieA);
    if (c.data && c.data.data) custAId = c.data.data.id;
  }
  {
    const r = await api(`/api/customers/${custAId}`, {}, cookieB);
    check("iso: B cannot GET A -> 404", r.resp.status === 404, "");
  }
  {
    const r = await api(`/api/customers/${custAId}`, { method: "PUT", body: JSON.stringify({ name: "H" }) }, cookieB);
    check("iso: B cannot PUT A -> 404", r.resp.status === 404, "");
  }
  {
    const r = await api(`/api/customers/${custAId}`, { method: "DELETE" }, cookieB);
    check("iso: B cannot DELETE A -> 404", r.resp.status === 404, `status ${r.resp.status}`);
  }
  {
    const r = await api(`/api/customers/${custAId}/orders`, {}, cookieB);
    check("iso: B cannot list A orders -> 404", r.resp.status === 404, "");
  }
  {
    const r = await api("/api/customers", {}, cookieB);
    let noA = true;
    if (r.data && Array.isArray(r.data.data)) {
      noA = !r.data.data.some((c) => c.id === custAId);
    }
    check("iso: B list excludes A", noA, "");
  }
  {
    const r = await api("/api/customers", {});
    check("auth: unauth GET -> 401", r.resp.status === 401, "");
  }

  await pool.end();
  console.log(`\n=== RESULTS ===`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });





