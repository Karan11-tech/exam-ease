import { Router } from "express";
import { query, queryOne } from "../db/connection.js";

const router = Router();

// Utility: create a notification row
export async function createNotification({ userId, email, role, type, title, message }) {
  const cleanEmail = (email || "").trim();
  if (!cleanEmail || !role || !type || !title || !message) return;
  try {
    await query(
      `INSERT INTO notifications (user_id, email, role, type, title, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, cleanEmail, role, type, title, message]
    );
  } catch (err) {
    console.error("createNotification error:", err.message);
  }
}

// GET /api/notifications?email=&role=&unreadOnly=1
router.get("/", async (req, res) => {
  try {
    const { email, role, unreadOnly } = req.query;
    if (!email || !role) {
      return res.status(400).json({ message: "email and role are required." });
    }
    const params = [email.trim(), role];
    let sql =
      "SELECT id, email, role, type, title, message, is_read, created_at FROM notifications WHERE email = ? AND role = ?";
    if (String(unreadOnly) === "1") {
      sql += " AND is_read = 0";
    }
    sql += " ORDER BY created_at DESC LIMIT 50";
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("List notifications error:", err);
    res.status(500).json({ message: "Failed to load notifications.", error: err.message });
  }
});

// POST /api/notifications/mark-read – mark notifications as read for this user
router.post("/mark-read", async (req, res) => {
  try {
    const { email, role, ids } = req.body || {};
    if (!email || !role) {
      return res.status(400).json({ message: "email and role are required." });
    }
    if (Array.isArray(ids) && ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      await query(
        `UPDATE notifications SET is_read = 1 WHERE email = ? AND role = ? AND id IN (${placeholders})`,
        [email.trim(), role, ...ids]
      );
    } else {
      await query(
        "UPDATE notifications SET is_read = 1 WHERE email = ? AND role = ?",
        [email.trim(), role]
      );
    }
    res.json({ message: "Notifications marked as read." });
  } catch (err) {
    console.error("Mark notifications read error:", err);
    res.status(500).json({ message: "Failed to mark as read.", error: err.message });
  }
});

export default router;

