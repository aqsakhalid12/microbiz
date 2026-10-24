# MicroBiz

MicroBiz is a small business management web application for home-based businesses and independent sellers. It is an internal tool rather than a public store: a private workspace where the owner runs products, stock, customers, orders, expenses and reporting. There is no public catalogue, cart or checkout for outside visitors — every route and API call requires the signed-in owner. The frontend is plain HTML/CSS/vanilla JavaScript served by the same Express process that exposes the JSON API, so one Node.js process runs the whole product.

## Why MicroBiz

MicroBiz is not an online store. It is a back-office tool for home-based sellers who take orders on WhatsApp or Instagram and need to track stock, customer payments and real profit in one place. It answers three questions: how much stock do I have, who owes me money, and what did I actually earn this month.

**Status:** All 13 planning phases implemented; deployment guide in docs/.
**Live demo:** https://microbiz-pi.vercel.app (free hosting; first load may take a few seconds). Register a new account to try it. Demo data is only available locally.

## Features

- **Authentication with server-side sessions** — register, log in, log out; session records live in PostgreSQL, the browser only holds a cookie.
- **Business settings** — business name, currency and profile for the signed-in owner.
- **Dashboard with real data** — revenue, gross profit, expenses, net profit, order counts, sales trend, low-stock list and recent orders.
- **Products and inventory movements** — product CRUD, soft delete, categories, search/filter/sort/pagination, stock adjustments and a full movement history.
- **Customers** — customer CRUD with order history and spend totals.
- **Orders** — order capture with safe stock transactions, a status workflow (Pending, Confirmed, Processing, Completed, Cancelled) and payment tracking (Unpaid, Partially Paid, Paid).
- **Expenses** — expense CRUD with categories, search and date filters.
- **Date-filtered reports** — summary, sales trend, low-stock and recent-orders reports over a selected period.
- **Low-stock alerts** — per-product threshold surfaced on the dashboard and in reports.

## Tech stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Bootstrap 5 (CDN) and Bootstrap Icons — no framework, no build step.
- **Backend:** Node.js with Express 5, exposing a REST JSON API.
- **Database:** PostgreSQL through the `pg` driver using raw, parameterized SQL — no ORM.
- **Sessions and passwords:** `express-session` with `connect-pg-simple` (session table in PostgreSQL), passwords hashed with `bcryptjs`.
- **Tooling:** dotenv, nodemon, Postman collections, Git.

## Architecture

Every request walks the same path, and each layer only talks to the one below it.

```
Browser (static HTML/CSS/JS) ── fetch() JSON + session cookie ──▶
Express routes + middleware (auth, validation, rate limit, Origin check)
        ▼
Controllers (HTTP request/response)
        ▼
Services (business logic, transactions)
        ▼
Repositories (parameterized SQL via pg)
        ▼
PostgreSQL
```

### Folder structure

```
microbiz/
├── backend/
│   ├── src/
│   │   ├── config/       # environment and database configuration
│   │   ├── routes/       # HTTP route definitions
│   │   ├── controllers/  # request/response handling
│   │   ├── services/     # business logic
│   │   ├── repositories/ # database access (raw SQL via pg)
│   │   ├── middleware/   # auth, validation, error handling
│   │   ├── validators/   # input validation helpers
│   │   └── utils/        # shared helpers
│   └── tests/            # backend test suites
├── frontend/
│   ├── css/              # variables, base, layout, components
│   ├── js/
│   │   ├── api/          # thin fetch wrappers
│   │   ├── components/   # reusable UI helpers
│   │   └── pages/        # page-level logic
│   ├── assets/images/
│   └── pages/            # HTML pages
├── database/
│   ├── migrations/       # SQL schema migrations
│   ├── seeds/            # development seed data
│   └── scripts/          # migrate / seed / demo password scripts
├── docs/                 # scope, architecture, business rules, security, API docs
├── postman/              # Postman collection export
└── .env.example
```

## Getting started

**Prerequisites:** Node.js 20+ and a running PostgreSQL server.

```bash
git clone <repository-url>
cd microbiz
npm install
```

Create the database (for example `createdb microbiz`), then copy the environment template and fill in the two values that matter:

```bash
cp .env.example .env
```

- `DATABASE_URL` — the PostgreSQL connection string, e.g. `postgresql://postgres:your_password@localhost:5432/microbiz`
- `SESSION_SECRET` — a long random string; generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

Prepare the database and start the app:

```bash
npm run db:migrate        # create/upgrade the schema
npm run db:seed           # insert development data
npm run db:demo-password  # set the demo account password (development only)
npm run dev               # nodemon, serves http://localhost:3000
```

Open http://localhost:3000 and sign in with the demo account:

- Email: `demo@microbiz.test`
- Password: `Demo@12345`

