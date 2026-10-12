# Security Design (Phase 4)

## Chosen strategy

- **Server-side sessions** stored in PostgreSQL via `express-session` + `connect-pg-simple`
  (table `session`, see migration `002_create_sessions.sql`).
- Session id travels in an **httpOnly cookie** named `microbiz.sid`.
- Passwords are hashed with **bcryptjs** (cost 12) and never stored or returned
  anywhere in plain text.

### Why sessions + httpOnly cookie (trade-offs)

- **Pro:** the session content lives on the server, so a stolen cookie only
  contains a random id — no user data, no tokens to decode.
- **Pro:** sessions can be revoked server-side (delete the row) and survive
  restarts (PostgreSQL storage).
- **Pro:** httpOnly blocks JavaScript access to the cookie (XSS mitigation);
  `SameSite=lax` blocks cross-site POSTs (CSRF mitigation).
- **Con vs JWT:** needs a DB round-trip per request and server-side storage;
  JWTs are stateless but cannot be revoked easily and expose payload data.
  For a small internal monolith, sessions are simpler and safer.

## Password rules (enforced server-side)

- 8–72 characters (bcrypt truncates at 72).
- At least one letter **and** one number.
- Hashed with bcrypt cost 12; only the hash is stored (`users.password_hash`).

## Session settings

| Setting | Value |
|---------|-------|
| Cookie name | `microbiz.sid` |
| httpOnly | `true` |
| SameSite | `lax` |
| Secure | `true` in production only (HTTPS) |
| Max age | 7 days |
| resave / saveUninitialized | `false` / `false` |
| Session secret | `SESSION_SECRET` (≥ 32 chars in production, never the `.env.example` placeholder) |

Sessions are **regenerated on every login/register** (prevents session fixation).
The session stores **only `userId`** — never email, roles, or tokens.

## Rate limiting

`POST /api/auth/login` and `POST /api/auth/register` are limited per IP:

- Production: **10 requests / 15 minutes**
- Development: **100 requests / 15 minutes** (so testing/Postman is not blocked)
- Response on limit: `429 { "success": false, "message": "Too many attempts, please try again later." }`

## CSRF approach

Two layers:

1. `SameSite=lax` cookie — browsers do not send it on cross-site POSTs.
2. `csrfOriginCheck` middleware (global, after session, before routes):
   for `POST/PUT/PATCH/DELETE` on `/api/*`, if an `Origin` header is
   present it must match the request's own host, otherwise `403`.
   Requests **without** an `Origin` (e.g. Postman) are allowed in
   development; in production they are rejected only when a session
   cookie is attached (i.e. a logged-in browser session could be abused).

## DATA ISOLATION RULE (most important)

**Every business-owned query must filter by the authenticated user's id
taken from the server session (`req.user.id`) — never from client input
(body, query, headers).**

```js
// CORRECT: owner id comes from the server-side session
async function listProducts(userId) {
  return query(
    `SELECT id, name, sku, selling_price, stock_quantity
     FROM products
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY name`,
    [userId] // <- req.user.id, not req.body.userId
  );
}
```

```js
// WRONG: client can read/modify another user's data
WHERE user_id = $1  -- with [req.body.userId]  <-- never do this
```

Child tables (`order_items`, `inventory_movements`) have no direct
`user_id` check on the request path — they must be accessed **through a
verified parent** (`order` / `product`) that already carries the
calling user's `user_id`, and the server must confirm the parent belongs
to `req.user.id` before reading or writing the child rows.

## Other rules

- Login answers with the **same generic message**
  (`"Invalid email or password"`) whether the email exists or not,
  and runs a dummy bcrypt compare when the email is unknown, so
  response times do not leak which accounts exist.
- Parameterized SQL only (`$1, $2, ...`); no string concatenation.
- Secrets live only in environment variables (`.env`, gitignored).
- Errors returned to clients never contain stack traces, SQL, or
  password hashes (see `errorHandler`).
