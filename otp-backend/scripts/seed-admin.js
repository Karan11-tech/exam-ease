/**
 * Inserts the default super admin into the database so login works via the API.
 * Run from otp-backend: node scripts/seed-admin.js
 * Credentials: admin@examease.com / Admin@123 (same as frontend fallback)
 */
import "./load-env.js";
import bcrypt from "bcrypt";
import { query, queryOne } from "../db/connection.js";

const ADMIN_EMAIL = "admin@examease.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_NAME = "ExamEase Admin";
const SALT_ROUNDS = 10;

async function seed() {
  try {
    const existing = await queryOne("SELECT id FROM users WHERE email = ?", [ADMIN_EMAIL]);
    if (existing) {
      console.log("Admin user already exists. No change.");
      process.exit(0);
      return;
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    await query(
      `INSERT INTO users (email, password_hash, full_name, role, account_status)
       VALUES (?, ?, ?, 'admin', 'active')`,
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );
    console.log("Default admin created: " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