> The demo account exists for development only — never create it in production.
> Demo account exists only in local development.

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run the server (`node backend/src/server.js`) |
| `npm run dev` | Run the server with nodemon (auto-restart on changes) |
| `npm test` | Placeholder test command |
| `npm run db:migrate` | Apply the migrations in `database/migrations/` |
| `npm run db:seed` | Load the development seed data |
| `npm run db:reset` | Reset the database (development only) |
| `npm run db:demo-password` | Set the demo account password (development only) |
| `npm run test:auth` | Auth API tests |
| `npm run test:products` | Products and inventory API tests |
| `npm run test:customers` | Customers API tests |
| `npm run test:orders` | Orders API tests |
| `npm run test:expenses` | Expenses API tests |
| `npm run test:reports` | Reports API tests |
| `npm run test:settings` | Settings API tests |

### Testing

The backend suites run against the configured database and assert both behaviour and per-user data isolation:

```bash
npm run test:auth
npm run test:products
npm run test:customers
npm run test:orders
npm run test:expenses
npm run test:reports
npm run test:settings
```

A Postman collection is exported to `postman/microbiz.postman_collection.json`. Import it into Postman, set the collection variable `baseUrl` (for example `http://localhost:3000`), and run **Auth > Login** first — the remaining requests reuse the session cookie it creates.

## Pages and API overview

| Page | Route | API prefix | Reference |
|------|-------|------------|-----------|
| Dashboard | `/dashboard` | `/api/reports` | [docs/business-rules.md](docs/business-rules.md) |
| Products | `/products` | `/api/products` | [docs/api-products.md](docs/api-products.md) |
| Inventory | `/inventory` | `/api/inventory` | [docs/api-products.md](docs/api-products.md) |
| Customers | `/customers` | `/api/customers` | [docs/api-customers.md](docs/api-customers.md) |
| Orders | `/orders` | `/api/orders` | [docs/api-orders.md](docs/api-orders.md) |
| Expenses | `/expenses` | `/api/expenses` | [docs/api-expenses.md](docs/api-expenses.md) |
| Reports | `/reports` | `/api/reports` | [docs/business-rules.md](docs/business-rules.md) |
| Settings | `/settings` | `/api/settings` | [docs/architecture.md](docs/architecture.md) |
| Auth | `/login`, `/register` | `/api/auth` | [docs/security.md](docs/security.md) |

**Registration body** — `POST /api/auth/register` expects the key `fullName` (not `name`):

```json
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "a-strong-password",
  "businessName": "Ada's Store"
}
```

## Business rules

- **Revenue** counts only `Completed` orders, dated by `completed_at` rather than `order_date`.
- **Cost of goods** is read from the `order_items` snapshot (`quantity * unit_cost`), so later price edits never rewrite history.
- **Net profit** = gross profit (revenue − cost of goods) − expenses, with expenses grouped by `expense_date`.
- **Cash collected** is reported separately from revenue, over its own window and excluding cancelled orders.
- **Stock** is deducted exactly once, when an order moves from `Pending` to `Confirmed`; cancelling a confirmed order restores the stock and writes the matching movement.

See [docs/business-rules.md](docs/business-rules.md) and [docs/database-schema.md](docs/database-schema.md).

## Security

- Passwords are hashed with `bcryptjs`; plaintext is never stored.
- Sessions are server-side records in PostgreSQL, delivered through an `httpOnly` cookie.
- Authentication and other sensitive endpoints are rate limited.
- State-changing API calls are checked against the request `Origin` (CSRF defence).
- Every query is scoped to the signed-in user, so one account can never read or write another account's data.
- Totals, revenue and profit are computed on the server and never trusted from the client.
- All SQL is parameterized through `pg`.

Details in [docs/security.md](docs/security.md).

## Deployment

- Hosted on Vercel (serverless Express via api/index.js, static assets copied to public/ by scripts/vercel-build.js)
- Database on Supabase PostgreSQL (Session pooler connection string)
- Environment variables NODE_ENV=production, DATABASE_URL, SESSION_SECRET
- Run npm run db:migrate once against the production database
- Never run db:reset or db:seed in production

## Design decisions

- Customers do not log in; they are records owned by the business owner.
- Online payments and a public storefront are intentionally out of scope for v1.
- Revenue counts only Completed orders; cash collected is shown separately so unpaid orders are never mistaken for income.
- Stock is deducted once, when an order is confirmed, and restored on cancellation, inside database transactions.

## Known limitations

- Email addresses are not verified and there is no password reset. These would be the next features for a production release.
- The live demo runs on free hosting (Vercel serverless + Supabase free tier), so the first request after idle time can be slower.
- Product images are stored as URLs only; there is no file upload.
- Single user role per business; there are no staff accounts or permissions.

## Screenshots

**Dashboard**
![Dashboard](docs/screenshots/dashboard.png)

**Products**
![Products](docs/screenshots/products.png)

**Order details**
![Order details](docs/screenshots/order-view.png)

**Expenses**
![Expenses](docs/screenshots/expenses.png)

**Reports**
![Reports](docs/screenshots/reports.png)

**Mobile view**
<img src="docs/screenshots/mobile.png" width="300" alt="Mobile view">
