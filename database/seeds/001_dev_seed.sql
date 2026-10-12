-- ============================================================================
-- Development seed data for MicroBiz
-- Safe to re-run: checks for existing demo user and skips if present.
-- Run after migrations: npm run db:seed
--
-- INVARIANT: For every product, products.stock_quantity ==
--   SUM(inventory_movements.quantity_change) for that product, and each
--   movement's stock_after equals the running balance (ordered by id).
-- ============================================================================

-- Demo user credentials
-- Email: demo@microbiz.test
-- password_hash: 'SEED_PLACEHOLDER_NOT_A_REAL_HASH'
-- NOTE: Real authentication (bcrypt, login) is implemented in Phase 4.
-- This placeholder hash will NOT work for actual login.

DO $$
DECLARE
    v_user_id BIGINT;
    v_cust_alice_id BIGINT;
    v_cust_bob_id BIGINT;
    v_cust_carol_id BIGINT;
    v_cust_david_id BIGINT;
    v_prod_wh_id BIGINT; v_prod_wh_price NUMERIC; v_prod_wh_cost NUMERIC;
    v_prod_usb_id BIGINT; v_prod_usb_price NUMERIC; v_prod_usb_cost NUMERIC;
    v_prod_mk_id BIGINT; v_prod_mk_price NUMERIC; v_prod_mk_cost NUMERIC;
    v_prod_ts_id BIGINT; v_prod_ts_price NUMERIC; v_prod_ts_cost NUMERIC;
    v_prod_jn_id BIGINT; v_prod_jn_price NUMERIC; v_prod_jn_cost NUMERIC;
    v_prod_hd_id BIGINT; v_prod_hd_price NUMERIC; v_prod_hd_cost NUMERIC;
    v_prod_cp_id BIGINT; v_prod_cp_price NUMERIC; v_prod_cp_cost NUMERIC;
    v_prod_dl_id BIGINT; v_prod_dl_price NUMERIC; v_prod_dl_cost NUMERIC;
    v_order_id BIGINT;
    v_subtotal NUMERIC;
    v_total NUMERIC;
