import { Router } from "express";
import { query, queryOne } from "../db/connection.js";
import { createNotification } from "./notifications.js";

const router = Router();

// Helper: resolve admin from X-Admin-Token (Remember Me session)
async function getAdminFromToken(token) {
  if (!token) return { adminId: null, adminName: null };
  const row = await queryOne(
    `SELECT s.user_id, u.full_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.role = 'admin' AND s.expires_at > NOW()`,
    [token]
  );
  if (!row) return { adminId: null, adminName: null };
  return { adminId: row.user_id, adminName: row.full_name || null };
}

// POST /api/doubts – student submits a doubt
router.post("/", async (req, res) => {
  try {
    const { email, name, question, subject } = req.body;
    if (!email || !question) {
      return res.status(400).json({ message: "Email and question are required." });
    }
    const studentEmail = email.trim();
    const qText = String(question).trim();
    if (!qText) {
      return res.status(400).json({ message: "Question cannot be empty." });
    }

    let userId = null;
    let studentName = name ? String(name).trim() : null;
    const user = await queryOne(
      "SELECT id, full_name FROM users WHERE email = ?",
      [studentEmail]
    );
    if (user) {
      userId = user.id;
      if (!studentName) studentName = user.full_name;
    }

    const result = await query(
      `INSERT INTO doubts (user_id, student_email, student_name, subject, question, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [userId, studentEmail, studentName || null, subject || null, qText]
    );

    const created = await queryOne(
      `SELECT id, user_id, student_email, student_name, subject, question, answer, status,
              created_at, answered_at, answered_by_id, answered_by_name
         FROM doubts
        WHERE student_email = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      [studentEmail]
    );

    // Notify admins (role=admin, email left blank so admin can fetch all)
    try {
      await createNotification({
        userId: null,
        email: "admin@examease.com", // primary admin; change if needed
        role: "admin",
        type: "new_doubt",
        title: "New student doubt received",
        message: `${studentName || "Student"} asked: ${qText.slice(0, 120)}${qText.length > 120 ? "..." : ""}`
      });
    } catch (_) {}

    res.status(201).json({ message: "Doubt submitted successfully.", doubt: created });
  } catch (err) {
    console.error("Create doubt error:", err);
    res.status(500).json({ message: "Failed to submit doubt.", error: err.message });
  }
});

// GET /api/doubts – list doubts
// - For students:  /api/doubts?email=student@example.com
// - For admins:    /api/doubts?status=pending|answered|all
router.get("/", async (req, res) => {
  try {
    const { email, status } = req.query;

    if (email) {
      const rows = await query(
        `SELECT id, user_id, student_email, student_name, subject, question, answer, status,
                created_at, answered_at, answered_by_id, answered_by_name
           FROM doubts
          WHERE student_email = ?
          ORDER BY created_at DESC`,
        [email.trim()]
      );
      return res.json(rows);
    }

    let sql =
      "SELECT id, user_id, student_email, student_name, subject, question, answer, status, created_at, answered_at, answered_by_id, answered_by_name FROM doubts";
    const params = [];
    if (status && status !== "all") {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("List doubts error:", err);
    res.status(500).json({ message: "Failed to list doubts.", error: err.message });
  }
});

// POST /api/doubts/:id/answer – admin answers a doubt
router.post("/:id/answer", async (req, res) => {
  try {
    const doubtId = req.params.id;
    const { answer, adminName } = req.body;
    if (!answer) {
      return res.status(400).json({ message: "Answer text is required." });
    }

    const existing = await queryOne(
      `SELECT id, status FROM doubts WHERE id = ?`,
      [doubtId]
    );
    if (!existing) {
      return res.status(404).json({ message: "Doubt not found." });
    }

    const token = req.headers["x-admin-token"];
    const { adminId, adminName: resolvedName } = await getAdminFromToken(token);
    const finalAdminName = resolvedName || adminName || "Admin";

    await query(
      `UPDATE doubts
          SET answer = ?, status = 'answered', answered_at = NOW(),
              answered_by_id = ?, answered_by_name = ?
        WHERE id = ?`,
      [String(answer).trim(), adminId, finalAdminName, doubtId]
    );

    const updated = await queryOne(
      `SELECT id, user_id, student_email, student_name, subject, question, answer, status,
              created_at, answered_at, answered_by_id, answered_by_name
         FROM doubts
        WHERE id = ?`,
      [doubtId]
    );

    // Notify student about the answer
    try {
      await createNotification({
        userId: updated.user_id || null,
        email: updated.student_email,
        role: "student",
        type: "doubt_answer",
        title: "Your doubt has been answered",
        message: `Your question: ${String(updated.question || "").slice(0, 120)}${String(updated.question || "").length > 120 ? "..." : ""}`
      });
    } catch (_) {}

    res.json({ message: "Answer saved.", doubt: updated });
  } catch (err) {
    console.error("Answer doubt error:", err);
    res.status(500).json({ message: "Failed to save answer.", error: err.message });
  }
});

export default router;

