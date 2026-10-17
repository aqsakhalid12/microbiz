# Business Rules

## Revenue and sales

- Revenue counts only **Completed** orders, filtered by completion date in the selected period.
- Pending, Confirmed, Processing, and Cancelled orders are **never** counted as sales.

## Cash vs revenue

- Cash collected is tracked separately from revenue using payment status.
- Unpaid and partially paid orders are **not** cash received.

## Profit calculations

- Gross profit = sum of `(recorded sale price - recorded cost price) x quantity` for completed orders, using prices stored in `order_items` at time of sale.
- Net operating profit = gross profit - recorded expenses in the same period.

## Stock management

- Stock is deducted exactly once, when an order moves `Pending -> Confirmed` (set `stock_deducted = true`).
- Stock is restored once when a `Confirmed` or `Processing` order is cancelled (`Cancelled`, `stock_deducted` reset to false). Cancelling twice never restores twice (`stock_deducted` guard).
- Cancelling a `Pending` order deducts nothing (no stock was deducted).
- Stock never goes negative: confirmation is rejected with `Insufficient stock for <product>.` if any line exceeds available stock.
- Every change is recorded in `inventory_movements` (`sale` on confirm, `cancellation_restore` on cancel).

## Order status transitions

| From | Allowed to |
|------|------------|
| `Pending` | `Confirmed`, `Cancelled` |
| `Confirmed` | `Processing`, `Completed`, `Cancelled` |
| `Processing` | `Completed`, `Cancelled` |
| `Completed` | (none — final) |
| `Cancelled` | (none — final) |

## Payments

- `PATCH /api/orders/:id/payment` records the **new total amount paid so far** (not an increment), between 0 and the order total, max 2 decimals.
- `payment_status` is derived server-side: 0 = `Unpaid`, > 0 and < total = `Partially Paid`, = total = `Paid`.
- Payments are not allowed on `Cancelled` orders.

## Transactions

- Order creation, status changes, stock deduction, stock restoration, and payment recording run inside database transactions.

## Expenses

- Expense reporting and totals are filtered by `expense_date` (the date the expense was incurred), not `created_at`.
- Expense amounts are stored as `NUMERIC(12,2)` and validated server-side: required, greater than 0, max 2 decimals, max 9999999999.99.
- `expense_date` must be a valid `YYYY-MM-DD` and cannot be in the future.
- Every expense is scoped to its owning user (`user_id`); users can only view, update, or delete their own expenses. Deletes are hard deletes.
