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
2. **.env** – Create `.env` with:
   - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - `JWT_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - `PORT` (default 5000)
3. **Branch** – Insert at least one branch: `INSERT INTO branches (name, created_at, updated_at) VALUES ('Main Branch', NOW(), NOW());`

## Tech Stack

- Node.js + Express
- MySQL + Sequelize
- JWT + bcrypt
