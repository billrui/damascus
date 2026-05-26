# Royal Palm API — Phase 1

Express + PostgreSQL + Redis backend for the Royal Palm POS & Inventory system.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally **or** Docker
- Redis 7+ running locally **or** Docker

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone and enter the directory
cd royal-palm-api

# 2. Copy env and fill in JWT_SECRET
cp .env.example .env
# Edit .env — generate a secret with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 3. Start Postgres + Redis
docker-compose up postgres redis -d

# 4. Install dependencies
npm install

# 5. Run migrations
npm run migrate

# 6. Seed the database
npm run seed

# 7. Start the API
npm run dev
```

API is now running at **http://localhost:3001**

---

## Quick Start (Local Postgres + Redis)

```bash
# 1. Create the database
createdb royalpalm
psql royalpalm -c "CREATE USER posuser WITH PASSWORD 'secret';"
psql royalpalm -c "GRANT ALL PRIVILEGES ON DATABASE royalpalm TO posuser;"

# 2. Copy and edit env
cp .env.example .env
# Set DATABASE_URL=postgresql://posuser:secret@localhost:5432/royalpalm

# 3. Install, migrate, seed, run
npm install
npm run migrate
npm run seed
npm run dev
```

---

## API Endpoints — Phase 1

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with user_id + PIN |
| POST | `/api/auth/refresh` | Refresh access token (uses cookie) |
| POST | `/api/auth/logout` | Revoke tokens |
| GET | `/api/auth/me` | Get current user |

### Users

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/api/users` | settings |
| GET | `/api/users/:id` | settings |
| POST | `/api/users` | settings |
| PATCH | `/api/users/:id` | settings |
| DELETE | `/api/users/:id` | admin only |

---

## Testing Auth Flow

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "pin": "0000"}' \
  -c cookies.txt

# Copy the access_token from the response, then:

# Get current user
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <access_token>"

# Refresh token (uses cookie automatically)
curl -X POST http://localhost:3001/api/auth/refresh \
  -b cookies.txt

# Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -b cookies.txt
```

---

## Seed Credentials

| User | user_id | PIN | Role |
|------|---------|-----|------|
| John Kamau | 1 | 0000 | admin |
| Peter Otieno | 2 | 1111 | cashier |
| Alice Wangari | 3 | 2222 | waiter |
| Brian Omondi | 4 | 3333 | waiter |
| Chef Kamau | 5 | 4444 | kitchen |

---

## Project Structure

```
src/
├── app.js                  Main Express app
├── config/
│   ├── db.js               PostgreSQL pool
│   ├── redis.js            Redis client + helpers
│   └── env.js              Validated env vars
├── middleware/
│   ├── auth.js             verifyJWT, requireRole, requirePermission
│   ├── validate.js         Zod request validation
│   ├── rateLimit.js        Redis-backed rate limiter
│   └── errorHandler.js     Global error + 404 handler
├── routes/
│   ├── auth.js             Login / refresh / logout / me
│   └── users.js            User CRUD
├── services/
│   └── authService.js      JWT issue / rotate / revoke
└── db/
    ├── migrate.js          Migration runner
    ├── migrations/
    │   ├── 001_users_auth.sql
    │   ├── 002_menu_inventory_schema.sql
    │   ├── 003_inventory_transactions.sql
    │   └── 004_pos_shifts_sales.sql
    └── seeds/
        └── seed.js
```

---

## Next: Phase 2

Menu items, POS sales with FEFO stock deduction, receipt PDF generation, hold orders + Socket.IO KDS.
