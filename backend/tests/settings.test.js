// backend/tests/settings.test.js
// Tests for /api/settings endpoints
const http = require("http");
const assert = require("assert");
const app = require("../src/app");
const { pool } = require("../src/config/db");

function assertStatus(res, expected) {
  if (res.status !== expected) {
    throw new Error(`Expected status ${expected}, got ${res.status}. Body: ${res.body}`);
  }
}

function extractCookie(res, name) {
  const setCookie = res.headers["set-cookie"];
  if (!setCookie) return null;
  for (let i = 0; i < setCookie.length; i++) {
    const c = setCookie[i];
    const m = c.match(new RegExp(`^${name}=([^;]+)`));
    if (m) return m[1];
  }
  return null;
}

async function req(method, url, opts = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const data = opts.body ? JSON.stringify(opts.body) : undefined;
      const headers = {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      };
      if (data) headers["Content-Length"] = Buffer.byteLength(data);
      const req = http.request({ method, port, path: url, headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          server.close();
          resolve({ status: res.statusCode, headers: res.headers, body });
        });
      });
      req.on("error", (err) => { server.close(); reject(err); });
      if (data) req.write(data);
      req.end();
    });
  });
}

async function main() {
  const stamp = Date.now();
  const emailA = `settings-a-${stamp}@example.test`;
  const emailB = `settings-b-${stamp}@example.test`;
  let res;

  // Register user A
  res = await req("POST", "/api/auth/register", {
    body: { fullName: "Settings A", email: emailA, password: "pass12345", confirmPassword: "pass12345" },
  });
  assertStatus(res, 201);
  const cookieA = extractCookie(res, "microbiz.sid");

  // GET settings returns row (create defaults if missing)
  res = await req("GET", "/api/settings", { headers: { Cookie: `microbiz.sid=${cookieA}` } });
  assertStatus(res, 200);
  const getBody = JSON.parse(res.body);
  assert(getBody.success === true);
  assert(getBody.data && typeof getBody.data === "object");

  // Update settings works
  res = await req("PUT", "/api/settings", {
    headers: { Cookie: `microbiz.sid=${cookieA}` },
    body: {
      business_name: "BizA",
      email: "bizA@test.com",
      phone: "+1-555-123-4567",
      address: "123 Main St",
      currency_code: "USD",
      default_low_stock_threshold: 5,
    },
  });
  assertStatus(res, 200);
  const putBody = JSON.parse(res.body);
  assert(putBody.success === true);
  assert(putBody.data.business_name === "BizA");

  // Invalid currency -> 400
  res = await req("PUT", "/api/settings", {
    headers: { Cookie: `microbiz.sid=${cookieA}` },
    body: {
      business_name: "BizA",
      email: "bizA@test.com",
      phone: "123",
      address: "123 Main",
      currency_code: "ZZZ",
      default_low_stock_threshold: 5,
    },
  });
  assertStatus(res, 400);

  // Invalid threshold -> 400 (too high)
  res = await req("PUT", "/api/settings", {
    headers: { Cookie: `microbiz.sid=${cookieA}` },
    body: {
      business_name: "BizA",
      email: "bizA@test.com",
      phone: "123",
      address: "123 Main",
      currency_code: "USD",
      default_low_stock_threshold: 200000,
    },
  });
  assertStatus(res, 400);

  // Invalid email -> 400
  res = await req("PUT", "/api/settings", {
    headers: { Cookie: `microbiz.sid=${cookieA}` },
    body: {
      business_name: "BizA",
      email: "not-an-email",
      phone: "123",
      address: "123 Main",
      currency_code: "USD",
      default_low_stock_threshold: 5,
    },
  });
  assertStatus(res, 400);

  // User B cannot see or change A's settings
  res = await req("POST", "/api/auth/register", {
    body: { fullName: "Settings B", email: emailB, password: "pass12345", confirmPassword: "pass12345" },
  });
  assertStatus(res, 201);
  const cookieB = extractCookie(res, "microbiz.sid");

  // B GET - should get own row (different from A)
  res = await req("GET", "/api/settings", { headers: { Cookie: `microbiz.sid=${cookieB}` } });
  assertStatus(res, 200);
  const getB = JSON.parse(res.body);
  assert(getB.success === true);

  // B tries to update A's data? No - we send A's user_id in body? Must be ignored; user is from req.user.id
  res = await req("PUT", "/api/settings", {
    headers: { Cookie: `microbiz.sid=${cookieB}` },
    body: {
      business_name: "BizB",
      email: "bizB@test.com",
      phone: "456",
      address: "456 Main",
      currency_code: "USD",
      default_low_stock_threshold: 3,
    },
  });
  assertStatus(res, 200);
  const putB = JSON.parse(res.body);
  assert(putB.data.business_name === "BizB");

  // Verify A's settings unchanged
  res = await req("GET", "/api/settings", { headers: { Cookie: `microbiz.sid=${cookieA}` } });
  assertStatus(res, 200);
  const getAAfter = JSON.parse(res.body);
  assert(getAAfter.data.business_name === "BizA");

  // Unauthenticated 401
  res = await req("GET", "/api/settings");
  assertStatus(res, 401);
  res = await req("PUT", "/api/settings", { body: { business_name: "x", currency_code: "USD", default_low_stock_threshold: 1 } });
  assertStatus(res, 401);

  // Cleanup
  await pool.query("DELETE FROM business_settings bs USING users u WHERE bs.user_id = u.id AND u.email IN ($1,$2)", [emailA, emailB]);
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [emailA, emailB]);
  await pool.end();

  console.log("settings.test.js: OK");
}

main().catch(async (err) => {
  try {
    await pool.end();
  } catch (_) {}
  console.error("settings.test.js: FAIL");
  console.error(err);
  process.exit(1);
});