// backend/tests/products.test.js
// Plain Node test script (no extra libraries). Runs against the
// server at http://localhost:3000 — start it first (npm run dev).
// Uses unique emails (Date.now()) so it can be re-run safely.

const BASE = "http://localhost:3000";
const UNIQUE = Date.now();

const EMAIL_A = `prod-a-${UNIQUE}@example.test`;
const EMAIL_B = `prod-b-${UNIQUE}@example.test`;
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

// Extract the "microbiz.sid=..." pair from Set-Cookie headers.
function extractSessionCookie(setCookieHeaders) {
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
    // non-JSON response
  }
  return { resp, data };
}

async function main() {
  // Setup: register two users A and B, each with their own session cookie
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

  // =================================
  // TEST 1: Create product -> 201
  // =================================
  let productIdA = null;
  {
    const { resp, data } = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Product A",
        sku: `SKU-A-${UNIQUE}`,
        selling_price: 19.99,
        cost_price: 9.50,
        stock_quantity: 10,
      }),
    }, cookieA);

    check("1: create product returns 201", resp.status === 201, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("1: create product returns product data", data && data.success === true, JSON.stringify(data));
    check("1: product has name", data && data.data && data.data.name === "Test Product A", JSON.stringify(data));
    check("1: product has stock_quantity 10", data && data.data && data.data.stock_quantity === 10, JSON.stringify(data));
    if (data && data.data) productIdA = data.data.id;
    check("1: product id is set", productIdA !== null);
  }

  // =================================
  // TEST 2: initial_stock movement exists
  // =================================
  {
    const { resp, data } = await api(`/api/products/${productIdA}/movements`, {}, cookieA);
    check("2: GET movements returns 200", resp.status === 200, `status ${resp.status}`);
    check("2: movements list is not empty", data && data.data && data.data.length > 0, JSON.stringify(data));

    // Check that an initial_stock movement exists
    const initialStockMovement = data && data.data && data.data.find((m) => m.movement_type === "initial_stock");
    check("2: initial_stock movement exists", initialStockMovement !== undefined, JSON.stringify(data?.data));
    check("2: initial_stock quantity matches", initialStockMovement && initialStockMovement.quantity_change === 10, JSON.stringify(initialStockMovement));
    check("2: initial_stock stock_after matches", initialStockMovement && initialStockMovement.stock_after === 10, JSON.stringify(initialStockMovement));
  }

  // =================================
  // TEST 3: Duplicate SKU -> 409
  // =================================
  {
    const { resp, data } = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Duplicate SKU Product",
        sku: `SKU-A-${UNIQUE}`,
        selling_price: 5.00,
        cost_price: 2.00,
        stock_quantity: 3,
      }),
    }, cookieA);

    check("3: duplicate SKU returns 409", resp.status === 409, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("3: duplicate SKU message is correct", data && data.message === "SKU already exists", JSON.stringify(data));
  }

  // =================================
  // TEST 4: Negative price -> 400
  // =================================
  {
    const { resp, data } = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Bad Price Product",
        sku: `SKU-BAD-${UNIQUE}`,
        selling_price: -5.00,
        cost_price: 2.00,
        stock_quantity: 3,
      }),
    }, cookieA);

    check("4: negative price returns 400", resp.status === 400, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("4: validation error has field details", data && data.details && data.details.fields && data.details.fields.selling_price, JSON.stringify(data));
  }

  // =================================
  // TEST 5: List with search/filter/pagination
  // =================================
  {
    // Create a few more products for filtering tests
    await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Electronics Widget",
        sku: `SKU-ELEC-${UNIQUE}`,
        category: "Electronics",
        selling_price: 99.99,
        cost_price: 50.00,
        stock_quantity: 5,
        low_stock_threshold: 10,
      }),
    }, cookieA);

    await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Clothing Item",
        sku: `SKU-CLTH-${UNIQUE}`,
        category: "Clothing",
        selling_price: 25.00,
        cost_price: 12.00,
        stock_quantity: 20,
        low_stock_threshold: 5,
      }),
    }, cookieA);

    // Test search
    const searchResult = await api("/api/products?search=Electronics", {}, cookieA);
    check("5: search returns 200", searchResult.resp.status === 200, `status ${searchResult.resp.status}`);
    check("5: search finds Electronics", searchResult.data && searchResult.data.data && searchResult.data.data.length >= 1, JSON.stringify(searchResult.data));

    // Test category filter
    const catResult = await api("/api/products?category=Clothing", {}, cookieA);
    check("5: category filter returns 200", catResult.resp.status === 200, `status ${catResult.resp.status}`);
    check("5: category filter works", catResult.data && catResult.data.data && catResult.data.data.length >= 1, JSON.stringify(catResult.data));

    // Test pagination
    const pageResult = await api("/api/products?page=1&limit=2", {}, cookieA);
    check("5: pagination returns 200", pageResult.resp.status === 200, `status ${pageResult.resp.status}`);
    check("5: pagination limits results to 2", pageResult.data && pageResult.data.data && pageResult.data.data.length <= 2, JSON.stringify(pageResult.data));
    check("5: pagination has total", pageResult.data && pageResult.data.pagination && pageResult.data.pagination.total !== undefined, JSON.stringify(pageResult.data));

    // Test categories endpoint
    const categoriesResult = await api("/api/products/categories", {}, cookieA);
    check("5: categories endpoint returns 200", categoriesResult.resp.status === 200, `status ${categoriesResult.resp.status}`);
    check("5: categories includes Electronics", categoriesResult.data && categoriesResult.data.data && categoriesResult.data.data.includes("Electronics"), JSON.stringify(categoriesResult.data));
    check("5: categories includes Clothing", categoriesResult.data && categoriesResult.data.data && categoriesResult.data.data.includes("Clothing"), JSON.stringify(categoriesResult.data));
  }

  // =================================
  // TEST 6: Update works and does NOT change stock
  // =================================
  {
    const { resp, data } = await api(`/api/products/${productIdA}`, {
      method: "PUT",
      body: JSON.stringify({
        name: "Updated Product A Name",
        selling_price: 29.99,
      }),
    }, cookieA);

    check("6: update returns 200", resp.status === 200, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("6: updated name", data && data.data && data.data.name === "Updated Product A Name", JSON.stringify(data));
    check("6: updated selling_price", data && data.data && data.data.selling_price === 29.99, JSON.stringify(data));
    check("6: stock unchanged after update", data && data.data && data.data.stock_quantity === 10, JSON.stringify(data));

    // Test that stock_quantity is rejected in update
    const { resp: stockResp, data: stockData } = await api(`/api/products/${productIdA}`, {
      method: "PUT",
      body: JSON.stringify({ stock_quantity: 999 }),
    }, cookieA);

    check("6: update with stock_quantity returns 400", stockResp.status === 400, `status ${stockResp.status}, body: ${JSON.stringify(stockData)}`);
    check("6: update with stock_quantity has field error", stockData && stockData.details && stockData.details.fields && stockData.details.fields.stock_quantity, JSON.stringify(stockData));
  }

  // =================================
  // TEST 7: Adjust +10 -> stock updated and movement recorded
  // =================================
  {
    const { resp, data } = await api(`/api/products/${productIdA}/stock-adjustments`, {
      method: "POST",
      body: JSON.stringify({
        movement_type: "purchase",
        quantity_change: 10,
        reason: "New shipment arrived",
      }),
    }, cookieA);

    check("7: adjust stock returns 200", resp.status === 200, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("7: stock updated to 20", data && data.data && data.data.stock_quantity === 20, JSON.stringify(data));

    // Verify movement was recorded
    const movementsResult = await api(`/api/products/${productIdA}/movements`, {}, cookieA);
    check("7: movements include purchase", movementsResult.data && movementsResult.data.data, JSON.stringify(movementsResult.data));
    const purchaseMovement = movementsResult.data.data.find((m) => m.movement_type === "purchase" && m.quantity_change === 10);
    check("7: purchase movement recorded", purchaseMovement !== undefined, JSON.stringify(movementsResult.data?.data?.name));
  }

  // =================================
  // TEST 8: Adjust that would go negative -> 400 and stock unchanged
  // =================================
  {
    const { resp, data } = await api(`/api/products/${productIdA}/stock-adjustments`, {
      method: "POST",
      body: JSON.stringify({
        movement_type: "adjustment",
        quantity_change: -100,
        reason: "Test overdraft adjustment",
      }),
    }, cookieA);

    check("8: overdraft adjustment returns 400", resp.status === 400, `status ${resp.status}, body: ${JSON.stringify(data)}`);
    check("8: overdraft message is 'Insufficient stock'", data && data.message === "Insufficient stock", JSON.stringify(data));

     // Stock should still be 20
     const productResult = await api(`/api/products/${productIdA}`, {}, cookieA);
     check("8: stock unchanged after failed adjustment", productResult.data && productResult.data.data && productResult.data.data.stock_quantity === 20, JSON.stringify(productResult.data));
   }

   // =================================
   // TEST 8a: Adjust purchase WITH reason -> reason preserved
   // =================================
   {
     const { resp, data } = await api(`/api/products/${productIdA}/stock-adjustments`, {
       method: "POST",
       body: JSON.stringify({
         movement_type: "purchase",
         quantity_change: 5,
         reason: "Supplier delivery",
       }),
     }, cookieA);

     check("8a: adjust stock with reason returns 200", resp.status === 200, `status ${resp.status}, body: ${JSON.stringify(data)}`);
     check("8a: stock updated to 25", data && data.data && data.data.stock_quantity === 25, JSON.stringify(data));

     // Verify movement was recorded with correct reason
     const movementsResult = await api(`/api/products/${productIdA}/movements`, {}, cookieA);
     check("8a: movements include purchase", movementsResult.data && movementsResult.data.data, JSON.stringify(movementsResult.data));
     const purchaseMovement = movementsResult.data.data.find((m) => m.movement_type === "purchase" && m.quantity_change === 5);
     check("8a: purchase movement recorded with correct reason", purchaseMovement && purchaseMovement.reason === "Supplier delivery", `reason: ${JSON.stringify(purchaseMovement?.reason)}`);
   }

   // =================================
   // TEST 8b: Adjust purchase WITHOUT reason -> default reason used
   // =================================
   {
     const { resp, data } = await api(`/api/products/${productIdA}/stock-adjustments`, {
       method: "POST",
       body: JSON.stringify({
         movement_type: "purchase",
         quantity_change: 3,
         // No reason provided
       }),
     }, cookieA);

     check("8b: adjust stock without reason returns 200", resp.status === 200, `status ${resp.status}, body: ${JSON.stringify(data)}`);
     check("8b: stock updated to 28", data && data.data && data.data.stock_quantity === 28, JSON.stringify(data));

     // Verify movement was recorded with default reason
     const movementsResult = await api(`/api/products/${productIdA}/movements`, {}, cookieA);
     check("8b: movements include purchase", movementsResult.data && movementsResult.data.data, JSON.stringify(movementsResult.data));
     const purchaseMovement = movementsResult.data.data.find((m) => m.movement_type === "purchase" && m.quantity_change === 3);
     check("8b: purchase movement recorded with default reason", purchaseMovement && purchaseMovement.reason === "Stock purchase", `reason: ${JSON.stringify(purchaseMovement?.reason)}`);
   }

   // =================================
   // TEST 9: Two concurrent adjustments of -1 on stock 1 -> exactly one succeeds
  // =================================
  {
    // Create a product with stock 1
    const { resp: createResp, data: createData } = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "Concurrent Stock Test",
        sku: `SKU-CONC-${UNIQUE}`,
        selling_price: 10.00,
        cost_price: 5.00,
        stock_quantity: 1,
      }),
    }, cookieA);

    check("9: create product for concurrent test returns 201", createResp.status === 201, `status ${createResp.status}`);

    if (createData && createData.data) {
      const productId = createData.data.id;

      // Send two concurrent -1 adjustments
      const adj1 = api(`/api/products/${productId}/stock-adjustments`, {
        method: "POST",
        body: JSON.stringify({
          movement_type: "adjustment",
          quantity_change: -1,
          reason: "Concurrent test 1",
        }),
      }, cookieA);

      const adj2 = api(`/api/products/${productId}/stock-adjustments`, {
        method: "POST",
        body: JSON.stringify({
          movement_type: "adjustment",
          quantity_change: -1,
          reason: "Concurrent test 2",
        }),
      }, cookieA);

      const results = await Promise.all([adj1, adj2]);
      const successCount = results.filter((r) => r.resp.status === 200).length;
      const failureCount = results.filter((r) => r.resp.status === 400).length;

      check("9: exactly one concurrent adjustment succeeds", successCount === 1, `successCount=${successCount}`);
      check("9: exactly one concurrent adjustment fails", failureCount === 1, `failureCount=${failureCount}`);

      // Verify final stock is 0 (never negative)
      const productResult = await api(`/api/products/${productId}`, {}, cookieA);
      check("9: stock is 0 after concurrent adjustments", productResult.data && productResult.data.data && productResult.data.data.stock_quantity === 0, JSON.stringify(productResult.data));
    }
  }

  // =================================
  // TEST 10: Soft delete -> product gone from list and GET returns 404
  // =================================
  {
    // First create a product to delete
    const { resp: createResp, data: createData } = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name: "To Delete Product",
        sku: `SKU-DEL-${UNIQUE}`,
        selling_price: 15.00,
        cost_price: 7.00,
        stock_quantity: 5,
      }),
    }, cookieA);

    check("10: create product for deletion returns 201", createResp.status === 201, `status ${createResp.status}`);

    if (createData && createData.data) {
      const deleteId = createData.data.id;

      // Soft delete
      const { resp: delResp, data: delData } = await api(`/api/products/${deleteId}`, {
        method: "DELETE",
      }, cookieA);

      check("10: delete returns 200", delResp.status === 200, `status ${delResp.status}, body: ${JSON.stringify(delData)}`);

      // Check product is gone from list
      const listResult = await api("/api/products", {}, cookieA);
      const deletedProduct = listResult.data && listResult.data.data && listResult.data.data.find((p) => p.id === deleteId);
      check("10: deleted product not in list", deletedProduct === undefined, `found in list: ${JSON.stringify(deletedProduct)}`);

      // Check GET returns 404
      const { resp: getResp } = await api(`/api/products/${deleteId}`, {}, cookieA);
      check("10: GET deleted product returns 404", getResp.status === 404, `status ${getResp.status}`);

      // Check GET movements returns 404 (product not found)
      const { resp: movResp } = await api(`/api/products/${deleteId}/movements`, {}, cookieA);
      check("10: GET movements of deleted product returns 404", movResp.status === 404, `status ${movResp.status}`);
    }
  }

  // =================================
  // TEST 11: Data isolation - user B cannot access user A's data
  // =================================
  {
    // B tries to GET A's product -> 404
    const { resp: getResp } = await api(`/api/products/${productIdA}`, {}, cookieB);
    check("11: user B GET user A's product returns 404", getResp.status === 404, `status ${getResp.status}`);

    // B tries to PUT A's product -> 404
    const { resp: putResp } = await api(`/api/products/${productIdA}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Hacked Name" }),
    }, cookieB);
    check("11: user B PUT user A's product returns 404", putResp.status === 404, `status ${putResp.status}`);

    // B tries to DELETE A's product -> 404
    const { resp: delResp } = await api(`/api/products/${productIdA}`, {
      method: "DELETE",
    }, cookieB);
    check("11: user B DELETE user A's product returns 404", delResp.status === 404, `status ${delResp.status}`);

    // B tries to adjust stock on A's product -> 404
    const { resp: adjResp } = await api(`/api/products/${productIdA}/stock-adjustments`, {
      method: "POST",
      body: JSON.stringify({
        movement_type: "purchase",
        quantity_change: 50,
        reason: "Hacked stock adjustment",
      }),
    }, cookieB);
    check("11: user B adjust stock on A's product returns 404", adjResp.status === 404, `status ${adjResp.status}`);

    // B tries to GET A's product movements -> 404 or empty
    const { resp: movResp, data: movData } = await api(`/api/products/${productIdA}/movements`, {}, cookieB);
    check("11: user B GET A's movements returns 404 or empty", movResp.status === 404 || (movData && movData.data && movData.data.length === 0), `status ${movResp.status}, body: ${JSON.stringify(movData)}`);

    // B's product list should NOT contain A's product
    const listResult = await api("/api/products", {}, cookieB);
    const aProductInList = listResult.data && listResult.data.data && listResult.data.data.find((p) => p.id === productIdA);
    check("11: user A's product not in user B's list", aProductInList === undefined, `found in B's list: ${JSON.stringify(aProductInList)}`);
  }

  // =================================
  // TEST 12: Unauthenticated request -> 401
  // =================================
  {
    const { resp } = await api("/api/products", {}, null);
    check("12: unauthenticated GET /api/products returns 401", resp.status === 401, `status ${resp.status}`);

    const { resp: postResp } = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({ name: "Should Fail", selling_price: 10, cost_price: 5 }),
    }, null);
    check("12: unauthenticated POST /api/products returns 401", postResp.status === 401, `status ${postResp.status}`);

    const { resp: invResp } = await api("/api/inventory/movements", {}, null);
    check("12: unauthenticated GET /api/inventory/movements returns 401", invResp.status === 401, `status ${invResp.status}`);
  }

  // =================================
  // TEST 13: Categories and low-stock endpoints work
  // =================================
  {
    const { resp } = await api("/api/products/categories", {}, cookieA);
    check("13: categories endpoint returns 200", resp.status === 200, `status ${resp.status}`);

    const { resp: lowStockResp } = await api("/api/products/low-stock", {}, cookieA);
    check("13: low-stock endpoint returns 200", lowStockResp.status === 200, `status ${lowStockResp.status}`);
  }

  // =================================
  // TEST 14: Invalid product ID -> 400
  // =================================
  {
    const { resp } = await api("/api/products/abc", {}, cookieA);
    check("14: invalid product ID returns 400", resp.status === 400, `status ${resp.status}`);

    const { resp: negResp } = await api("/api/products/-1", {}, cookieA);
    check("14: negative product ID returns 400", negResp.status === 400, `status ${negResp.status}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test run failed:", err.message);
  process.exit(1);
});