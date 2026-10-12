# MicroBiz

Small business management web application for home-based businesses and independent sellers.

## Tech Stack

- Frontend: HTML5, CSS3, Vanilla JavaScript, Bootstrap 5 (no React/Vue/Next.js)
- Backend: Node.js, Express.js, REST APIs
- Database: PostgreSQL using the `pg` package, with raw parameterized SQL (no ORM)
- Delivery: dotenv, Postman, Git/GitHub. Express serves the static frontend initially (monolith).

## Project status

Phase 2 complete: database schema, migrations, and seed data

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