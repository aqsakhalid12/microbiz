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

## Dashboard / Reports (Phase 10)

All report endpoints are authenticated (`requireAuth`) and **every query is
filtered by `req.user.id`**. The user id is never accepted from the client.

### Date ranges

- `date_from` and `date_to` are validated as `YYYY-MM-DD`, must be real
  calendar dates, `date_from <= date_to`, and the range must not exceed
  366 days.
- When omitted, the default range is the **current month**: first day of the
  current month through today (inclusive).
- All date filtering happens in the **server timezone**. A range of
  `[date_from 00:00, date_to + 1 day)` is used for `TIMESTAMPTZ` columns
  (`orders.completed_at`, `orders.order_date`); `DATE` columns
  (`expenses.expense_date`) use the plain inclusive bounds.

### Revenue, costs and profit

- **Revenue** = `sum(orders.total)` for orders with `status = 'Completed'`
  and `completed_at` inside the range.
- **Cost of goods** = `sum(order_items.quantity * order_items.unit_cost)`
  for those same completed orders (uses the snapshot stored at sale time).
- **Gross profit** = revenue - cost of goods.
- **Expenses** = `sum(expenses.amount)` with `expense_date` inside the range.
- **Net profit** = gross profit - expenses.
- **Cash collected** = `sum(orders.amount_paid)` for orders with
  `status <> 'Cancelled'` and `order_date` inside the range. Shown
  separately, never mixed with revenue.
- **Average order value** = revenue / completed order count (0 when there
  are no completed orders).

### Order counts

- **Orders count** = orders created in range (all statuses), based on
  `order_date`.
- **Completed count** = completed orders in range, based on `completed_at`.
- **Pending count** = orders with `status = 'Pending'` (current state, not
  range-based).
- **Cancelled count** = orders with `status = 'Cancelled'` created in range
  (based on `order_date`).

### Stock

- **Low stock** = products with `deleted_at IS NULL` and
  `stock_quantity <= low_stock_threshold` (current state).
- **Out of stock** = products with `deleted_at IS NULL` and
  `stock_quantity = 0` (current state).

### Money

- All money math is done in SQL on `NUMERIC` columns, or in integer cents
  in application code. Floats are **never** used for money.
- `BIGINT` ids and `NUMERIC` values come back from `pg` as strings and are
  normalised to numbers by every repository before returning to a caller.