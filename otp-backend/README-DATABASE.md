# ExamEase – MySQL database setup

## 1. Create database and tables

- Install MySQL and ensure it is running.
- Create the database and tables by running the schema file:

```bash
mysql -u root -p < db/schema.sql
```

Or open `db/schema.sql` in MySQL Workbench / any MySQL client and execute it.

## 2. Environment variables

Copy `env.example` to `.env` and set your values:

- **EMAIL_USER / EMAIL_PASS** – for OTP and contact form (Gmail app password).
- **DB_HOST** – usually `localhost`.
- **DB_USER** – MySQL user (e.g. `root`).
- **DB_PASSWORD** – MySQL password.
- **DB_NAME** – `examease_db` (must match the database created in step 1).

## 3. Default admin (so login works with database)

The super admin (`admin@examease.com` / `Admin@123`) is **only in the database** when you run the seed script. From the project root `otp-backend`:

```bash
node scripts/seed-admin.js
```

This creates one admin user in `users` so that **Admin** login works when the frontend calls the API. (If you open the app as a file or without the backend, the frontend still allows the same credentials without the database.)

## 4. API endpoints (auth)

- **POST /api/auth/register** – Register (email, password, fullName, role).
- **POST /api/auth/login** – Login (email, password, rememberMe, role). Returns `user` and optionally `rememberToken`.
- **GET /api/auth/remember-me?token=...&role=...** – Check saved login (returns `hasSavedLogin`, `email`, `fullName`).
- **POST /api/auth/forget-remember** – Clear saved login (body: `token`, `role`).
- **POST /api/auth/update-password** – Reset password (email, newPassword) after OTP verification.

Passwords are hashed with **bcrypt** before being stored. Login history and Remember Me sessions are stored in the database.

## 5. Login fails? (troubleshooting)

- **"User not found. Please sign up first."**  
  That email is not in the `users` table. Use **Sign Up** to register (after OTP). If you had an account before the database was added, sign up again so a row is created in MySQL.

- **"Incorrect password."**  
  The password does not match the stored hash. Use the same password you set when you signed up, or use **Forgot password** to reset.

- **"This account is not registered as admin/student."**  
  You chose the wrong login type. Switch to **Student** or **Admin** on the login form and try again.

- **Admin login with database:**  
  Run `node scripts/seed-admin.js` once to create the default admin (`admin@examease.com` / `Admin@123`) in the database. Then use **Admin** and those credentials.

- **Backend not running:**  
  Start the server: `npm start` (or `node server.js`) in `otp-backend`. If the frontend is on Live Server (port 5500), it will call `http://localhost:5000`; ensure the backend is listening on that port.

- **Check the exact error:**  
  The login form now shows the message returned by the API (e.g. "User not found", "Incorrect password"). Use the browser **Network** tab to see the request to `/api/auth/login` and the response body.

## 6. Study Materials (admin upload / student download)

The schema includes a **study_materials** table. Admins can add subject-wise resources (e.g. Operating Systems, DBMS, CN) from the admin dashboard by either:

- **Uploading a PDF** – stored under `otp-backend/uploads/study-materials/`.
- **Entering structured content** – notes, important topics, examples, practice questions, reference links; the server generates a PDF when the student downloads.

- **GET /api/study-materials** – List all materials (optional `?category=notes|lectures|resources`).
- **GET /api/study-materials/:id** – Get one material.
- **GET /api/study-materials/:id/download** – Serve PDF (add `?preview=1` to open in browser).
- **POST /api/study-materials** – Create (admin; optional `X-Admin-Token`; multipart for PDF upload).
- **PUT /api/study-materials/:id** – Update (admin).
- **DELETE /api/study-materials/:id** – Delete (admin).

If you already ran the schema before this table was added, run only the `CREATE TABLE study_materials ...` part from `db/schema.sql`.