BEGIN
    -- Check if demo user already exists
    SELECT id INTO v_user_id FROM users WHERE email = 'demo@microbiz.test';

    IF v_user_id IS NOT NULL THEN
        RAISE NOTICE 'Demo user already exists (id=%); skipping seed.', v_user_id;
        RETURN;
    END IF;

    -- 1. Create demo user
    INSERT INTO users (full_name, email, password_hash)
    VALUES ('Demo User', 'demo@microbiz.test', 'SEED_PLACEHOLDER_NOT_A_REAL_HASH')
    RETURNING id INTO v_user_id;

    RAISE NOTICE 'Created demo user with id=%', v_user_id;

    -- 2. Business settings for demo user
    INSERT INTO business_settings (user_id, business_name, email, phone, address, currency_code, default_low_stock_threshold)
    VALUES (v_user_id, 'MicroBiz Demo Store', 'demo@microbiz.test', '+1-555-0100', '123 Main St, Springfield, IL 62701', 'USD', 5);

    -- 3. Products (8 products across 3 categories)
    -- Stock quantities are chosen so the final values after all movements
    -- keep 3 products in low-stock territory:
    --   USB-C Hub 7-in-1  -> final stock 3 (<= threshold 5)
    --   Slim Fit Jeans    -> final stock 2 (<= threshold 5)
    --   LED Desk Lamp     -> final stock 1 (<= threshold 2)
    -- Electronics
    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'Wireless Headphones', 'ELEC-WH-001', 'Bluetooth over-ear headphones with noise cancellation', 'Electronics', 129.99, 65.00, 8, 5, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_wh_id, v_prod_wh_price, v_prod_wh_cost;

    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'USB-C Hub 7-in-1', 'ELEC-USB-002', '7-port USB-C hub with HDMI, USB-A, SD card reader', 'Electronics', 49.99, 22.00, 3, 5, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_usb_id, v_prod_usb_price, v_prod_usb_cost;

    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'Mechanical Keyboard', 'ELEC-MK-003', 'RGB mechanical keyboard with blue switches', 'Electronics', 89.99, 45.00, 12, 5, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_mk_id, v_prod_mk_price, v_prod_mk_cost;

    -- Clothing
    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'Organic Cotton T-Shirt', 'CLTH-TS-001', '100% organic cotton crew neck t-shirt', 'Clothing', 24.99, 8.00, 25, 10, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_ts_id, v_prod_ts_price, v_prod_ts_cost;

    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'Slim Fit Jeans', 'CLTH-JN-002', 'Dark wash slim fit jeans', 'Clothing', 59.99, 20.00, 2, 5, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_jn_id, v_prod_jn_price, v_prod_jn_cost;

    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'Hooded Sweatshirt', 'CLTH-HD-003', 'Fleece-lined hooded sweatshirt', 'Clothing', 44.99, 18.00, 15, 5, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_hd_id, v_prod_hd_price, v_prod_hd_cost;

    -- Home & Garden
    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'Ceramic Planter Set', 'HOME-CP-001', 'Set of 3 ceramic planters with drainage holes', 'Home & Garden', 34.99, 14.00, 10, 3, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_cp_id, v_prod_cp_price, v_prod_cp_cost;

    INSERT INTO products (user_id, name, sku, description, category, selling_price, cost_price, stock_quantity, low_stock_threshold, image_url)
    VALUES (v_user_id, 'LED Desk Lamp', 'HOME-DL-002', 'Adjustable LED desk lamp with touch dimmer', 'Home & Garden', 39.99, 16.00, 1, 2, NULL)
    RETURNING id, selling_price, cost_price INTO v_prod_dl_id, v_prod_dl_price, v_prod_dl_cost;

    -- 4. Initial stock movements for all products.
    -- initial_stock = final stock_quantity + total future sales (so the sum
    -- of all movements for each product equals stock_quantity).
    -- Movements are inserted in order so stock_after = running balance.
    --   WH: 8 + 1  = 9 initial  (after sale: 8)
    --   USB: 3 + 2 = 5 initial  (after sale: 3)
    --   MK: 12 + 1 = 13 initial  (after sale: 12)
    --   TS: 25 + 3 = 28 initial  (after sale: 25)
    --   JN: 2 + 1  = 3 initial   (after sale: 2)
    --   HD: 15 + 2 = 17 initial  (after sale: 15)
    --   CP: 10 + 2 = 12 initial  (after sale: 10)
    --   DL: 1 + 1  = 2 initial   (after sale: 1, after restore: 2... but final stock=1)
    --   For DL the sale (-1) and restore (+1) cancel out, so initial_stock = 1.
    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES
        (v_user_id, v_prod_wh_id, NULL, 'initial_stock', 9, 9, 'Initial stock on product creation'),
        (v_user_id, v_prod_usb_id, NULL, 'initial_stock', 5, 5, 'Initial stock on product creation'),
        (v_user_id, v_prod_mk_id, NULL, 'initial_stock', 13, 13, 'Initial stock on product creation'),
        (v_user_id, v_prod_ts_id, NULL, 'initial_stock', 28, 28, 'Initial stock on product creation'),
        (v_user_id, v_prod_jn_id, NULL, 'initial_stock', 3, 3, 'Initial stock on product creation'),
        (v_user_id, v_prod_hd_id, NULL, 'initial_stock', 17, 17, 'Initial stock on product creation'),
        (v_user_id, v_prod_cp_id, NULL, 'initial_stock', 12, 12, 'Initial stock on product creation'),
        (v_user_id, v_prod_dl_id, NULL, 'initial_stock', 1, 1, 'Initial stock on product creation');

    -- 5. Customers (4 customers)
    INSERT INTO customers (user_id, name, email, phone, address, notes)
    VALUES (v_user_id, 'Alice Johnson', 'alice@example.com', '+1-555-0101', '10 Oak Ave, Springfield, IL 62701', 'Prefers email communication')
    RETURNING id INTO v_cust_alice_id;

    INSERT INTO customers (user_id, name, email, phone, address, notes)
    VALUES (v_user_id, 'Bob Smith', 'bob@example.com', '+1-555-0102', '25 Pine Rd, Springfield, IL 62702', 'Regular wholesale buyer')
    RETURNING id INTO v_cust_bob_id;

    INSERT INTO customers (user_id, name, email, phone, address, notes)
    VALUES (v_user_id, 'Carol Williams', 'carol@example.com', '+1-555-0103', '7 Maple Dr, Springfield, IL 62703', 'VIP customer - 10% discount')
    RETURNING id INTO v_cust_carol_id;

    INSERT INTO customers (user_id, name, email, phone, address, notes)
    VALUES (v_user_id, 'David Brown', 'david@example.com', '+1-555-0104', '18 Elm St, Springfield, IL 62704', 'Walk-in mostly')
    RETURNING id INTO v_cust_david_id;

    -- 6. Expenses (6 expenses)
    INSERT INTO expenses (user_id, category, description, amount, expense_date, notes)
    VALUES
        (v_user_id, 'Rent', 'Monthly shop rent', 1200.00, '2024-01-01', 'January rent'),
        (v_user_id, 'Utilities', 'Electricity bill', 180.50, '2024-01-05', ''),
        (v_user_id, 'Marketing', 'Facebook ads campaign', 350.00, '2024-01-10', 'New year promotion'),
        (v_user_id, 'Supplies', 'Packaging materials', 85.75, '2024-01-12', 'Boxes, tape, labels'),
        (v_user_id, 'Software', 'Accounting software subscription', 29.99, '2024-01-15', 'Monthly'),
        (v_user_id, 'Shipping', 'Postage for orders', 120.00, '2024-01-20', 'Bulk shipping labels');

    -- 7. Orders with order_items and inventory_movements (5 orders)
    --    Sale movements include stock_after as the running balance after the sale.

    -- Order 1: Alice - Confirmed, Partially Paid
    -- Items: Wireless Headphones (1), USB-C Hub (2)
    v_subtotal := (v_prod_wh_price * 1) + (v_prod_usb_price * 2);
    v_total := v_subtotal - 10.00;

    INSERT INTO orders (user_id, customer_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, stock_deducted)
    VALUES (v_user_id, v_cust_alice_id, 'ORD-2024-001', 'Confirmed', 'Partially Paid', v_subtotal, 10.00, v_total, 50.00, TRUE)
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
    VALUES
        (v_order_id, v_prod_wh_id, 'Wireless Headphones', 'ELEC-WH-001', 1, v_prod_wh_price, v_prod_wh_cost, v_prod_wh_price * 1),
        (v_order_id, v_prod_usb_id, 'USB-C Hub 7-in-1', 'ELEC-USB-002', 2, v_prod_usb_price, v_prod_usb_cost, v_prod_usb_price * 2);

    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES
        (v_user_id, v_prod_wh_id, v_order_id, 'sale', -1, 8, 'Order ORD-2024-001'),
        (v_user_id, v_prod_usb_id, v_order_id, 'sale', -2, 3, 'Order ORD-2024-001');

    -- Order 2: Bob - Completed, Paid
    -- Items: Mechanical Keyboard (1), Organic Cotton T-Shirt (3)
    v_subtotal := (v_prod_mk_price * 1) + (v_prod_ts_price * 3);
    v_total := v_subtotal;

    INSERT INTO orders (user_id, customer_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, stock_deducted, completed_at)
    VALUES (v_user_id, v_cust_bob_id, 'ORD-2024-002', 'Completed', 'Paid', v_subtotal, 0, v_total, v_total, TRUE, now())
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
    VALUES
        (v_order_id, v_prod_mk_id, 'Mechanical Keyboard', 'ELEC-MK-003', 1, v_prod_mk_price, v_prod_mk_cost, v_prod_mk_price * 1),
        (v_order_id, v_prod_ts_id, 'Organic Cotton T-Shirt', 'CLTH-TS-001', 3, v_prod_ts_price, v_prod_ts_cost, v_prod_ts_price * 3);

    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES
        (v_user_id, v_prod_mk_id, v_order_id, 'sale', -1, 12, 'Order ORD-2024-002'),
        (v_user_id, v_prod_ts_id, v_order_id, 'sale', -3, 25, 'Order ORD-2024-002');

    -- Order 3: Carol (VIP) - Processing, Unpaid
    -- Items: Slim Fit Jeans (1), Hooded Sweatshirt (2)
    -- JN: initial_stock=3, sale=-1 → stock_after=2 (matches stock_quantity=2)
    -- HD: initial_stock=17, sale=-2 → stock_after=15 (matches stock_quantity=15)
    v_subtotal := (v_prod_jn_price * 1) + (v_prod_hd_price * 2);
    v_total := v_subtotal * 0.90;

    INSERT INTO orders (user_id, customer_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, stock_deducted)
    VALUES (v_user_id, v_cust_carol_id, 'ORD-2024-003', 'Processing', 'Unpaid', v_subtotal, v_subtotal * 0.10, v_total, 0, FALSE)
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
    VALUES
        (v_order_id, v_prod_jn_id, 'Slim Fit Jeans', 'CLTH-JN-002', 1, v_prod_jn_price, v_prod_jn_cost, v_prod_jn_price * 1),
        (v_order_id, v_prod_hd_id, 'Hooded Sweatshirt', 'CLTH-HD-003', 2, v_prod_hd_price, v_prod_hd_cost, v_prod_hd_price * 2);

    -- Order 3: sale movements recorded (stock_deducted=FALSE means orders module
    --   hasn't processed the deduction yet, but movements track the audit trail)
    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES
        (v_user_id, v_prod_jn_id, v_order_id, 'sale', -1, 2, 'Order ORD-2024-003'),
        (v_user_id, v_prod_hd_id, v_order_id, 'sale', -2, 15, 'Order ORD-2024-003');

    -- Order 4: Walk-in (no customer) - Pending, Unpaid
    -- Items: Ceramic Planter Set (2)
    -- CP: initial_stock=12, sale=-2 → stock_after=10 (matches stock_quantity=10)
    v_subtotal := v_prod_cp_price * 2;
    v_total := v_subtotal;

    INSERT INTO orders (user_id, customer_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, stock_deducted)
    VALUES (v_user_id, NULL, 'ORD-2024-004', 'Pending', 'Unpaid', v_subtotal, 0, v_total, 0, FALSE)
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
    VALUES (v_order_id, v_prod_cp_id, 'Ceramic Planter Set', 'HOME-CP-001', 2, v_prod_cp_price, v_prod_cp_cost, v_prod_cp_price * 2);

    -- Order 4: sale movement recorded
    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES (v_user_id, v_prod_cp_id, v_order_id, 'sale', -2, 10, 'Order ORD-2024-004');

    -- Order 5: David - Cancelled, Unpaid (stock was deducted then restored)
    -- Items: LED Desk Lamp (1)
    -- DL: initial_stock=1, sale=-1 (stock_after=0), restore=+1 (stock_after=1)
    -- final stock = 1 ✓
    v_subtotal := v_prod_dl_price * 1;
    v_total := v_subtotal;

    -- First, stock was deducted (sale movement, stock_after=0)
    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES (v_user_id, v_prod_dl_id, NULL, 'sale', -1, 0, 'Order ORD-2024-005 (deducted)');

    -- Then order created as cancelled with stock_deducted = TRUE
    INSERT INTO orders (user_id, customer_id, order_number, status, payment_status, subtotal, discount, total, amount_paid, stock_deducted, completed_at)
    VALUES (v_user_id, v_cust_david_id, 'ORD-2024-005', 'Cancelled', 'Unpaid', v_subtotal, 0, v_total, 0, TRUE, now())
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
    VALUES (v_order_id, v_prod_dl_id, 'LED Desk Lamp', 'HOME-DL-002', 1, v_prod_dl_price, v_prod_dl_cost, v_prod_dl_price * 1);

    -- Update the sale movement to link it to the order
    UPDATE inventory_movements
    SET order_id = v_order_id
    WHERE product_id = v_prod_dl_id AND movement_type = 'sale' AND reason = 'Order ORD-2024-005 (deducted)';

    -- Cancellation restore movement (restore stock for cancelled order)
    INSERT INTO inventory_movements (user_id, product_id, order_id, movement_type, quantity_change, stock_after, reason)
    VALUES (v_user_id, v_prod_dl_id, v_order_id, 'cancellation_restore', 1, 1, 'Order ORD-2024-005 cancelled');

    RAISE NOTICE 'Seed data inserted successfully for user_id=%', v_user_id;
END $$;