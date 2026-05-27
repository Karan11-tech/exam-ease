import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { query, queryOne } from "../db/connection.js";

const router = Router();
const SALT_ROUNDS = 10;
const REMEMBER_ME_DAYS = 14;
const SESSION_DAYS = 1;

// Helper: create secure token for Remember Me
function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

// POST /api/auth/register – signup (student or admin by role)
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    const username = fullName || req.body.username || email;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const userRole = role === "admin" ? "admin" : "student";
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await query(
      `INSERT INTO users (email, password_hash, full_name, role, account_status)
       VALUES (?, ?, ?, ?, 'active')`,
      [email.trim(), passwordHash, username.trim(), userRole]
    );

    const user = await queryOne("SELECT id, email, full_name, role, created_at FROM users WHERE email = ?", [email.trim()]);
    res.status(201).json({ message: "Registration successful.", user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "An account with this email already exists." });
    }
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed.", error: err.message });
  }
});

// POST /api/auth/login – verify credentials, optionally create Remember Me token
router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe, role: requestRole } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await queryOne(
      "SELECT id, email, password_hash, full_name, role, account_status FROM users WHERE email = ?",
      [email.trim()]
    );

    if (!user) {
      return res.status(401).json({ message: "User not found. Please sign up first." });
    }

    if (user.account_status === "blocked") {
      return res.status(403).json({ message: "Your account has been blocked. Contact admin." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // Role must match (student vs admin)
    const role = user.role === "admin" ? "admin" : "student";
    if (requestRole && requestRole !== role) {
      return res.status(403).json({ message: "This account is not registered as " + requestRole + "." });
    }

    // Log login
    await query(
      "INSERT INTO login_history (user_id, email, role) VALUES (?, ?, ?)",
      [user.id, user.email, role]
    );

    const token = createToken();
    const expiresAt = new Date(
      Date.now() + (rememberMe ? REMEMBER_ME_DAYS : SESSION_DAYS) * 24 * 60 * 60 * 1000
    );
    // Keep one active token per user-role to avoid stale auth confusion.
    await query("DELETE FROM sessions WHERE user_id = ? AND role = ?", [user.id, role]);
    await query(
      `INSERT INTO sessions (user_id, token, role, expires_at, last_login_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [user.id, token, role, expiresAt]
    );

    res.json({
      message: "Login successful.",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role,
      },
      rememberToken: token,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed.", error: err.message });
  }
});

// GET /api/auth/remember-me?token=...&role=student|admin – check saved login for popup
router.get("/remember-me", async (req, res) => {
  try {
    const { token, role } = req.query;
    if (!token || !role) {
      return res.status(400).json({ hasSavedLogin: false });
    }

    const session = await queryOne(
      `SELECT s.id, s.user_id, s.expires_at, u.email, u.full_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.role = ? AND s.expires_at > NOW()`,
      [token, role]
    );

    if (!session) {
      return res.json({ hasSavedLogin: false });
    }

    res.json({
      hasSavedLogin: true,
      email: session.email,
      fullName: session.full_name,
    });
  } catch (err) {
    console.error("Remember-me check error:", err);
    res.status(500).json({ hasSavedLogin: false });
  }
});

// POST /api/auth/forget-remember – clear Remember Me for this role (when user clicks No)
router.post("/forget-remember", async (req, res) => {
  try {
    const { token, role } = req.body;
    if (token) {
      await query("DELETE FROM sessions WHERE token = ?", [token]);
    }
    res.json({ message: "Saved login cleared." });
  } catch (err) {
    console.error("Forget-remember error:", err);
    res.status(500).json({ message: "Failed to clear." });
  }
});

// POST /api/auth/update-password – for forgot-password flow (by email after OTP verified)
router.post("/update-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ message: "Email and new password are required." });
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const user = await queryOne("SELECT id FROM users WHERE email = ?", [email.trim()]);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    await query("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [passwordHash, user.id]);
    await query("DELETE FROM sessions WHERE user_id = ?", [user.id]);
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("Update password error:", err);
    res.status(500).json({ message: "Failed to update password.", error: err.message });
  }
});

export default router;
