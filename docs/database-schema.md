# Database Schema Documentation

## Overview
This document describes the PostgreSQL schema for MicroBiz (Phase 2). All tables use `BIGINT GENERATED ALWAYS AS IDENTITY` primary keys, `NUMERIC(12,2)` for monetary values, and `TIMESTAMPTZ` for timestamps with `created_at`/`updated_at` defaults.

---

## Tables

### 1. users
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| full_name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE (case-insensitive via `lower(email)` index) |
| password_hash | TEXT | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Triggers:** `set_updated_at()` on UPDATE

---

### 2. business_settings
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| user_id | BIGINT | NOT NULL, UNIQUE, FK → users(id) ON DELETE CASCADE |
| business_name | TEXT | NOT NULL |
| email | TEXT | |
| phone | TEXT | |
| address | TEXT | |
| currency_code | TEXT | NOT NULL DEFAULT 'USD' |
| default_low_stock_threshold | INT | NOT NULL DEFAULT 5 CHECK (>= 0) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Triggers:** `set_updated_at()` on UPDATE

**Ownership:** Carries `user_id` directly. One row per user.

---

### 3. products
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| user_id | BIGINT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| sku | TEXT | NULLABLE |
| description | TEXT | |
| category | TEXT | |
| selling_price | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| cost_price | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| stock_quantity | INT | NOT NULL DEFAULT 0 CHECK (>= 0) |
| low_stock_threshold | INT | NOT NULL DEFAULT 5 CHECK (>= 0) |
| image_url | TEXT | |
| deleted_at | TIMESTAMPTZ | NULLABLE (soft delete) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- Partial unique: `(user_id, sku) WHERE sku IS NOT NULL AND deleted_at IS NULL`
- `idx_products_user_name` on `(user_id, name)`
- `idx_products_user_category` on `(user_id, category)`

**Triggers:** `set_updated_at()` on UPDATE

**Soft Delete:** `deleted_at` NULL = active, non-NULL = deleted. Partial unique index ignores deleted rows.

**Ownership:** Carries `user_id` directly.

---

### 4. customers
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| user_id | BIGINT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| name | TEXT | NOT NULL |
| email | TEXT | |
| phone | TEXT | |
| address | TEXT | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:** `idx_customers_user_name` on `(user_id, name)`

**Triggers:** `set_updated_at()` on UPDATE

**Ownership:** Carries `user_id` directly.

---

### 5. orders
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| user_id | BIGINT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| customer_id | BIGINT | FK → customers(id) ON DELETE RESTRICT (nullable for walk-ins) |
| order_number | TEXT | NOT NULL |
| status | TEXT | NOT NULL DEFAULT 'Pending' CHECK IN ('Pending','Confirmed','Processing','Completed','Cancelled') |
| payment_status | TEXT | NOT NULL DEFAULT 'Unpaid' CHECK IN ('Unpaid','Partially Paid','Paid') |
| subtotal | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| discount | NUMERIC(12,2) | NOT NULL DEFAULT 0 CHECK (>= 0) |
| total | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| amount_paid | NUMERIC(12,2) | NOT NULL DEFAULT 0 CHECK (>= 0 AND <= total) |
| order_date | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| completed_at | TIMESTAMPTZ | NULLABLE |
| stock_deducted | BOOLEAN | NOT NULL DEFAULT FALSE |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Constraints:**
- UNIQUE `(user_id, order_number)`
- CHECK: `status <> 'Completed' OR completed_at IS NOT NULL`

**Indexes:**
- `idx_orders_user_status` on `(user_id, status)`
- `idx_orders_user_payment_status` on `(user_id, payment_status)`
- `idx_orders_user_order_date` on `(user_id, order_date)`
- `idx_orders_user_completed_at` on `(user_id, completed_at)`
- `idx_orders_customer_id` on `(customer_id)`

**Triggers:** `set_updated_at()` on UPDATE

**Ownership:** Carries `user_id` directly. `customer_id` references customers (RESTRICT prevents deleting a customer with orders).

**Note:** `stock_deducted` guards against double inventory deduction. Totals are calculated server-side and stored for audit/history.

---

