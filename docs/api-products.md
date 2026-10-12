# Products & Inventory API (Phase 6)

All endpoints require authentication (server-side session cookie). The `user_id` is
taken **only** from `req.user.id` (server session) — **never** from client input.
All queries filter by `user_id`, so users can only access their own data.
Soft-deleted products (`deleted_at IS NOT NULL`) are excluded from all list and
lookup operations.

## Money format

Money fields (`selling_price`, `cost_price`) are returned as JSON numbers
(numeric values). The frontend formats them using `formatCurrency()` with the
user's currency from `/api/auth/me`.

---

## Endpoints

### `GET /api/products/categories`

List distinct categories for the authenticated user's products.

#### Response `200 OK`

```json
{
  "success": true,
  "data": ["Electronics", "Clothing", "Home & Garden"]
}
```

---

### `GET /api/products/low-stock`

List products with low stock (stock_quantity <= low_stock_threshold AND > 0).

#### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Wireless Headphones",
      "sku": "ELEC-WH-001",
      "category": "Electronics",
      "selling_price": 129.99,
      "cost_price": 65.00,
      "stock_quantity": 3,
      "low_stock_threshold": 5,
      "image_url": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### `GET /api/products`

List products with filtering, pagination, and sorting.

#### Query Parameters

| Parameter | Type   | Default    | Description |
|-----------|--------|------------|-------------|
| `search`  | string | (empty)    | ILIKE search on name and SKU |
| `category`| string | (empty)    | Exact category match |
| `stock`   | string | (empty)    | Stock filter: `low` (≤ threshold, > 0), `out` (0), `in` (> threshold) |
| `page`    | number | 1          | Page number (1-based) |
| `limit`   | number | 10         | Items per page (max 50) |
| `sort`    | string | `name:asc` | Sort field and direction (e.g. `selling_price:desc`). Whitelisted fields: `name`, `selling_price`, `stock_quantity`, `created_at` |

#### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Wireless Headphones",
      "sku": "ELEC-WH-001",
      "description": "Bluetooth over-ear headphones",
      "category": "Electronics",
      "selling_price": 129.99,
      "cost_price": 65.00,
      "stock_quantity": 8,
      "low_stock_threshold": 5,
      "image_url": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "totalPages": 1
  }
}
```

---

### `GET /api/products/:id`

Retrieve a single product by ID.

#### Parameters

| Parameter | Type   | Description |
|-----------|--------|-------------|
| `id`      | number | Product ID (positive integer) |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Wireless Headphones",
    "sku": "ELEC-WH-001",
    "description": "Bluetooth over-ear headphones",
    "category": "Electronics",
    "selling_price": 129.99,
    "cost_price": 65.00,
    "stock_quantity": 8,
    "low_stock_threshold": 5,
    "image_url": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "deleted_at": null
  }
}
```

#### Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400    | Invalid product ID | `:id` is not a positive integer |
| 404    | Product not found | Product does not exist or belongs to another user |

---

### `POST /api/products`

Create a new product.

#### Request Body

| Field               | Type    | Required | Validation |
|---------------------|---------|----------|------------|
| `name`              | string  | yes      | 1-150 characters |
| `sku`               | string  | no       | max 64 chars, trimmed, empty string → null |
| `description`       | string  | no       | max 2000 chars |
| `category`          | string  | no       | max 80 chars |
| `selling_price`     | number  | yes      | >= 0, max 2 decimals, max 9999999999.99 |
| `cost_price`        | number  | yes      | >= 0, max 2 decimals, max 9999999999.99 |
| `stock_quantity`    | integer | no       | >= 0 (default: 0) |
| `low_stock_threshold` | integer | no     | >= 0 (default from business settings) |
| `image_url`         | string  | no       | valid http/https URL, max 500 chars |

#### Request Example

```json
{
  "name": "Wireless Headphones",
  "sku": "ELEC-WH-001",
  "description": "Bluetooth over-ear headphones with noise cancellation",
  "category": "Electronics",
  "selling_price": 129.99,
  "cost_price": 65.00,
  "stock_quantity": 10,
  "low_stock_threshold": 5,
  "image_url": "https://example.com/images/wh-001.jpg"
}
```

#### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Wireless Headphones",
    "sku": "ELEC-WH-001",
    "description": "Bluetooth over-ear headphones",
    "category": "Electronics",
    "selling_price": 129.99,
    "cost_price": 65.00,
    "stock_quantity": 10,
    "low_stock_threshold": 5,
    "image_url": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Note:** If `stock_quantity > 0`, an `initial_stock` inventory movement is created automatically.

#### Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400    | Validation failed | Invalid field values (see `details.fields` for per-field messages) |
| 409    | SKU already exists | SKU is already in use for another product of this user |

---

### `PUT /api/products/:id`

Update a product. Stock quantity cannot be updated here.

#### Notes

- `stock_quantity` is intentionally **not** accepted via this endpoint.
  Attempting to set it returns `400` with the message:
  *"Stock quantity cannot be updated directly. Use the stock adjustment endpoint."*
