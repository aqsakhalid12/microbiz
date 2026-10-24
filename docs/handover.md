# MicroBiz — Client Handover

## 1. Overview

MicroBiz is a small business management web application for home-based businesses and independent sellers: a private, owner-only workspace for products, stock, customers, orders, expenses and reporting. There is no public catalogue, cart or checkout. Live demo: https://microbiz-pi.vercel.app. Source: https://github.com/aqsakhalid12/microbiz.

## 2. Architecture in brief

- Express 5 app (`backend/src/app.js`) exposing a REST JSON API plus static frontend pages.
- PostgreSQL database accessed through the `pg` driver with raw, parameterized SQL (no ORM).
- Sessions are stored server-side in PostgreSQL via `connect-pg-simple`; the browser holds only an httpOnly cookie.
- Hosting: Vercel serverless. `api/index.js` re-exports `backend/src/app`. `scripts/vercel-build.js` copies `frontend/css`, `frontend/js` and `frontend/assets` into `public/`. Page HTML is included via `functions["api/index.js"].includeFiles`.
- Database: Supabase PostgreSQL, connected with the Session pooler connection string.

## 3. Environment variables

Set these in Vercel: Project Settings -> Environment Variables. Redeploy after changing any variable.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set to `production` in Vercel. |
| `DATABASE_URL` | PostgreSQL connection string (Supabase Session pooler in production). |
| `SESSION_SECRET` | Long random string used to sign sessions. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. |

## 4. Local setup

```bash
git clone https://github.com/aqsakhalid12/microbiz.git
cd microbiz
npm install
cp .env.example .env
# edit .env: DATABASE_URL and SESSION_SECRET
npm run db:migrate
npm run db:seed
npm run db:demo-password
npm run dev
```

Open http://localhost:3000. Demo login (local only): demo@microbiz.test / Demo@12345.

## 5. Deploying updates

Push to `main` triggers an automatic Vercel deploy. For database changes, add a new numbered file in `database/migrations/` and run `npm run db:migrate` against production with `DATABASE_URL` set for that command only. Never run `db:reset` or `db:seed` in production.

## 6. Backups and maintenance

- Backups: use the Supabase dashboard backup/restore features for the production database.
- Resetting the Supabase database password: reset it in the Supabase dashboard, then update `DATABASE_URL` in Vercel and redeploy.
- Rotating `SESSION_SECRET` logs every user out (all existing sessions become invalid).

## 7. Testing

```bash
npm run test:auth
npm run test:products
npm run test:customers
npm run test:orders
npm run test:expenses
npm run test:reports
npm run test:settings
```

Tests run against a local server and a local database only. A Postman collection is at `postman/microbiz.postman_collection.json`: set the collection variable `baseUrl` (e.g. `http://localhost:3000`) and run **Auth > Login** first so subsequent requests reuse the session cookie.

## 8. Security notes

- No secrets are committed; `.env` is gitignored. Only `.env.example` (placeholders) is in the repo.
- Every database query is scoped to the signed-in user, giving per-user data isolation.
- Passwords are hashed with bcryptjs; plaintext is never stored.
- Authentication and other sensitive endpoints are rate limited; state-changing calls are checked against the request `Origin`.

## 9. Known limitations and suggested next features

- Email addresses are not verified; there is no password reset.
- Customer ledger, invoices/PDF and a public order link are not implemented.
- Product images are URLs only (no upload); single owner account per business with no staff roles.
- Suggested next features: email verification, password reset, customer ledger, invoices/PDF, public order link.
