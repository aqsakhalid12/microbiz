# Architecture

## Overview

MicroBiz is a monolith web application. The browser talks to an Express server, which serves the static frontend and exposes REST APIs. Express talks to PostgreSQL through the `pg` package using raw parameterized SQL.

```
Browser (HTML/CSS/JS + Bootstrap 5)
        |
        v
   Express.js (static frontend + REST API)
        |
   +--------------------+
   | routes             |  Parse URL, call controller
   | middleware         |  Auth, validation, error handling
   | controllers        |  Thin: parse input, call service, send response
   | services           |  Business rules, transactions
   | repositories       |  Raw SQL via pg (parameterized)
   +--------------------+
        |
        v
   PostgreSQL
```

## Layer responsibilities

- **routes** — Define HTTP paths and methods. They map a URL to a controller function. Keep them thin; no business logic here.
- **middleware** — Cross-cutting concerns: authentication (who is this?), authorization (are they allowed?), input validation, request logging, and a global error handler.
- **controllers** — Receive the request, extract data, delegate to a service, format the response or pass errors to `next(err)`. Do not write SQL here.
- **services** — Where business rules live. They orchestrate repositories, enforce rules (stock checks, totals, profit math), and wrap multi-step work in database transactions.
- **repositories** — The only layer that talks to the database. Each repository is responsible for one aggregate (or table) and exposes focused functions using parameterized SQL. No business logic here.

## Folder structure

See the project root `README.md` for the full tree. The backend follows the layered layout above so that business rules stay isolated from HTTP details and from SQL.

## Planned database tables

| Table | Purpose | Ownership |
|-------|---------|-----------|
| `users` | Application users (business owners) | — |
| `business_settings` | Business name, currency, tax settings, low-stock thresholds | Carries `user_id` |
| `products` | Items sold by the business (name, SKU, cost price, sale price, stock) | Carries `user_id` |
| `customers` | People who buy from the business | Carries `user_id` |
| `orders` | Sales orders (status, dates, totals, payment status) | Carries `user_id` |
| `order_items` | Line items inside an order | Tied to owner through parent `order`; must be verified server-side |
| `expenses` | Recorded operating costs (category, amount, date) | Carries `user_id` |
| `inventory_movements` | Audit log of every stock change | Tied to owner through parent `product`; must be verified server-side |

`products`, `customers`, `orders`, `expenses`, and `business_settings` carry `user_id` directly. `order_items` and `inventory_movements` are tied to the owner through their parent order/product and must be verified server-side (never trust a client-supplied product/order ID as proof of ownership).

## Design principles

- The server is the source of truth. Never trust client-supplied totals, user IDs, or stock values. Recompute and verify everything on the server.
- Use parameterized SQL only. No string-built queries.
- Wrap order creation, status changes, stock deduction, and stock restoration in database transactions.
- Money is stored as `NUMERIC(12,2)`.
- Timestamps are stored as `TIMESTAMPTZ`.
- Secrets (database URL, session secret) live only in environment variables, never in code or committed files.

## Authentication note

The authentication strategy (server sessions vs JWT in httpOnly cookie) will be decided and explained in Phase 4.