- All other fields are optional; only provided fields are updated.

#### Request Body (all fields optional)

| Field               | Type    | Validation |
|---------------------|---------|------------|
| `name`              | string  | 1-150 characters |
| `sku`               | string  | max 64 chars, trimmed, null to clear |
| `description`       | string  | max 2000 chars |
| `category`          | string  | max 80 chars, null to clear |
| `selling_price`     | number  | >= 0, max 2 decimals, max 9999999999.99 |
| `cost_price`        | number  | >= 0, max 2 decimals, max 9999999999.99 |
| `low_stock_threshold` | integer | >= 0 |
| `image_url`         | string  | valid http/https URL, max 500 chars, null to clear |

#### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Name",
    "sku": "NEW-SKU",
    ...
    "stock_quantity": 10,
    "updated_at": "2024-01-02T12:00:00Z"
  }
}
```

#### Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400    | Validation failed | Invalid field values or `stock_quantity` in body |
| 404    | Product not found | Product does not exist or belongs to another user |
| 409    | SKU already exists | SKU conflicts with another product |

---

### `DELETE /api/products/:id`

Soft-delete a product (sets `deleted_at`).

#### Response `200 OK`

```json
{
  "success": true,
  "message": "Product deleted"
}
```

#### Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400    | Invalid product ID | `:id` is not a positive integer |
| 404    | Product not found | Product does not exist or belongs to another user |

---

### `POST /api/products/:id/stock-adjustments`

Adjust stock for a product. Performs a transactional stock update with row-level locking.

#### Request Body

| Field            | Type    | Required | Validation |
|------------------|---------|----------|------------|
| `movement_type`  | string  | yes      | `purchase` (add stock) or `adjustment` (add or remove) |
| `quantity_change`| integer | yes      | Non-zero; must be positive for `purchase`, any non-zero for `adjustment` |
| `reason`         | string  | yes*     | Required for `adjustment`, max 255 chars (* not required for `purchase`) |

#### Request Example

```json
{
  "movement_type": "adjustment",
  "quantity_change": -3,
  "reason": "Damaged goods written off"
}
```

#### Response `200 OK`

Returns the updated product (with new `stock_quantity`).

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Wireless Headphones",
    "stock_quantity": 7,
    ...
  }
}
```

#### Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400    | Validation failed | Invalid input (see `details.fields`) |
| 400    | Insufficient stock | Adjustment would make stock negative |
| 404    | Product not found | Product does not exist or belongs to another user |

---

### `GET /api/products/:id/movements`

List inventory movement history for a product.

#### Query Parameters

| Parameter | Type   | Default | Description |
|-----------|--------|---------|-------------|
| `page`    | number | 1       | Page number |
| `limit`   | number | 10      | Items per page |

#### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "product_id": 1,
      "order_id": null,
      "movement_type": "initial_stock",
      "quantity_change": 10,
      "stock_after": 10,
      "reason": "Initial stock on product creation",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

#### Errors

| Status | Message | Cause |
|--------|---------|-------|
| 400    | Invalid product ID | `:id` is not a positive integer |
| 404    | Product not found | Product does not exist or belongs to another user |

---

## Inventory Movement Types

| Type                  | Description |
|-----------------------|-------------|
| `initial_stock`       | Automatic movement created on product creation (if stock > 0) |
| `purchase`            | Positive stock addition (e.g., new shipment) |
| `sale`                | Stock reduction from an order (Phase 7) |
| `cancellation_restore`| Stock restoration from a cancelled order (Phase 7) |
| `adjustment`          | Manual stock adjustment (positive or negative) |

---

### `GET /api/inventory/movements`

List all inventory movements for the authenticated user, with optional filters.

#### Query Parameters

| Parameter    | Type   | Default | Description |
|--------------|--------|---------|-------------|
| `product_id` | number | (empty) | Filter by product ID |
| `type`       | string | (empty) | Filter by movement type (see types above) |
| `page`       | number | 1       | Page number |
| `limit`      | number | 10      | Items per page (max 50) |

#### Response `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "product_id": 1,
      "product_name": "Wireless Headphones",
      "product_sku": "ELEC-WH-001",
      "order_id": null,
      "movement_type": "initial_stock",
      "quantity_change": 10,
      "stock_after": 10,
      "reason": "Initial stock on product creation",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## Data Isolation

- All endpoints use `requireAuth` middleware.
- Every query filters by `req.user.id` (from the server session).
- Attempting to access another user's product returns `404` (not `403`).
- Soft-deleted products are excluded from all list and lookup operations.

## Error Response Format

All errors return:

```json
{
  "success": false,
  "message": "Error message",
  "details?: { ... }
}
```

For validation errors, `details.fields` maps field names to specific error messages:

```json
{
  "success": false,
  "message": "Validation failed",
  "details": {
    "fields": {
      "selling_price": "Selling price must be a number >= 0."
    }
  }
}
```