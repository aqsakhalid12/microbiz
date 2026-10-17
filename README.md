# MicroBiz

Small business management web application for home-based businesses and independent sellers.

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript, Bootstrap 5 (no React/Vue/Next.js)
- Backend: Node.js, Express.js, REST APIs
- Database: PostgreSQL using the `pg` package, with raw parameterized SQL (no ORM)
- Delivery: dotenv, Postman, Git/GitHub. Express serves the static frontend initially (monolith).

## Project status

Phase 8 complete: order management

## Pages & routes

| Route | Page | Access |
|-------|------|--------|
| `GET /` | redirects to `/dashboard` | everyone |
| `GET /login` | login.html | guests (redirects to `/dashboard` if logged in) |
| `GET /register` | register.html | guests |
| `GET /dashboard` | dashboard.html | logged-in users |
| `GET /products` | products.html | logged-in users |
| GET /inventory | inventory.html | logged-in users |
| GET /customers | customers.html | logged-in users |
| GET /orders | orders.html | logged-in users |

The design system includes CSS variables, base styles, layout (sidebar/topbar), and components (stat cards, badges, empty states, skeletons, tables, forms, toasts). All UI is built with HTML5, CSS3, and vanilla JavaScript using Bootstrap 5.3 (CDN) and Bootstrap Icons (CDN).

## Running the app

1. Make sure PostgreSQL is running and `.env` contains a valid `DATABASE_URL`
2. Development (auto-restart on changes): `npm run dev`
3. Production: `npm start`
4. Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)
   returns `{ "success": true, "status": "ok", "database": "connected", ... }`

## Authentication

Session-based auth (server-side sessions in PostgreSQL, httpOnly cookie). Endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (validates input, bcrypt-hashes the password) and log in |
| POST | `/api/auth/login` | Log in (regenerates the session to prevent fixation) |
| POST | `/api/auth/logout` | Log out (destroys the session and clears the cookie) |
| GET | `/api/auth/me` | Current user profile; requires login (`401` otherwise) |

Demo login (development only, after `npm run db:seed` and `npm run db:demo-password`):

- Email: `demo@microbiz.test`
- Password: `Demo@12345`

See `docs/security.md` for the full security design (password rules, session
settings, rate limiting, CSRF, and the data isolation rule).

## API Endpoints

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (validates input, bcrypt-hashes the password) and log in |
| POST | `/api/auth/login` | Log in (regenerates the session to prevent fixation) |
| POST | `/api/auth/logout` | Log out (destroys the session and clears the cookie) |
| GET | `/api/auth/me` | Current user profile; requires login (`401` otherwise) |

### Products & Inventory

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (query: search, category, stock, page, limit, sort) |
| GET | `/api/products/categories` | List product categories |
| GET | `/api/products/low-stock` | List low-stock products |
| GET | `/api/products/:id` | Get a single product |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product (stock_quantity not allowed) |
| DELETE | `/api/products/:id` | Soft-delete a product |
| POST | `/api/products/:id/stock-adjustments` | Adjust product stock |
| GET | `/api/products/:id/movements` | List movement history for a product |
| GET | `/api/inventory/movements` | List all inventory movements (query: product_id, type, page, limit) |

See `docs/api-products.md` for full request/response documentation.

## Folder structure

```
microbiz/
├── backend/
│   └── src/
│       ├── config/       # Environment and database configuration
│       ├── routes/       # HTTP route definitions
│       ├── controllers/  # Request/response handling
│       ├── services/     # Business logic
│       ├── repositories/ # Database access (raw SQL via pg)
│       ├── middleware/   # Express middleware (auth, validation, errors)
│       ├── validators/   # Input validation helpers
│       └── utils/       # Shared utilities (dates, money, etc.)
├── tests/               # Backend tests
├── frontend/
│   ├── css/
│   ├── js/
│   │   ├── api/         # Thin API client wrappers (fetch calls)
│   │   ├── components/  # Reusable UI components
│   │   └── pages/       # Page-level logic
│   ├── assets/images/
│   └── pages/           # HTML page files
├── database/
│   ├── migrations/      # SQL schema migrations
│   ├── seeds/           # Seed data
│   └── scripts/         # One-off SQL scripts
├── docs/                # Design and scope documentation
└── postman/             # Postman collection exports
```

## Getting started

### Database setup

1. Create a PostgreSQL database named `microbiz` (e.g., using pgAdmin or `createdb microbiz`)
2. Copy `.env.example` to `.env` and update `DATABASE_URL` with your credentials
3. Run migrations: `npm run db:migrate`
4. Seed development data: `npm run db:seed`
5. To reset the database (development only): `npm run db:reset`

## Planned phases

1. Foundation
2. Database schema
3. Express server
4. Authentication
5. Frontend layout
6. Products and inventory
7. Customers
8. Orders
9. Expenses
10. Dashboard and reports
11. Settings and UX polish
12. Testing
13. Deployment and handover
