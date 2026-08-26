# MedClinic — Clinic Management System

A full-stack clinic management skeleton built with **Express + Prisma + PostgreSQL** on the backend and **React (Vite)** on the frontend.

---

## Project Structure

```
Project MED/
├── backend/              # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma # Database schema
│   │   └── seed.js       # Demo data seeder
│   ├── src/
│   │   ├── config.js     # Env-based configuration
│   │   ├── db.js         # Prisma client singleton
│   │   ├── index.js      # Express entry point
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   └── routes/
│   │       ├── health.js
│   │       └── clinics.js
│   ├── .env              # Local config (not committed)
│   ├── .env.example      # Template for .env
│   └── package.json
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── App.jsx       # Login screen (placeholder)
│   │   ├── App.css       # Login styles
│   │   ├── index.css     # Design system / tokens
│   │   └── main.jsx      # React entry
│   ├── .env              # VITE_API_URL
│   └── package.json
├── docs/
│   ├── SCHEMA.md         # Database conventions
│   └── API.md            # API reference
└── README.md             # ← You are here
```

---

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (running locally or via Docker)
- **npm** ≥ 9

---

## Quick Start

### 1. Create the database

```bash
# Using psql:
createdb clinic_db

# Or via Docker:
docker run -d --name clinic-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=clinic_db \
  -p 5432:5432 \
  postgres:16
```

### 2. Set up the backend

```bash
cd backend
npm install

# Copy and edit the env file (update DATABASE_URL if needed):
cp .env.example .env

# Run Prisma migrations:
npm run db:migrate

# Seed the demo clinic:
npm run db:seed

# Start the dev server:
npm run dev
```

The API will be running at **http://localhost:4000**. Verify with:

```bash
curl http://localhost:4000/api/health
```

### 3. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

The app will open at **http://localhost:5173**. You should see the login screen with a green "API connected" status badge.

---

## Environment Configuration

### Switching between local and cloud Postgres

The **only** thing you need to change is the `DATABASE_URL` in `backend/.env`:

```env
# Local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clinic_db?schema=public"

# Cloud (example)
DATABASE_URL="postgresql://user:pass@cloud-host:5432/clinic_db?schema=public&sslmode=require"
```

No code changes required.

### Frontend API URL

In `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

---

## Schema Conventions

Every table in this project follows strict conventions for multi-tenancy readiness. See [docs/SCHEMA.md](docs/SCHEMA.md) for the full specification.

**TL;DR:** Every business table must have `clinic_id`, `created_at`, `updated_at`, and `synced` columns.

---

## Available Scripts

### Backend (`/backend`)

| Script           | Description                            |
|-----------------|----------------------------------------|
| `npm run dev`    | Start with hot-reload (nodemon)       |
| `npm start`      | Production start                      |
| `npm run db:migrate` | Run Prisma migrations             |
| `npm run db:push`| Push schema without migration files    |
| `npm run db:studio`| Open Prisma Studio (GUI)            |
| `npm run db:seed`| Seed demo data                        |

### Frontend (`/frontend`)

| Script           | Description                            |
|-----------------|----------------------------------------|
| `npm run dev`    | Start Vite dev server                 |
| `npm run build`  | Production build                      |
| `npm run preview`| Preview production build              |

---

## What's Next

This is the **skeleton phase only**. Future phases will add:

- Authentication & role-based access
- Patient management
- Appointments & scheduling
- Billing & invoicing
- Inventory tracking
- Lab results
- Cloud sync

All will follow the schema conventions defined in this phase.