### 6. order_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| order_id | BIGINT | NOT NULL, FK → orders(id) ON DELETE CASCADE |
| product_id | BIGINT | NOT NULL, FK → products(id) ON DELETE RESTRICT |
| product_name | TEXT | NOT NULL (snapshot) |
| sku | TEXT | Snapshot at time of sale |
| quantity | INT | NOT NULL CHECK (> 0) |
| unit_price | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| unit_cost | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| line_total | NUMERIC(12,2) | NOT NULL CHECK (>= 0) |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_order_items_order_id` on `(order_id)`
- `idx_order_items_product_id` on `(product_id)`

**Ownership:** Verified through `order_id` → `orders.user_id` and `product_id` → `products.user_id` on the server. No direct `user_id` column.

**RESTRICT on product_id:** Prevents deleting a product that has sales history (order_items reference it).

---

### 7. expenses
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| user_id | BIGINT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| category | TEXT | NOT NULL |
| description | TEXT | |
| amount | NUMERIC(12,2) | NOT NULL CHECK (> 0) |
| expense_date | DATE | NOT NULL |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| updated_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_expenses_user_expense_date` on `(user_id, expense_date)`
- `idx_expenses_user_category` on `(user_id, category)`

**Triggers:** `set_updated_at()` on UPDATE

**Ownership:** Carries `user_id` directly.

---

### 8. inventory_movements
| Column | Type | Constraints |
|--------|------|-------------|
| id | BIGINT | PK, GENERATED ALWAYS AS IDENTITY |
| user_id | BIGINT | NOT NULL, FK → users(id) ON DELETE CASCADE |
| product_id | BIGINT | NOT NULL, FK → products(id) ON DELETE RESTRICT |
| order_id | BIGINT | FK → orders(id) ON DELETE SET NULL (nullable) |
| movement_type | TEXT | NOT NULL CHECK IN ('initial_stock','purchase','sale','cancellation_restore','adjustment') |
| quantity_change | INT | NOT NULL CHECK (<> 0) |
| stock_after | INT | NOT NULL CHECK (>= 0) |
| reason | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() |

**Indexes:**
- `idx_inventory_movements_product_created` on `(product_id, created_at)`
- `idx_inventory_movements_user_created` on `(user_id, created_at)`
- `idx_inventory_movements_order_id` on `(order_id)`

**Ownership:** Carries `user_id` directly. Also verifiable via `product_id` → `products.user_id`.

**Note:** `order_id` uses SET NULL so movement history is preserved if an order is deleted. `quantity_change != 0` enforced. `stock_after >= 0` enforced.

---

## Relationships & Ownership Path

```
users (1) ──< (1) business_settings
users (1) ──< (N) products
users (1) ──< (N) customers
users (1) ──< (N) orders
users (1) ──< (N) expenses
users (1) ──< (N) inventory_movements

orders (1) ──< (N) order_items
products (1) ──< (N) order_items  (RESTRICT)
products (1) ──< (N) inventory_movements  (RESTRICT)
orders (1) ──< (N) inventory_movements  (SET NULL)
customers (1) ──< (N) orders  (RESTRICT)
```

**Tables with direct `user_id` (ownership root):**
- business_settings
- products
- customers
- orders
- expenses
- inventory_movements

**Tables verified through ownership chain (server-side):**
- order_items (via `order_id` → `orders.user_id` AND `product_id` → `products.user_id`)
- inventory_movements (via `product_id` → `products.user_id` and direct `user_id`)

---

## Delete Behavior Summary

| Table | Delete Rule | Notes |
|-------|-------------|-------|
| users | CASCADE | Deletes all owned data |
| business_settings | CASCADE (via user) | One per user |
| products | SOFT DELETE | `deleted_at` set; RESTRICT on order_items/inventory_movements prevents hard delete if referenced |
| customers | RESTRICT | Cannot delete if orders exist |
| orders | CASCADE (via user) | order_items CASCADE; inventory_movements SET NULL |
| order_items | CASCADE (via order) | |
| expenses | CASCADE (via user) | |
| inventory_movements | CASCADE (via user) | product_id RESTRICT; order_id SET NULL |

---

## Important Notes

1. **Totals are calculated server-side**: `orders.subtotal`, `discount`, `total`, `amount_paid`, and `order_items.line_total` are computed in the application layer and stored for audit/history. They are not derived via triggers or views.

2. **Stock consistency**: `products.stock_quantity` is the source of truth for current stock. `inventory_movements` is an audit trail. The `stock_after` column in movements should match `products.stock_quantity` after each movement. Server-side code must maintain consistency.

3. **Soft delete for products**: Products are never hard-deleted if they have `order_items` or `inventory_movements` references (RESTRICT). The `deleted_at` column marks them as inactive for UI purposes.

4. **Case-insensitive email**: The `users` table has a unique index on `lower(email)` to prevent duplicate accounts with different casing.

5. **Trigger function**: `set_updated_at()` is a reusable function attached to all tables with `updated_at`.

6. **Currency**: `business_settings.currency_code` stores ISO 4217 code (default 'USD'). All money columns use `NUMERIC(12,2)`.

7. **No ORM**: All queries use raw parameterized SQL via the `pg` package.