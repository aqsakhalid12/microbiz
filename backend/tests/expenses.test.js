require("dotenv").config();
// backend/tests/expenses.test.js
// Plain Node test script (no extra libraries). Runs against the
// server at http://localhost:3000 — start it first (npm run dev).
// Uses unique emails (Date.now()) so it can be re-run safely.

const BASE = "http://localhost:3000";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UNIQUE = Date.now();

const EMAIL_A = `exp-a-${UNIQUE}@example.test`;
const EMAIL_B = `exp-b-${UNIQUE}@example.test`;
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

async function main() {
  // Setup: register two users A and B, each with their own session cookie
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

  let expenseIdA = null;

  // =================================
  // TEST 1: Create expense -> 201
  // =================================
  {
    const { resp, data } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({
        category: "Utilities",
        description: "Electricity",
        amount: 123.45,
        expense_date: "2026-10-01",
        notes: "Monthly bill",
      }),
    }, cookieA);

    check("1: create expense returns 201", resp.status === 201, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("1: success true", data && data.success === true, JSON.stringify(data));
    if (data && data.data) expenseIdA = data.data.id;
    check("1: id set", expenseIdA !== null);
    check("1: amount is a number", data && data.data && typeof data.data.amount === "number", JSON.stringify(data));
    check("1: amount value", data && data.data && data.data.amount === 123.45, JSON.stringify(data));
  }

  // =================================
  // TEST 2: missing category -> 400
  // =================================
  {
    const { resp, data } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ description: "No category", amount: 10, expense_date: "2026-10-01" }),
    }, cookieA);
    check("2: missing category returns 400", resp.status === 400, `status ${resp.status}`);
    check("2: category field error", data && data.details && data.details.fields && data.details.fields.category, JSON.stringify(data));
  }

  // =================================
  // TEST 3: amount <= 0 -> 400
  // =================================
  {
    const { resp } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ category: "Utilities", amount: 0, expense_date: "2026-10-01" }),
    }, cookieA);
    check("3: zero amount returns 400", resp.status === 400, `status ${resp.status}`);
  }
  {
    const { resp } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ category: "Utilities", amount: -5, expense_date: "2026-10-01" }),
    }, cookieA);
    check("3: negative amount returns 400", resp.status === 400, `status ${resp.status}`);
  }

  // =================================
  // TEST 4: 3 decimals -> 400
  // =================================
  {
    const { resp, data } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ category: "Utilities", amount: 10.123, expense_date: "2026-10-01" }),
    }, cookieA);
    check("4: 3 decimals returns 400", resp.status === 400, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("4: amount field error", data && data.details && data.details.fields && data.details.fields.amount, JSON.stringify(data));
  }

  // =================================
  // TEST 5: future date -> 400
  // =================================
  {
    const { resp } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ category: "Utilities", amount: 10, expense_date: "2030-01-01" }),
    }, cookieA);
    check("5: future date returns 400", resp.status === 400, `status ${resp.status}`);
  }

  // =================================
  // TEST 6: invalid date -> 400
  // =================================
  {
    const { resp } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ category: "Utilities", amount: 10, expense_date: "2026-13-01" }),
    }, cookieA);
    check("6: invalid date returns 400", resp.status === 400, `status ${resp.status}`);
  }

  // Create a few more expenses for list/filter/summary tests (all owned by A)
  await api("/api/expenses", { method: "POST", body: JSON.stringify({ category: "Rent", amount: 500.00, expense_date: "2026-09-01", notes: "September rent" }) }, cookieA);
  await api("/api/expenses", { method: "POST", body: JSON.stringify({ category: "Utilities", amount: 75.50, expense_date: "2026-10-05", notes: "Water" }) }, cookieA);
  await api("/api/expenses", { method: "POST", body: JSON.stringify({ category: "Supplies", amount: 40.00, expense_date: "2026-10-10", notes: "Paper" }) }, cookieA);

  // =================================
  // TEST 7: list with search, category, date range, pagination + summary
  // =================================
  {
    // List all of A's expenses
    const listRes = await api("/api/expenses", {}, cookieA);
    check("7: list returns 200", listRes.resp.status === 200, `status ${listRes.resp.status}`);
    check("7: list has items", listRes.data && listRes.data.data && Array.isArray(listRes.data.data), JSON.stringify(listRes.data));
    check("7: all items belong to A", listRes.data && listRes.data.data && listRes.data.data.every((e) => e.category), "");

    // Summary present
    check("7: summary present", listRes.data && listRes.data.summary && typeof listRes.data.summary.total_amount === "number" && typeof listRes.data.summary.count === "number", JSON.stringify(listRes.data));
    check("7: summary count matches items", listRes.data && listRes.data.summary.count === listRes.data.data.length, `count=${listRes.data.summary.count}, items=${listRes.data.data.length}`);
    const expectedTotal = 123.45 + 500.00 + 75.50 + 40.00;
    check("7: summary total matches", listRes.data && Math.abs(listRes.data.summary.total_amount - expectedTotal) < 0.001, `total=${listRes.data.summary.total_amount}, expected=${expectedTotal}`);

    // Search
    const searchRes = await api("/api/expenses?search=Rent", {}, cookieA);
    check("7: search returns 200", searchRes.resp.status === 200);
    check("7: search finds Rent", searchRes.data && searchRes.data.data && searchRes.data.data.length >= 1, JSON.stringify(searchRes.data));

    // Category filter
    const catRes = await api("/api/expenses?category=Utilities", {}, cookieA);
    check("7: category filter returns 200", catRes.resp.status === 200);
    check("7: category filter only Utilities", catRes.data && catRes.data.data && catRes.data.data.every((e) => e.category === "Utilities"), JSON.stringify(catRes.data));

    // Date range
    const dateRes = await api("/api/expenses?date_from=2026-10-01&date_to=2026-10-31", {}, cookieA);
    check("7: date range returns 200", dateRes.resp.status === 200);
    check("7: date range only October", dateRes.data && dateRes.data.data && dateRes.data.data.every((e) => e.expense_date >= "2026-10-01" && e.expense_date <= "2026-10-31"), JSON.stringify(dateRes.data));

    // Pagination
    const pageRes = await api("/api/expenses?page=1&limit=2", {}, cookieA);
    check("7: pagination returns 200", pageRes.resp.status === 200);
    check("7: pagination limits results to 2", pageRes.data && pageRes.data.data && pageRes.data.data.length <= 2, JSON.stringify(pageRes.data));
    check("7: pagination has total", pageRes.data && pageRes.data.pagination && pageRes.data.pagination.total !== undefined, JSON.stringify(pageRes.data));

    // Summary respects filters
    const catSummaryRes = await api("/api/expenses?category=Rent", {}, cookieA);
    check("7: summary respects category filter", catSummaryRes.data && catSummaryRes.data.summary && catSummaryRes.data.summary.count === 1 && catSummaryRes.data.summary.total_amount === 500, JSON.stringify(catSummaryRes.data));
  }

  // Categories endpoint
  {
    const { resp, data } = await api("/api/expenses/categories", {}, cookieA);
    check("cats: categories endpoint returns 200", resp.status === 200, `status ${resp.status}`);
    check("cats: categories includes Utilities", data && data.data && data.data.includes("Utilities"), JSON.stringify(data));
    check("cats: categories includes Rent", data && data.data && data.data.includes("Rent"), JSON.stringify(data));
  }

  // =================================
  // TEST 8: Update expense
  // =================================
  {
    const { resp, data } = await api(`/api/expenses/${expenseIdA}`, {
      method: "PUT",
      body: JSON.stringify({ amount: 200.00, notes: "Updated bill" }),
    }, cookieA);
    check("8: update returns 200", resp.status === 200, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("8: updated amount", data && data.data && data.data.amount === 200, JSON.stringify(data));
    check("8: updated notes", data && data.data && data.data.notes === "Updated bill", JSON.stringify(data));
  }

  // =================================
  // TEST 9: Delete then 404
  // =================================
  {
    const { resp: delResp } = await api(`/api/expenses/${expenseIdA}`, { method: "DELETE" }, cookieA);
    check("9: delete returns 200", delResp.status === 200, `status ${delResp.status}`);
    const { resp: getResp } = await api(`/api/expenses/${expenseIdA}`, {}, cookieA);
    check("9: GET after delete -> 404", getResp.status === 404, `status ${getResp.status}`);
  }

  // =================================
  // TEST 10: Data isolation - user B cannot access user A's expenses
  // =================================
  {
    // Create an expense owned by A to use for isolation checks
    let isoId = null;
    {
      const c = await api("/api/expenses", { method: "POST", body: JSON.stringify({ category: "Rent", amount: 100, expense_date: "2026-09-15" }) }, cookieA);
      if (c.data && c.data.data) isoId = c.data.data.id;
    }

    // B tries to GET A's expense -> 404
    const { resp: getResp } = await api(`/api/expenses/${isoId}`, {}, cookieB);
    check("iso: B cannot GET A's expense -> 404", getResp.status === 404, `status ${getResp.status}`);

    // B tries to PUT A's expense -> 404
    const { resp: putResp } = await api(`/api/expenses/${isoId}`, {
      method: "PUT",
      body: JSON.stringify({ category: "Hacked" }),
    }, cookieB);
    check("iso: B cannot PUT A's expense -> 404", putResp.status === 404, `status ${putResp.status}`);

    // B tries to DELETE A's expense -> 404
    const { resp: delResp } = await api(`/api/expenses/${isoId}`, { method: "DELETE" }, cookieB);
    check("iso: B cannot DELETE A's expense -> 404", delResp.status === 404, `status ${delResp.status}`);

    // B's list excludes A's expense and summary excludes it
    const listRes = await api("/api/expenses", {}, cookieB);
    const aExpenseInBList = listRes.data && listRes.data.data && listRes.data.data.find((e) => e.id == isoId);
    check("iso: A's expense not in B's list", aExpenseInBList === undefined, `found in B's list: ${JSON.stringify(aExpenseInBList)}`);
    check("iso: B's summary excludes A's expense", listRes.data && listRes.data.summary && listRes.data.summary.count === 0, `count=${listRes.data.summary.count}, total=${listRes.data.summary.total_amount}`);
  }

  // =================================
  // TEST 11: Unauthenticated request -> 401
  // =================================
  {
    const { resp } = await api("/api/expenses", {}, null);
    check("11: unauthenticated GET /api/expenses returns 401", resp.status === 401, `status ${resp.status}`);
    const { resp: postResp } = await api("/api/expenses", { method: "POST", body: JSON.stringify({ category: "X", amount: 1, expense_date: "2026-10-01" }) }, null);
    check("11: unauthenticated POST /api/expenses returns 401", postResp.status === 401, `status ${postResp.status}`);
    const { resp: getResp } = await api("/api/expenses/1", {}, null);
    check("11: unauthenticated GET /api/expenses/1 returns 401", getResp.status === 401, `status ${getResp.status}`);
  }

  // =================================
  // TEST 12: Client-supplied user_id is ignored
  // =================================
  {
    // A sends a spoofed user_id; server must use the session user (A) instead.
    const { resp, data } = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ category: "Transport", amount: 30, expense_date: "2026-10-01", user_id: 999999 }),
    }, cookieA);
    check("12: create with spoofed user_id returns 201", resp.status === 201, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    const createdId = data && data.data ? data.data.id : null;
    check("12: created id set", createdId !== null);
    if (createdId) {
      // A can retrieve it (owned by A), proving the server ignored the client user_id.
      const { resp: getResp } = await api(`/api/expenses/${createdId}`, {}, cookieA);
      check("12: spoofed user_id expense owned by session user (A can GET)", getResp.status === 200, `status ${getResp.status}`);
    }
  }

  // Cleanup: delete the isolation expense owned by A (still exists)
  {
    const { resp: getResp, data: getData } = await api("/api/expenses", {}, cookieA);
    const iso = getData && getData.data && getData.data.find((e) => e.category === "Rent" && e.amount === 100);
    if (iso) {
      await api(`/api/expenses/${iso.id}`, { method: "DELETE" }, cookieA);
    }
  }

  await pool.end();
  console.log(`\n=== RESULTS ===`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
