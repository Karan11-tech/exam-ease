import { Router } from "express";
import { query, queryOne } from "../db/connection.js";
import { createNotification } from "./notifications.js";

const router = Router();

const CATEGORIES = ["Study Materials", "Doubt Support", "Exams", "Career Section", "Technical Issues"];

// POST /api/feedback – student submits feedback
router.post("/", async (req, res) => {
  try {
    const { email, name, category, rating, message } = req.body;
    if (!email || !message) {
      return res.status(400).json({ message: "Email and message are required." });
    }
    const studentEmail = String(email).trim();
    const msg = String(message).trim();
    if (!msg) return res.status(400).json({ message: "Message cannot be empty." });

    const cat = category && CATEGORIES.includes(category) ? category : "Technical Issues";
    const r = Math.min(5, Math.max(1, parseInt(rating, 10) || 0)) || 1;
    let studentName = name ? String(name).trim() : null;
    const user = await queryOne("SELECT full_name FROM users WHERE email = ?", [studentEmail]);
    if (user && !studentName) studentName = user.full_name;

    await query(
      `INSERT INTO feedback (student_email, student_name, category, rating, message, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [studentEmail, studentName || null, cat, r, msg]
    );

    const created = await queryOne(
      `SELECT id, student_email, student_name, category, rating, message, status, created_at
       FROM feedback WHERE student_email = ? ORDER BY created_at DESC LIMIT 1`,
      [studentEmail]
    );

    res.status(201).json({ message: "Thank you! Your feedback has been submitted.", feedback: created });
  } catch (err) {
    console.error("Submit feedback error:", err);
    res.status(500).json({ message: "Failed to submit feedback.", error: err.message });
  }
});

// GET /api/feedback?email= – list feedback for a student (their submissions)
// GET /api/feedback?list=all&status=pending – list all feedback for admin (optionally filtered by status)
router.get("/", async (req, res) => {
  try {
    const { email, list, status } = req.query;

    if (list === "all") {
      let sql = `SELECT id, student_email, student_name, category, rating, message, admin_reply, status, created_at, updated_at
                 FROM feedback`;
      const params = [];
      if (status && ["pending", "reviewed", "resolved"].includes(status)) {
        sql += " WHERE status = ?";
        params.push(status);
      }
      sql += " ORDER BY created_at DESC LIMIT 200";
      const rows = await query(sql, params);
      return res.json(rows);
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }
    const rows = await query(
      `SELECT id, student_email, student_name, category, rating, message, admin_reply, status, created_at, updated_at
       FROM feedback
       WHERE student_email = ?
       ORDER BY created_at DESC
       LIMIT 100`,
      [String(email).trim()]
    );
    res.json(rows);
  } catch (err) {
    console.error("List feedback error:", err);
    res.status(500).json({ message: "Failed to load feedback.", error: err.message });
  }
});

// PATCH /api/feedback/:id – admin replies and/or updates status (reviewed/resolved)
router.patch("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status, adminReply } = req.body;

    const existing = await queryOne(
      "SELECT id, student_email, student_name, status FROM feedback WHERE id = ?",
      [id]
    );
    if (!existing) {
      return res.status(404).json({ message: "Feedback not found." });
    }

    const updates = [];
    const params = [];
    if (status && ["pending", "reviewed", "resolved"].includes(status)) {
      updates.push("status = ?");
      params.push(status);
    }
    if (adminReply !== undefined) {
      updates.push("admin_reply = ?");
      params.push(String(adminReply).trim() || null);
    }
    if (updates.length === 0) {
      return res.status(400).json({ message: "Provide status and/or adminReply." });
    }
    params.push(id);
    await query(
      `UPDATE feedback SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    const updated = await queryOne(
      `SELECT id, student_email, student_name, category, rating, message, admin_reply, status, created_at, updated_at
       FROM feedback WHERE id = ?`,
      [id]
    );

    // Notify student when status becomes reviewed or resolved
    const newStatus = status || existing.status;
    if (newStatus === "reviewed" || newStatus === "resolved") {
      try {
        await createNotification({
          userId: null,
          email: existing.student_email,
          role: "student",
          type: "feedback_response",
          title: newStatus === "resolved" ? "Your feedback has been resolved" : "Your feedback has been reviewed",
          message: (adminReply && String(adminReply).trim())
            ? String(adminReply).trim().slice(0, 150) + (String(adminReply).trim().length > 150 ? "..." : "")
            : "Admin has updated the status of your feedback."
        });
      } catch (_) {}
    }

    res.json({ message: "Feedback updated.", feedback: updated });
  } catch (err) {
    console.error("Update feedback error:", err);
    res.status(500).json({ message: "Failed to update feedback.", error: err.message });
  }
});

export default router;
