# Customers API (Phase 7)

All endpoints require authentication (server-side session cookie). The `user_id` is
taken only from `req.user.id` (server session) — never from client input.
All queries filter by `user_id`, so users can only access their own data.

## Money format

Money fields are returned as JSON numbers. The frontend formats them using `formatCurrency()` with the user's currency from `/api/auth/me`.

## Endpoints

### GET /api/customers

List customers with search, pagination, and sorting.

#### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | (empty) | ILIKE search on name, email and phone |
| `page` | number | 1 | Page number (1-based) |
| `limit` | number | 10 | Items per page (max 50) |
| `sort` | string | `name:asc` | Sort field:direction. Whitelisted: `name`, `created_at` |

#### Response 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alice Smith",
      "email": "alice@example.com",
      "phone": "+1 555 123 4567",
      "address": "123 Main St",
      "notes": "VIP customer",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "order_count": 0,
      "total_spent": 0
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

### POST /api/customers

Create a customer.

#### Request body
- `name` (string, required) — 1-150 chars, trimmed
- `email` (string, optional) — valid format, max 255, lowercased, empty string becomes null
- `phone` (string, optional) — max 30, only digits, spaces, + - ( )
- `address` (string, optional) — max 500
- `notes` (string, optional) — max 2000

#### Response 201 Created
```json
{
  "success": true,
  "data": { ...customer fields... }
}
```

### GET /api/customers/:id

Get a single customer with stats.

#### Response 200 OK
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Alice Smith",
    "email": "alice@example.com",
    "phone": null,
    "address": null,
    "notes": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "order_count": 0,
    "total_spent": 0
  }
}
```
404 if not found or not owned.

### PUT /api/customers/:id

Update a customer (all fields optional; at least one required).

#### Response 200 OK
404 if not found.

### DELETE /api/customers/:id

Delete a customer.

- 200 OK if deleted successfully
- 404 if not found or not owned
- 409 "Customer has orders and cannot be deleted" if the customer has any orders (or FK violation)

### GET /api/customers/:id/orders

List orders for the customer (scoped by user). Returns 404 if customer not found/owned.

#### Query params
- `page` (number, default 1)
- `limit` (number, default 10, max 50)

#### Response 200 OK
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_number": "ORD-001",
      "status": "Completed",
      "payment_status": "Paid",
      "total": 10,
      "order_date": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

## Validation errors

400 responses include `details.fields` with per-field messages when validation fails. :id must be a positive integer.
