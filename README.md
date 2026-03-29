# Cashbit - Personal Finance Tracker

A full-stack personal finance web application for recording income/expense transactions, organizing by category, setting monthly budgets, and visualizing spending through charts and analytics.

**Tech stack:** React + Tailwind CSS · Node.js + Express · PostgreSQL + Prisma · JWT auth · Docker Compose

## Quick Start

1. Clone the repo and create your `.env`:

```bash
cp .env.example .env
```

2. Update `.env` with your own values (especially `JWT_SECRET` and `POSTGRES_PASSWORD`).

3. Start everything:

```bash
docker-compose up --build
```

This will start PostgreSQL, run migrations, seed demo data, and launch both the API server and the React client.

| Service  | URL                     |
|----------|-------------------------|
| Client   | http://localhost:3000    |
| API      | http://localhost:3001    |
| Postgres | localhost:5432           |

## Demo Credentials

| Email              | Password      |
|--------------------|---------------|
| demo@example.com   | password123   |

The seed script pre-populates 3 months of sample transactions and budgets for this account.

## Environment Variables

| Variable            | Description                          | Default         |
|---------------------|--------------------------------------|-----------------|
| `POSTGRES_USER`     | PostgreSQL username                  | `finance`       |
| `POSTGRES_PASSWORD` | PostgreSQL password                  | `changeme`      |
| `POSTGRES_DB`       | PostgreSQL database name             | `finance_tracker` |
| `JWT_SECRET`        | Secret for signing JWTs (min 32 chars) | —             |
| `NODE_ENV`          | `development` or `production`        | `development`   |
| `LOG_LEVEL`         | pino log level                       | `info`          |

## Project Structure

```
├── docker-compose.yml
├── .env.example
├── server/                    # Node.js + Express API
│   ├── prisma/
│   │   ├── schema.prisma      # Database models
│   │   └── seed.ts            # Demo data seeder
│   └── src/
│       ├── index.ts           # Express bootstrap
│       ├── config.ts          # Environment config
│       ├── logger.ts          # pino logger
│       ├── errors/            # AppError class
│       ├── middleware/         # auth, validation, rate-limit, error handler
│       ├── schemas/           # Zod request schemas
│       ├── routes/            # Express route handlers
│       ├── services/          # Business logic layer
│       └── utils/             # Date, decimal, CSV helpers
└── client/                    # React + Tailwind SPA
    └── src/
        ├── api/               # Axios client with token interceptor
        ├── context/           # Auth context (useReducer)
        ├── hooks/             # TanStack Query hooks
        ├── pages/             # Dashboard, Transactions, Trends, Budgets, Login, Register
        ├── components/        # Shared UI components
        └── utils/             # Formatting utilities
```

## API Overview

All responses follow the envelope format: `{ success, data }` on success, `{ success, error, code }` on failure.

- **Auth** — `POST /auth/register`, `/login`, `/refresh`, `/logout` · `GET /auth/me`
- **Transactions** — CRUD at `/transactions` with pagination, filtering, search, and CSV export
- **Categories** — CRUD at `/categories` (8 defaults + user-created)
- **Budgets** — `GET /budgets?month=YYYY-MM` · `PUT /budgets/:categoryId`
- **Analytics** — `GET /analytics/summary?month=YYYY-MM` · `GET /analytics/trends`
- **Metrics** — `GET /metrics` (Prometheus format)

## Running Tests

```bash
cd server
npm test
```

Property-based tests (fast-check) and unit tests live in `server/src/__tests__/`.

## License

[MIT](LICENSE)
