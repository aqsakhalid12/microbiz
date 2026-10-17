# Orders API

All order endpoints require authentication and are scoped to the current user (`req.user.id`).

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/orders` | List orders with filtering, pagination, sorting |
| POST | `/api/orders` | Create a new order (starts `Pending`, `Unpaid`) |
| GET | `/api/orders/:id` | Get a single order with customer and items |
| PUT | `/api/orders/:id` | Update a `Pending` order's items/customer/discount/notes |
| PATCH | `/api/orders/:id/status` | Transition order status |
| PATCH | `/api/orders/:id/payment` | Record a payment (total amount paid so far) |

There is **no DELETE endpoint** for orders.

## GET /api/orders/:id

Response:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "order_number": "ORD-2026-0001",
    "status": "Confirmed",
    "payment_status": "Partially Paid",
    "subtotal": 100.00,
    "discount": 10.00,
    "total": 90.00,
    "amount_paid": 40.00,
    "order_date": "2026-10-17T...",
    "notes": null,
    "customer": { "id": 3, "name": "Ada Smith", "email": "...", "phone": "..." },
    "items": [
      { "id": 1, "product_id": 4, "product_name": "Widget", "sku": "WID-01", "quantity": 2, "unit_price": 50.00, "unit_cost": 20.00, "line_total": 100.00 }
    ],
    "item_count": 1,
    "stock_deducted": false
  }
}
```

Money fields (`subtotal`, `discount`, `total`, `amount_paid`, item `unit_price`/`line_total`) are returned as numbers in dollars (2 decimals). `customer` is `null` for walk-in orders.

## PATCH /api/orders/:id/status

Body:

```json
{ "status": "Confirmed" }
```

`status` must be one of `Pending`, `Confirmed`, `Processing`, `Completed`, `Cancelled`.

Allowed transitions:

| From | To |
|------|----|
| `Pending` | `Confirmed`, `Cancelled` |
| `Confirmed` | `Processing`, `Completed`, `Cancelled` |
| `Processing` | `Completed`, `Cancelled` |
| `Completed` | (none) |
| `Cancelled` | (none) |

A transition the server forbids returns `400` with `Cannot transition from <current> to <new>.`.

Stock rules:
- `Pending` -> `Confirmed`: stock is deducted exactly once per order line (`sale` inventory movements). Fails with `Insufficient stock for <product>.` if stock is insufficient.
- Any -> `Cancelled`: if stock was previously deducted (`stock_deducted`), it is restored once (`cancellation_restore` movements). Cancelling twice never restores twice.

## PATCH /api/orders/:id/payment

Body:

```json
{ "amount_paid": 40.00 }
```

`amount_paid` is the **new total amount paid so far** (not an increment), a number >= 0 with at most 2 decimals, and must be <= the order total.

The server derives `payment_status`: `0` -> `Unpaid`, `> 0` and `< total` -> `Partially Paid`, `= total` -> `Paid`.

Not allowed on `Cancelled` orders (`400`: `Cannot record a payment on a cancelled order.`).

## Errors

Validation failures return HTTP `400` with:

```json
{
  "success": false,
  "message": "Validation failed",
  "details": { "fields": { "<field>": "<message>" } }
}
```

Examples: `Insufficient stock for <product>.`, `Amount paid cannot exceed the order total.`, `Only Pending orders can be edited.`, `Cannot record a payment on a cancelled order.`.

HTTP `404` is returned for unknown orders or orders owned by another user. HTTP `401` redirects to `/login` on expired sessions.

## Frontend notes

The view modal (`frontend/js/orders/orders-view.js`) calls `GET /api/orders/:id`, renders the order, and offers status buttons only for server-allowed next steps. `Cancel` and `Complete` require confirmation in a modal; `Confirm` does not. Buttons are disabled with a spinner while requests run. Payments use `PATCH /api/orders/:id/payment` with the new total amount paid; the amount input is capped at the order total.
