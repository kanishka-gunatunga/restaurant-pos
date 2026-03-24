# Restaurant POS - Backend

Node.js/Express backend for a restaurant Point of Sale system.

## Quick Start

```bash
npm install
npm run dev
```

Server runs on http://localhost:5000

## Setup

1. **MySQL** – Create database: `CREATE DATABASE restaurant_pos;`
2. **Branch** – Insert at least one branch: `INSERT INTO branches (name, created_at, updated_at) VALUES ('Main Branch', NOW(), NOW());`

## Tech Stack

- Node.js + Express
- MySQL + Sequelize
- JWT + bcrypt

## Auth errors

- **401** — Missing/invalid/expired JWT (`authenticate` middleware).
- **403** with `{ "code": "INVALID_MANAGER_PASSCODE", "message": "..." }` — Wrong or missing manager passcode on an **already authenticated** request (sessions, order cancel/edit, `POST /api/auth/verify-passcode`). Does not indicate logout-worthy session failure.

## Cancel order (server-owned refunds)

`PUT /api/orders/:id/status` with `{ "status": "cancel", "passcode": "<manager>" }`:

1. **403** + `INVALID_MANAGER_PASSCODE` if passcode fails — **no** changes to orders or payments.
2. **200** with full order JSON (same shape as `GET /api/orders/:id`: `items`, `payments`, `paymentStatus`, `balanceDue`) if already `cancel` (idempotent).
3. Otherwise one transaction: remove pending payment rows, full refund on `paid` / `partial_refund` tenders (cash drawer adjusted when `paymentMethod === 'cash'`), set order `cancel`, sync aggregates. **Do not** call payment refund APIs after cancel; refunds are handled here.

Invalid JWT → **401** (unchanged).
