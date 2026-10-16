require('dotenv').config();
// backend/tests/orders.test.js
// Plain Node test script (no extra libraries). Runs against the
// server at http://localhost:3000 — start it first (npm run dev).
// Uses unique emails (Date.now()) so it can be re-run safely.

const BASE = "http://localhost:3000";
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const UNIQUE = Date.now();
const EMAIL_A = `order-a-${UNIQUE}@example.test`;
const EMAIL_B = `order-b-${UNIQUE}@example.test`;
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

async function register(email, fullName = "Test User") {
  return fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fullName, email, password: PASSWORD }),
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

async function getProductBySku(sku) {
  const res = await pool.query("SELECT * FROM products WHERE sku = $1", [sku]);
  return res.rows[0] || null;
}

async function setProductStock(sku, qty) {
  const prod = await getProductBySku(sku);
  if (prod) {
    await pool.query("UPDATE products SET stock_quantity = $1 WHERE id = $2", [qty, prod.id]);
  }
}

async function clearInventoryMovements(sku) {
  const prod = await getProductBySku(sku);
  if (prod) {
    await pool.query("DELETE FROM inventory_movements WHERE product_id = $1", [prod.id]);
  }
}

async function clearOrdersTestData(emailA, emailB, skus) {
  const userAId = await getUserId(emailA);
  const userBId = await getUserId(emailB);
  if (userAId) {
    const orders = await pool.query("SELECT id FROM orders WHERE user_id = $1", [userAId]);
    for (const row of orders.rows) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [row.id]);
    }
    await pool.query("DELETE FROM inventory_movements WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)", [userAId]);
    await pool.query("DELETE FROM orders WHERE user_id = $1", [userAId]);
    await pool.query("DELETE FROM customers WHERE user_id = $1", [userAId]);
  }
  if (userBId) {
    const orders = await pool.query("SELECT id FROM orders WHERE user_id = $1", [userBId]);
    for (const row of orders.rows) {
      await pool.query("DELETE FROM order_items WHERE order_id = $1", [row.id]);
    }
    await pool.query("DELETE FROM inventory_movements WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)", [userBId]);
    await pool.query("DELETE FROM orders WHERE user_id = $1", [userBId]);
    await pool.query("DELETE FROM customers WHERE user_id = $1", [userBId]);
  }
  for (const sku of skus || []) {
    await clearInventoryMovements(sku);
    const prod = await getProductBySku(sku);
    if (prod) {
      await pool.query("UPDATE products SET selling_price = 10.00, cost_price = 5.00, stock_quantity = 10, deleted_at = NULL WHERE id = $1", [prod.id]);
    }
  }
}

async function createProduct(cookie, { sku, name, price = 10, cost = 5, stock_quantity = 10 }) {
  const res = await api("/api/products", {
    method: "POST",
    body: JSON.stringify({ sku, name, selling_price: price, cost_price: cost, stock_quantity, is_active: true }),
  }, cookie);
  return res;
}

