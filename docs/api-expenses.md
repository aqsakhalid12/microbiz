# API: Expenses

Base path: `/api/expenses`. All endpoints require authentication (`requireAuth`).
Every query is filtered by `req.user.id` (server session); clients may not supply
`user_id`. Other users' records return `404`. Invalid `:id` returns `400`.

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | List expenses (query: `search`, `category`, `date_from`, `date_to`, `page`, `limit`, `sort`) |
| GET | `/api/expenses/categories` | Distinct expense categories of the current user |
| POST | `/api/expenses` | Create an expense (201) |
| GET | `/api/expenses/:id` | Get a single expense (404 if not owned) |
| PUT | `/api/expenses/:id` | Update an expense (404 if not owned) |
| DELETE | `/api/expenses/:id` | Hard-delete an expense (404 if not owned) |

## Query parameters (GET /api/expenses)

- `search`: full-text search on `description` and `category` (ILIKE).
- `category`: exact category filter.
- `date_from` / `date_to`: inclusive `YYYY-MM-DD` filters on `expense_date`.
- `page`: integer >= 1 (default 1).
- `limit`: integer 1-50 (default 10).
- `sort`: `field:direction`, field whitelist `expense_date`, `amount`, `created_at`; direction `asc`/`desc` (default `expense_date:desc`).

## Response shape

List:
```json
{
  "success": true,
  "data": [ { "id": 1, "category": "...", "description": "...", "amount": 123.45, "expense_date": "2026-10-01", "notes": "...", "created_at": "...", "updated_at": "..." } ],
  "pagination": { "page": 1, "limit": 10, "total": 4, "totalPages": 1 },
  "summary": { "total_amount": 738.95, "count": 4 }
}
```

`summary.total_amount` and `summary.count` are computed for the SAME filters as the
list, so the frontend summary strip stays consistent with the table.

Single item / create / update return `{ "success": true, "data": <expense> }`.
Delete returns `{ "success": true, "message": "Expense deleted" }`.

## Validation (400 with per-field `details.fields`)

- `category`: required, 1-80 chars, trimmed.
- `description`: optional, max 255 chars.
- `amount`: required, number > 0, max 2 decimals, max 9999999999.99.
- `expense_date`: required, valid `YYYY-MM-DD`, not in the future.
- `notes`: optional, max 2000 chars.

Invalid `:id` (not a positive integer) returns 400.

## Money

`amount` is stored as `NUMERIC(12,2)` in PostgreSQL. BIGINT `id` and NUMERIC
`amount` are normalized to JavaScript numbers in the repository layer so callers
never see string ids/amounts.

## Page route

`GET /expenses` serves `frontend/pages/expenses.html` (redirects to `/login`
without a session; not behind `requireAuth`).
