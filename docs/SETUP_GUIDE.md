# Restaurant POS - Complete Setup Guide for Beginners

This guide explains everything you need to set up the backend from scratch. Read each section to understand **why** we do things, not just **how**.

---

## Table of Contents
1. [Understanding the Database](#1-understanding-the-database)
2. [Creating Your MySQL Database](#2-creating-your-mysql-database)
3. [Understanding JWT_SECRET](#3-understanding-jwt_secret)
4. [Configuring Your .env File](#4-configuring-your-env-file)
5. [Understanding sequelize.sync()](#5-understanding-sequelizesync)
6. [Running the Application](#6-running-the-application)
7. [Testing Your Setup](#7-testing-your-setup)

---

## 1. Understanding the Database

### What is a database?
A database is where your application stores data permanently (users, products, orders, etc.). When you restart the server, the data stays.

### Why MySQL?
Your project uses **MySQL** - a popular relational database. The connection details are in your `.env` file:
- `DB_HOST` - where MySQL runs (usually `localhost`)
- `DB_USER` - MySQL username
- `DB_PASS` - MySQL password  
- `DB_NAME` - the name of your database

### What is Sequelize?
**Sequelize** is an ORM (Object-Relational Mapping). Instead of writing raw SQL like `SELECT * FROM users`, you write JavaScript: `User.findAll()`. Sequelize translates it to SQL for you.

---

## 2. Creating Your MySQL Database

You need to create an **empty database** before the app runs. Sequelize will create the tables (users, user_details, customers, etc.) automatically - but the database itself must exist first.

### Step 2.1: Check if MySQL is installed

Open a terminal and run:
```bash
mysql --version
```

If you see a version number (e.g. `mysql  Ver 8.0.x`), MySQL is installed. If you get "command not found", you need to install MySQL first.

### Step 2.2: Install MySQL (if needed)

**Option A - Windows:**
- Download MySQL Installer from: https://dev.mysql.com/downloads/installer/
- Run it and choose "Developer Default" or "Server only"
- During setup, set a **root password** - remember this! It goes in `DB_PASS`
- MySQL usually runs on port 3306

**Option B - Using XAMPP/WAMP:**
- If you have XAMPP or WAMP, MySQL is included
- Start MySQL from the control panel
- Default user: `root`, default password: often empty or `""`

### Step 2.3: Create the database

**Method 1 - Using MySQL Command Line:**

1. Open terminal and connect to MySQL:
   ```bash
   mysql -u root -p
   ```
   (Enter your MySQL password when prompted)

2. Create the database:
   ```sql
   CREATE DATABASE restaurant_pos;
   ```

3. Verify it exists:
   ```sql
   SHOW DATABASES;
   ```
   You should see `restaurant_pos` in the list.

4. Exit:
   ```sql
   exit;
   ```

**Method 2 - Using phpMyAdmin (if you have XAMPP/WAMP):**

1. Open http://localhost/phpmyadmin
2. Click "New" or "Databases"
3. Enter database name: `restaurant_pos`
4. Click "Create"

---

## 3. Understanding JWT_SECRET

### What is JWT?
**JWT (JSON Web Token)** is used for authentication. When a user logs in, the server creates a token (like a temporary ID card) and sends it to the frontend. The frontend sends this token with every request to prove "I am logged in as user X".

### What is JWT_SECRET?
The **JWT_SECRET** is a secret key used to **sign** the token. Think of it like a seal/stamp:

- **Signing**: When you create a token, you "stamp" it with JWT_SECRET. Only someone with this secret can create valid tokens.
- **Verifying**: When a request comes with a token, the server checks if it was signed with the same JWT_SECRET. If someone tampered with the token, the signature won't match and the request is rejected.

### Why does it need to be secret?
If someone steals your JWT_SECRET, they can create fake tokens and pretend to be any user. So:
- **Never** commit JWT_SECRET to Git (that's why `.env` is in `.gitignore`)
- Use a long, random string
- Use different secrets for development vs production

### How to generate a secure JWT_SECRET

**Yes, run these in your terminal** (VS Code terminal, PowerShell, or Command Prompt).

**Option 1a - One-line command:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
- Run it from your project folder (`d:\kodetech\restaurant-pos`)
- A long random string will appear below the command - that's your JWT_SECRET
- If you see nothing: try Option 1b, or check you're in the right directory (`cd d:\kodetech\restaurant-pos`)

**Option 1b - Script (works on all terminals):**
```bash
node scripts/generate-jwt-secret.js
```
This does the same thing - run it from the project root. Copy the output.

**Option 2 - Online generator:**
- Go to https://generate-secret.vercel.app/64 (or similar)
- Copy the generated string

**Option 3 - Simple (development only):**
For local development you can use something like `my_super_secret_key_12345` - but **never** use this in production!

---

## 4. Configuring Your .env File

Your `.env` file holds **environment variables** - configuration that changes between your computer and production, and should never be in Git.

### Complete .env template

Create or update your `.env` file in the project root:

```env
# Server port (5000 is common for Node.js APIs)
PORT=5000

# MySQL connection - use the password you set during MySQL installation
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password_here
DB_NAME=restaurant_pos

# Environment (development or production)
NODE_ENV=development

# JWT secret - use the one you generated in Section 3
JWT_SECRET=paste_your_generated_secret_here

# Vercel Blob - for image uploads (get from Vercel dashboard if needed)
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

### Important notes:
- **DB_PASS**: The password you set when installing MySQL (or empty if you didn't set one)
- **DB_NAME**: Must match the database you created (`restaurant_pos`)
- **JWT_SECRET**: Paste the random string you generated
- **PORT**: Your current `.env` has `PORT=3306` - that's MySQL's port! Change it to `5000` so your Node.js server doesn't conflict with MySQL

---

## 5. Understanding sequelize.sync()

### What does it do?
When your app starts, this line runs:
```javascript
sequelize.sync().then(() => { ... })
```

**sync()** tells Sequelize: "Make the database tables match my models."

- If tables don't exist → Sequelize **creates** them
- If tables exist but columns changed → Sequelize **alters** them (adds new columns, etc.)
- It does NOT delete existing data when adding columns

### First run (empty database)
- No tables exist
- Sequelize creates: `users`, `user_details`, `customers`, `products`, `orders`
- You're good to go!

### If you had old data
The old User model had `role: 'admin' | 'staff'`. The new one has `role: 'admin' | 'manager' | 'cashier'`. If you had users with `role = 'staff'`, that value is no longer valid in the new enum. You'd need to either:
- Drop the database and start fresh: `DROP DATABASE restaurant_pos; CREATE DATABASE restaurant_pos;`
- Or run a migration to update `staff` → `cashier`

Since you're starting fresh, you don't need to worry about this.

### sync() vs migrations (for later)
In production, teams often use **migrations** - versioned SQL files - instead of `sync()`. For learning and development, `sync()` is fine.

---

## 6. Running the Application

### Step 1: Install dependencies (if not done)
```bash
npm install
```

### Step 2: Start the server
```bash
npm run dev
```

You should see:
```
Database connected and synced
Server running on port 5000
```

### If you see errors:

**"Database connection failed"**
- Check MySQL is running
- Check `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` in `.env`
- Verify the database `restaurant_pos` exists

**"Access denied for user"**
- Wrong `DB_PASS` - double-check your MySQL root password

**"Port 5000 already in use"**
- Another app is using port 5000 - change `PORT` in `.env` to 5001 or 3001

---

## 7. Testing Your Setup

### Test 1: Register a user

Open Postman, Insomnia, or use curl:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin1\",\"password\":\"admin123\",\"role\":\"admin\",\"name\":\"Admin User\",\"employeeId\":\"EMP001\",\"passcode\":\"1234\"}"
```

You should get: `{"message":"User created","userId":1}`

### Test 2: Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin1\",\"password\":\"admin123\"}"
```

You should get a response with `token` and `user` object.

### Test 3: Verify passcode (admin/manager only)

Copy the `token` from the login response, then:

```bash
curl -X POST http://localhost:5000/api/auth/verify-passcode \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d "{\"passcode\":\"1234\"}"
```

---

## Quick Checklist

Before running the app, make sure:

- [ ] MySQL is installed and running
- [ ] Database `restaurant_pos` is created
- [ ] `.env` file exists with correct `DB_*` values
- [ ] `JWT_SECRET` is set (long random string)
- [ ] `PORT` is 5000 (not 3306)
- [ ] `npm install` has been run

---

## Next Steps

Once everything works:
1. Explore the API with Postman - try register, login, products, orders
2. Read the code in `src/controllers/UserController.js` to see how auth works
3. Learn about the auth middleware in `src/middleware/auth.js` - it protects routes

---

*Questions? Ask your senior or refer back to this guide. Good luck!*
