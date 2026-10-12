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

- Stock is deducted exactly once (proposed: when an order moves to Confirmed).
- Stock is restored when a Confirmed/Processing order is cancelled.
- Stock never goes negative.
- Every change is recorded in `inventory_movements`.

## Transactions

- Order creation, status changes, stock deduction, and stock restoration run inside database transactions.

## Open assumptions

1. **Exact moment of stock deduction** — proposed: when an order moves to Confirmed.
2. **How partial payments are recorded** — to be decided in Phase 8.
3. **Which date is used for expense reporting** — to be decided.