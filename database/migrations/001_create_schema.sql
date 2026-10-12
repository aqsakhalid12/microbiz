BEGIN;

-- ============================================================================
-- Reusable trigger function to auto-update updated_at column
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. users table
-- Stores registered users of the application.
-- Email is normalized to lowercase for case-insensitive uniqueness.
-- ============================================================================
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive unique index on email
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE users IS 'Registered application users. Email is unique case-insensitively.';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hash; real auth implemented in Phase 4.';


-- ============================================================================
-- 2. business_settings table
-- One row per user, stores business profile information.
-- user_id is UNIQUE and FK to users with CASCADE delete.
-- ============================================================================
CREATE TABLE business_settings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    default_low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (default_low_stock_threshold >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_business_settings_updated_at
BEFORE UPDATE ON business_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_settings IS 'Per-user business profile. One row per user (user_id UNIQUE).';


-- ============================================================================
-- 3. products table
-- Products owned by a user. Soft-delete via deleted_at.
-- Partial unique index on (user_id, sku) where sku is not null and not deleted.
-- ============================================================================
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    category TEXT,
    selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
    cost_price NUMERIC(12,2) NOT NULL CHECK (cost_price >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    image_url TEXT,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: sku unique per user among non-deleted products
CREATE UNIQUE INDEX uq_products_user_sku_active
    ON products (user_id, sku)
    WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- Indexes for common query patterns
CREATE INDEX idx_products_user_name ON products (user_id, name);
CREATE INDEX idx_products_user_category ON products (user_id, category);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE products IS 'User-owned products. Soft-delete via deleted_at. SKU unique per user among active products.';
COMMENT ON COLUMN products.deleted_at IS 'NULL = active; non-NULL = soft-deleted. Partial unique index ignores deleted rows.';


-- ============================================================================
-- 4. customers table
-- Customers belonging to a user.
-- ============================================================================
CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_user_name ON customers (user_id, name);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE customers IS 'Customers belonging to a user.';


-- ============================================================================
-- 5. orders table
-- Orders placed by customers (or walk-ins with NULL customer_id).
-- status and payment_status use CHECK constraints for valid values.
-- completed_at must be non-null when status = 'Completed'.
-- stock_deducted prevents double deduction of inventory.
-- ============================================================================
CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES customers(id) ON DELETE RESTRICT,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending','Confirmed','Processing','Completed','Cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'Unpaid'
        CHECK (payment_status IN ('Unpaid','Partially Paid','Paid')),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0 AND amount_paid <= total),
    order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    stock_deducted BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_orders_user_order_number UNIQUE (user_id, order_number),
    CONSTRAINT chk_orders_completed_at
        CHECK (status <> 'Completed' OR completed_at IS NOT NULL)
);

CREATE INDEX idx_orders_user_status ON orders (user_id, status);
CREATE INDEX idx_orders_user_payment_status ON orders (user_id, payment_status);
CREATE INDEX idx_orders_user_order_date ON orders (user_id, order_date);
CREATE INDEX idx_orders_user_completed_at ON orders (user_id, completed_at);
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE orders IS 'Orders. customer_id nullable for walk-in orders. stock_deducted guards against double inventory deduction.';
COMMENT ON COLUMN orders.completed_at IS 'Must be set when status = Completed (enforced by chk_orders_completed_at).';


-- ============================================================================
-- 6. order_items table
-- Line items for an order. Snapshots product name, sku, price, cost at time of sale.
-- product_id uses RESTRICT to prevent deleting a product that has sales history.
-- ============================================================================
CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_product_id ON order_items (product_id);

COMMENT ON TABLE order_items IS 'Order line items. Prices and costs snapshotted at time of sale. product_id RESTRICT prevents deleting products with sales history.';


-- ============================================================================
-- 7. expenses table
-- Business expenses tracked by user.
-- ============================================================================
CREATE TABLE expenses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_user_expense_date ON expenses (user_id, expense_date);
CREATE INDEX idx_expenses_user_category ON expenses (user_id, category);

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE expenses IS 'Business expenses. amount must be positive.';


-- ============================================================================
-- 8. inventory_movements table
-- Audit trail of all stock changes. movement_type enumerated via CHECK.
-- order_id nullable and SET NULL on order delete (keeps movement record).
-- quantity_change != 0 enforced; stock_after >= 0.
-- ============================================================================
CREATE TABLE inventory_movements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    movement_type TEXT NOT NULL
        CHECK (movement_type IN ('initial_stock','purchase','sale','cancellation_restore','adjustment')),
    quantity_change INT NOT NULL CHECK (quantity_change <> 0),
    stock_after INT NOT NULL CHECK (stock_after >= 0),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_movements_product_created ON inventory_movements (product_id, created_at);
CREATE INDEX idx_inventory_movements_user_created ON inventory_movements (user_id, created_at);
CREATE INDEX idx_inventory_movements_order_id ON inventory_movements (order_id);

COMMENT ON TABLE inventory_movements IS 'Audit trail of stock changes. quantity_change != 0. order_id SET NULL on order delete to preserve history.';


COMMIT;