async function changeStatus(orderId, status, cookie) {
  return api(`/api/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, cookie);
}

async function main() {
  try {
    console.log("=== SETUP ===");
    const regA = await register(EMAIL_A, "Order User A");
    const regB = await register(EMAIL_B, "Order User B");
    check("setup: register A 201", regA.status === 201);
    check("setup: register B 201", regB.status === 201);

    const loginA = await login(EMAIL_A);
    const cookieA = loginA.cookie;
    check("setup: login A 200", loginA.resp.status === 200);

    const loginB = await login(EMAIL_B);
    const cookieB = loginB.cookie;
    check("setup: login B 200", loginB.resp.status === 200);

    const userAId = await getUserId(EMAIL_A);
    const userBId = await getUserId(EMAIL_B);
    check("setup: got user ids", !!(userAId && userBId));

    const prodSku1 = `ORDTEST-1-${UNIQUE}`;
    const prodSku2 = `ORDTEST-2-${UNIQUE}`;
    const prodSku3 = `ORDTEST-3-${UNIQUE}`;
    const prodSku4 = `ORDTEST-4-${UNIQUE}`;
    const prodSku5 = `ORDTEST-5-${UNIQUE}`;
    const prodSku6 = `ORDTEST-6-${UNIQUE}`;
    const prodSkuDel = `DEL-${UNIQUE}`;

    await createProduct(cookieA, { sku: prodSku1, name: "P1" });
    await createProduct(cookieA, { sku: prodSku2, name: "P2" });
    await createProduct(cookieA, { sku: prodSku3, name: "P3" });
    await createProduct(cookieA, { sku: prodSku4, name: "P4" });
    await createProduct(cookieA, { sku: prodSku5, name: "P5" });
    await createProduct(cookieA, { sku: prodSku6, name: "P6" });
    await createProduct(cookieA, { sku: prodSkuDel, name: "DeletedP" });

    let custA = null;
    let custB = null;
    {
      const c = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "CustA", email: `ca-${UNIQUE}@example.com` }) }, cookieA);
      custA = c.data?.data || null;
    }
    {
      const c = await api("/api/customers", { method: "POST", body: JSON.stringify({ name: "CustB", email: `cb-${UNIQUE}@example.com` }) }, cookieB);
      custB = c.data?.data || null;
    }

    const p1 = await getProductBySku(prodSku1);
    const p2 = await getProductBySku(prodSku2);
    const p3 = await getProductBySku(prodSku3);
    const p4 = await getProductBySku(prodSku4);
    const p5 = await getProductBySku(prodSku5);
    const p6 = await getProductBySku(prodSku6);
    const pDel = await getProductBySku(prodSkuDel);

    console.log("\n=== (a) create order with 2 items ===");
    let orderAId = null;
    {
      const initialMov = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id IN ($1,$2)", [p1.id, p2.id])).rows[0].count;
      const initialStock1 = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p1.id])).rows[0].stock_quantity;
      const initialStock2 = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p2.id])).rows[0].stock_quantity;
      const res = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [
            { product_id: p1.id, quantity: 2 },
            { product_id: p2.id, quantity: 3 },
          ],
          total: 999999,
          discount: 0,
          notes: "test",
        }),
      }, cookieA);
      check("a1: 201", res.resp.status === 201, `status ${res.resp.status}`);
      orderAId = res.data?.data?.id;
      check("a2: has id", !!orderAId);
      const ord = res.data?.data;
      check("a3: status Pending", ord?.status === "Pending");
      check("a4: server calculated totals", ord?.subtotal > 0 && ord?.total > 0, `sub=${ord?.subtotal} tot=${ord?.total}`);
      check("a5: client total ignored", ord?.total !== 999999);
      const finalMov = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id IN ($1,$2)", [p1.id, p2.id])).rows[0].count;
      const finalStock1 = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p1.id])).rows[0].stock_quantity;
      const finalStock2 = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p2.id])).rows[0].stock_quantity;
      check("a6: stock unchanged", finalStock1 == initialStock1 && finalStock2 == initialStock2);
      check("a7: no movements", finalMov == initialMov);
    }

    console.log("\n=== (b) order_items snapshot price/cost ===");
    {
      const itemsBefore = (await pool.query("SELECT product_id, unit_price, unit_cost FROM order_items WHERE order_id=$1 ORDER BY product_id", [orderAId])).rows;
      const p1PriceBefore = itemsBefore.find(x => x.product_id == p1.id);
      await pool.query("UPDATE products SET selling_price = 999, cost_price = 888 WHERE id=$1", [p1.id]);
      const itemsAfter = (await pool.query("SELECT product_id, unit_price, unit_cost FROM order_items WHERE order_id=$1 ORDER BY product_id", [orderAId])).rows;
      const p1PriceAfter = itemsAfter.find(x => x.product_id == p1.id);
      check("b1: snapshots preserved", p1PriceBefore && p1PriceAfter && p1PriceBefore.unit_price == p1PriceAfter.unit_price && p1PriceBefore.unit_cost == p1PriceAfter.unit_cost);
      await pool.query("UPDATE products SET selling_price = 10, cost_price = 5 WHERE id=$1", [p1.id]);
    }

    console.log("\n=== (c) Pending->Confirmed reduces stock once ===");
    let orderCId = null;
    {
      await setProductStock(prodSku3, 10);
      await clearInventoryMovements(prodSku3);
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p3.id, quantity: 3 }],
        }),
      }, cookieA);
      orderCId = r.data?.data?.id;
      const stockBefore = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p3.id])).rows[0].stock_quantity;
      const movBefore = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p3.id])).rows[0].count;
      const conf = await changeStatus(orderCId, "Confirmed", cookieA);
      check("c1: confirm 200", conf.resp.status === 200, `status ${conf.resp.status}`);
      const stockAfter = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p3.id])).rows[0].stock_quantity;
      const movAfter = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p3.id])).rows[0].count;
      const movs = (await pool.query("SELECT movement_type, quantity_change FROM inventory_movements WHERE product_id=$1", [p3.id])).rows;
      const saleMov = movs.find(m => m.movement_type === "sale");
      check("c2: stock reduced", stockAfter == stockBefore - 3);
      check("c3: movements increased", Number(movAfter) == Number(movBefore) + 1);
      check("c4: sale movement with correct qty", !!saleMov && saleMov.quantity_change == -3);
      const ord = (await pool.query("SELECT stock_deducted, status FROM orders WHERE id=$1", [orderCId])).rows[0];
      check("c5: stock_deducted true, status Confirmed", ord.stock_deducted && ord.status === "Confirmed");
      const conf2 = await changeStatus(orderCId, "Confirmed", cookieA);
      check("c6: confirm again -> 400", conf2.resp.status === 400, `status ${conf2.resp.status}`);
      const stockFinal = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p3.id])).rows[0].stock_quantity;
      const movFinal = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p3.id])).rows[0].count;
      check("c7: stock/movements unchanged", stockFinal == stockAfter && movFinal == movAfter);
    }

    console.log("\n=== (d) confirm with insufficient stock -> 400, atomic ===");
    let orderDId = null;
    {
      await setProductStock(prodSku4, 10);
      await clearInventoryMovements(prodSku4);
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p4.id, quantity: 5 }],
        }),
      }, cookieA);
      orderDId = r.data?.data?.id;
      // Reduce stock to 2 after order creation, before confirm
      await setProductStock(prodSku4, 2);
      const stockBefore = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p4.id])).rows[0].stock_quantity;
      const movBefore = Number((await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p4.id])).rows[0].count);
      const conf = await changeStatus(orderDId, "Confirmed", cookieA);
      check("d1: insufficient -> 400", conf.resp.status === 400, `status ${conf.resp.status}`);
      const stockAfter = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p4.id])).rows[0].stock_quantity;
      const movAfter = Number((await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p4.id])).rows[0].count);
      check("d2: no deduction", stockAfter == stockBefore && movAfter == movBefore);
      const ord = (await pool.query("SELECT stock_deducted, status FROM orders WHERE id=$1", [orderDId])).rows[0];
      check("d3: still Pending", ord.status === "Pending" && !ord.stock_deducted);
    }

    console.log("\n=== (e) concurrent confirmations competing for last unit ===");
    let orderE1 = null;
    let orderE2 = null;
    {
      await setProductStock(prodSku5, 1);
      await clearInventoryMovements(prodSku5);
      const r1 = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p5.id, quantity: 1 }],
        }),
      }, cookieA);
      orderE1 = r1.data?.data?.id;
      const r2 = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p5.id, quantity: 1 }],
        }),
      }, cookieA);
      orderE2 = r2.data?.data?.id;
      const [res1, res2] = await Promise.all([
        changeStatus(orderE1, "Confirmed", cookieA),
        changeStatus(orderE2, "Confirmed", cookieA),
      ]);
      const statuses = [res1.resp.status, res2.resp.status];
      const successes = statuses.filter(s => s === 200).length;
      const failures = statuses.filter(s => s === 400).length;
      check("e1: exactly one succeeds", successes === 1 && failures === 1, `statuses ${statuses}`);
      const stockAfter = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p5.id])).rows[0].stock_quantity;
      check("e2: stock never negative", stockAfter >= 0);
    }

    console.log("\n=== (f) two concurrent confirmations of same order ===");
    let orderF = null;
    {
      await setProductStock(prodSku6, 5);
      await clearInventoryMovements(prodSku6);
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p6.id, quantity: 2 }],
        }),
      }, cookieA);
      orderF = r.data?.data?.id;
      const [res1, res2] = await Promise.all([
        changeStatus(orderF, "Confirmed", cookieA),
        changeStatus(orderF, "Confirmed", cookieA),
      ]);
      const statuses = [res1.resp.status, res2.resp.status];
      const okCount = statuses.filter(s => s === 200).length;
      check("f1: at most one 200", okCount <= 1);
      check("f2: both done", statuses.length === 2);
      const movs = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p6.id])).rows[0].count;
      check("f3: deducted once", Number(movs) === 1);
    }

    console.log("\n=== (g) cancel Confirmed -> restore; cancel Pending no change ===");
    let orderG1 = null;
    {
      await setProductStock(prodSku1, 10);
      await clearInventoryMovements(prodSku1);
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p1.id, quantity: 4 }],
        }),
      }, cookieA);
      orderG1 = r.data?.data?.id;
      await changeStatus(orderG1, "Confirmed", cookieA);
      const stockBeforeCancel = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p1.id])).rows[0].stock_quantity;
      const movBefore = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p1.id])).rows[0].count;
      const cancel = await changeStatus(orderG1, "Cancelled", cookieA);
      check("g1: cancel confirmed -> 200", cancel.resp.status === 200, `status ${cancel.resp.status}`);
      const stockAfter = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p1.id])).rows[0].stock_quantity;
      const movAfter = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p1.id])).rows[0].count;
      const movs = (await pool.query("SELECT movement_type, quantity_change FROM inventory_movements WHERE product_id=$1", [p1.id])).rows;
      const restore = movs.find(m => m.movement_type === "cancellation_restore");
      check("g2: stock restored", stockAfter == stockBeforeCancel + 4);
      check("g3: cancellation_restore movement", !!restore && restore.quantity_change == 4);
      check("g4: movements increased", Number(movAfter) == Number(movBefore) + 1);
      const cancel2 = await changeStatus(orderG1, "Cancelled", cookieA);
      check("g5: cancel again -> 400", cancel2.resp.status === 400, `status ${cancel2.resp.status}`);
      const stockFinal = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p1.id])).rows[0].stock_quantity;
      const movFinal = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p1.id])).rows[0].count;
      check("g6: no double restore", stockFinal == stockAfter && movFinal == movAfter);
    }
    {
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p2.id, quantity: 1 }],
        }),
      }, cookieA);
      const oid = r.data?.data?.id;
      const stockBefore = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p2.id])).rows[0].stock_quantity;
      const movBefore = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p2.id])).rows[0].count;
      const cancel = await changeStatus(oid, "Cancelled", cookieA);
      check("g7: cancel Pending -> 200", cancel.resp.status === 200, `status ${cancel.resp.status}`);
      const stockAfter = (await pool.query("SELECT stock_quantity FROM products WHERE id=$1", [p2.id])).rows[0].stock_quantity;
      const movAfter = (await pool.query("SELECT count(*) FROM inventory_movements WHERE product_id=$1", [p2.id])).rows[0].count;
      check("g8: no stock change if cancelled pending", cancel.resp.status === 200 ? stockAfter == stockBefore && movAfter == movBefore : true);
    }

    console.log("\n=== (h) invalid transitions ===");
    {
      const r1 = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }),
      }, cookieA);
      const oid = r1.data?.data?.id;
      await changeStatus(oid, "Confirmed", cookieA);
      await changeStatus(oid, "Completed", cookieA);
      const t1 = await changeStatus(oid, "Pending", cookieA);
      check("h1: Completed->Pending 400", t1.resp.status === 400, `status ${t1.resp.status}`);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      await changeStatus(oid, "Cancelled", cookieA);
      const t = await changeStatus(oid, "Confirmed", cookieA);
      check("h2: Cancelled->Confirmed 400", t.resp.status === 400, `status ${t.resp.status}`);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      const t = await changeStatus(oid, "Completed", cookieA);
      check("h3: Pending->Completed 400", t.resp.status === 400, `status ${t.resp.status}`);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      await changeStatus(oid, "Confirmed", cookieA);
      await changeStatus(oid, "Completed", cookieA);
      const t = await changeStatus(oid, "Cancelled", cookieA);
      check("h4: Completed->Cancelled 400", t.resp.status === 400, `status ${t.resp.status}`);
    }

    console.log("\n=== (i) Completed sets completed_at ===");
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      await changeStatus(oid, "Confirmed", cookieA);
      await changeStatus(oid, "Completed", cookieA);
      const ord = (await pool.query("SELECT completed_at FROM orders WHERE id=$1", [oid])).rows[0];
      check("i1: completed_at set", !!ord.completed_at);
    }

    console.log("\n=== (j) payment states ===");
    let oidPay = null;
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 2 }] }) }, cookieA);
      oidPay = r.data?.data?.id;
      const ord = (await pool.query("SELECT payment_status FROM orders WHERE id=$1", [oidPay])).rows[0];
      check("j1: 0 -> Unpaid", ord.payment_status === "Unpaid");
    }
    {
      const pay = await api(`/api/orders/${oidPay}/payment`, { method: "PATCH", body: JSON.stringify({ amount_paid: 5 }) }, cookieA);
      check("j2: partial ok (likely 200)", pay.resp.status === 200 || pay.resp.status === 201, `status ${pay.resp.status}`);
      const ord = (await pool.query("SELECT payment_status, amount_paid FROM orders WHERE id=$1", [oidPay])).rows[0];
      check("j3: Partially Paid", ord.payment_status === "Partially Paid");
    }
    {
      const pay = await api(`/api/orders/${oidPay}/payment`, { method: "PATCH", body: JSON.stringify({ amount_paid: 20 }) }, cookieA);
      check("j4: full pay ok", pay.resp.status === 200 || pay.resp.status === 201, `status ${pay.resp.status}`);
      const ord = (await pool.query("SELECT payment_status FROM orders WHERE id=$1", [oidPay])).rows[0];
      check("j5: Paid", ord.payment_status === "Paid");
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      const pay = await api(`/api/orders/${oid}/payment`, { method: "PATCH", body: JSON.stringify({ amount_paid: 100 }) }, cookieA);
      check("j6: overpay -> 400", pay.resp.status === 400, `status ${pay.resp.status}`);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      await changeStatus(oid, "Cancelled", cookieA);
      const pay = await api(`/api/orders/${oid}/payment`, { method: "PATCH", body: JSON.stringify({ amount_paid: 1 }) }, cookieA);
      check("j7: cancelled payment -> 400", pay.resp.status === 400, `status ${pay.resp.status}`);
    }

    console.log("\n=== (k) edit items only in Pending ===");
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      const oldTotal = (await pool.query("SELECT total FROM orders WHERE id=$1", [oid])).rows[0].total;
      const edit = await api(`/api/orders/${oid}`, { method: "PUT", body: JSON.stringify({ items: [{ product_id: p1.id, quantity: 3 }] }) }, cookieA);
      check("k1: edit Pending ok", edit.resp.status === 200, `status ${edit.resp.status}`);
      const newTotal = (await pool.query("SELECT total FROM orders WHERE id=$1", [oid])).rows[0].total;
      check("k2: totals recalculated", newTotal !== oldTotal);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      const oid = r.data?.data?.id;
      await changeStatus(oid, "Confirmed", cookieA);
      const edit = await api(`/api/orders/${oid}`, { method: "PUT", body: JSON.stringify({ items: [{ product_id: p1.id, quantity: 5 }] }) }, cookieA);
      check("k3: edit after confirm -> 400", edit.resp.status === 400, `status ${edit.resp.status}`);
    }

    console.log("\n=== (l) validation: discount>subtotal, qty issues, empty items ===");
    {
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: custA.id,
          items: [{ product_id: p1.id, quantity: 2 }],
          discount: 1000,
        }),
      }, cookieA);
      check("l1: discount>subtotal -> 400", r.resp.status === 400, `status ${r.resp.status}`);
    }
    {
      const cases = [
        [{ product_id: p1.id, quantity: 0 }],
        [{ product_id: p1.id, quantity: -1 }],
      ];
      for (let i = 0; i < cases.length; i++) {
        const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: cases[i] }) }, cookieA);
        check(`l2${i}: qty invalid -> 400`, r.resp.status === 400, `status ${r.resp.status}`);
      }
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1.5 }] }) }, cookieA);
      check("l3: decimal qty -> 400 (if ints required)", r.resp.status === 400, `status ${r.resp.status}`);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [] }) }, cookieA);
      check("l4: empty items -> 400", r.resp.status === 400, `status ${r.resp.status}`);
    }

    console.log("\n=== (m) isolation ===");
    let orderAOwner = null;
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) }, cookieA);
      orderAOwner = r.data?.data?.id;
    }
    {
      const r = await api(`/api/orders/${orderAOwner}`, {}, cookieB);
      check("m1: B GET A -> 404", r.resp.status === 404, `status ${r.resp.status}`);
    }
    {
      const r = await api(`/api/orders/${orderAOwner}`, { method: "PUT", body: JSON.stringify({ items: [{ product_id: p1.id, quantity: 1 }], notes: "x" }) }, cookieB);
      check("m2: B PUT A -> 404", r.resp.status === 404, `status ${r.resp.status}`);
    }
    {
      const r = await api(`/api/orders/${orderAOwner}`, { method: "PATCH", body: JSON.stringify({ notes: "x" }) }, cookieB);
      check("m3: B PATCH A -> 404", r.resp.status === 404, `status ${r.resp.status}`);
    }
    {
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }),
      }, cookieB);
      check("m4: B cannot use A's customer_id -> 404/400", r.resp.status === 404 || r.resp.status === 400, `status ${r.resp.status}`);
    }
    {
    {
      const rB = await createProduct(cookieB, { sku: `BTEST-${UNIQUE}`, name: "BProduct", price: 10, cost: 5, stock_quantity: 10 });
      const pB = await getProductBySku(`BTEST-${UNIQUE}`);
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customer_id: custB.id, items: [{ product_id: pB.id, quantity: 1 }] }),
      }, cookieB);
      if (r.resp.status !== 201) {
        check("m5: B can create with own cust; setup ok", false, `status ${r.resp.status}`);
      } else {
        check("m5: B can create with own cust", true);
      }
    }
    }
    {
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customer_id: custB.id, items: [{ product_id: p1.id, quantity: 1 }] }),
      }, cookieB);
      const r2 = await api("/api/orders", { method: "GET" }, cookieB);
      let hasA = false;
      if (r2.data && Array.isArray(r2.data.data)) {
        hasA = r2.data.data.some(o => o.id === orderAOwner);
      }
      check("m6: B list excludes A", !hasA);
    }

    console.log("\n=== (n) soft-deleted product cannot be ordered; unauth 401 ===");
    {
      await pool.query("UPDATE products SET deleted_at = NOW() WHERE id=$1", [pDel.id]);
      const r = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: pDel.id, quantity: 1 }] }),
      }, cookieA);
      check("n1: soft-deleted product cannot be ordered -> 400", r.resp.status === 400, `status ${r.resp.status}`);
      await pool.query("UPDATE products SET deleted_at = NULL WHERE id=$1", [pDel.id]);
    }
    {
      const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p1.id, quantity: 1 }] }) });
      check("n2: unauth create -> 401", r.resp.status === 401, `status ${r.resp.status}`);
      const r2 = await api("/api/orders", { method: "GET" });
      check("n3: unauth list -> 401", r2.resp.status === 401, `status ${r2.resp.status}`);
    }

    console.log("\n=== (o) stock_quantity equals sum of inventory_movements.quantity_change for test products ===");
    {
      const r = await createProduct(cookieA, { sku: `ORDTEST-7-${UNIQUE}`, name: "P7", price: 10, cost: 5, stock_quantity: 10 });
      const p7 = await getProductBySku(`ORDTEST-7-${UNIQUE}`);
      if (p7) {
        const sumBefore = Number((await pool.query("SELECT COALESCE(SUM(quantity_change), 0) as s FROM inventory_movements WHERE product_id=$1", [p7.id])).rows[0].s);
        check("o1: initial_stock movement matches stock", sumBefore == 10, `sum=${sumBefore} stock=10`);
        const o = await api("/api/orders", {
          method: "POST",
          body: JSON.stringify({ customer_id: custA.id, items: [{ product_id: p7.id, quantity: 3 }] }),
        }, cookieA);
        const oid = o.data?.data?.id;
        await changeStatus(oid, "Confirmed", cookieA);
        const prodAfter = await getProductBySku(`ORDTEST-7-${UNIQUE}`);
        const sumAfter = Number((await pool.query("SELECT COALESCE(SUM(quantity_change), 0) as s FROM inventory_movements WHERE product_id=$1", [p7.id])).rows[0].s);
        check("o2: after sale, sum matches stock", sumAfter == Number(prodAfter.stock_quantity), `sum=${sumAfter} stock=${prodAfter.stock_quantity}`);
        await pool.query("UPDATE products SET deleted_at = NULL WHERE id=$1", [p7.id]);
      }
    }

    console.log("\n=== CLEANUP ===");
    await clearOrdersTestData(EMAIL_A, EMAIL_B, [prodSku1, prodSku2, prodSku3, prodSku4, prodSku5, prodSku6, prodSkuDel, `ORDTEST-7-${UNIQUE}`, `BTEST-${UNIQUE}`]);

  } catch (err) {
    console.error("ERROR:", err);
    failed++;
  } finally {
    await pool.end();
    console.log(`\n=== RESULTS ===`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
