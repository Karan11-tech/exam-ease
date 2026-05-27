import { Router } from "express";
import { query, queryOne } from "../db/connection.js";
import { createNotification } from "./notifications.js";

const router = Router();

async function getAdminFromToken(token) {
  if (!token) return null;
  try {
    const row = await queryOne(
      `SELECT s.user_id
         FROM sessions s
        WHERE s.token = ? AND s.role = 'admin' AND s.expires_at > NOW()`,
      [token]
    );
    return row ? row.user_id : null;
  } catch (_) {
    return null;
  }
}

function extractAdminToken(req) {
  const rawAuth = req.headers.authorization || req.headers.Authorization || "";
  const bearer = typeof rawAuth === "string" && rawAuth.startsWith("Bearer ")
    ? rawAuth.slice(7).trim()
    : "";
  return req.headers["x-admin-token"] || bearer || "";
}

const ANNOUNCEMENT_CATEGORIES = new Set(["exam", "study", "career", "general"]);

// GET /api/announcements – list for students (latest first)
// Optional: ?category=exam|study|career|general to filter (e.g. dashboard "Upcoming Exams" strip)
router.get("/", async (req, res) => {
  try {
    // Integer only — embed LIMIT in SQL. Prepared LIMIT ? often triggers ER_WRONG_ARGUMENTS on some MySQL builds.
    const limitNum = Math.max(1, Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100));
    const catRaw = req.query.category != null ? String(req.query.category).toLowerCase().trim() : "";
    const category = ANNOUNCEMENT_CATEGORIES.has(catRaw) ? catRaw : "";

    let sql = `SELECT id, title, description, category, link_url, created_at
         FROM announcements`;
    const params = [];
    if (category) {
      sql += " WHERE category = ?";
      params.push(category);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limitNum}`;

    const rows = await query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("List announcements error:", err);
    res.status(500).json({ message: "Failed to load announcements.", error: err.message });
  }
});

// GET /api/announcements/admin – full list for admin panel
router.get("/admin", async (_req, res) => {
  try {
    const rows = await query(
      `SELECT a.id, a.title, a.description, a.category, a.link_url, a.created_at,
              u.full_name AS created_by_name, u.email AS created_by_email
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.created_at DESC
        LIMIT 200`
    );
    res.json(rows || []);
  } catch (err) {
    console.error("Admin list announcements error:", err);
    res.status(500).json({ message: "Failed to load announcements.", error: err.message });
  }
});

// POST /api/announcements – admin creates an announcement
router.post("/", async (req, res) => {
  try {
    const token = extractAdminToken(req);
    const adminId = await getAdminFromToken(token);
    if (!adminId) {
      return res.status(401).json({ message: "Admin authentication required." });
    }

    const { title, description, category, link_url } = req.body || {};
    const cleanTitle = String(title || "").trim();
    const cleanDesc = String(description || "").trim();
    if (!cleanTitle || !cleanDesc) {
      return res.status(400).json({ message: "Title and description are required." });
    }
    const cat = ANNOUNCEMENT_CATEGORIES.has(String(category || "").toLowerCase())
      ? String(category).toLowerCase()
      : "general";
    const link = link_url ? String(link_url).trim().slice(0, 512) : null;

    const insertRes = await query(
      `INSERT INTO announcements (title, description, category, link_url, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [cleanTitle, cleanDesc, cat, link, adminId]
    );
    const id = insertRes.insertId;

    const created = await queryOne(
      `SELECT id, title, description, category, link_url, created_at
         FROM announcements
        WHERE id = ?`,
      [id]
    );

    // Fan-out notification to all active students
    try {
      const students = await query(
        `SELECT id, email
           FROM users
          WHERE role = 'student' AND account_status = 'active'`
      );
      const messageSnippet =
        cleanDesc.length > 200 ? cleanDesc.slice(0, 197) + "..." : cleanDesc;
      await Promise.all(
        (students || []).map((s) =>
          createNotification({
            userId: s.id,
            email: s.email,
            role: "student",
            type: "announcement",
            title: cleanTitle,
            message: messageSnippet,
          })
        )
      );
    } catch (err) {
      console.error("Announcement notification fan-out error:", err);
    }

    res.status(201).json({ message: "Announcement created.", announcement: created });
  } catch (err) {
    console.error("Create announcement error:", err);
    res.status(500).json({ message: "Failed to create announcement.", error: err.message });
  }
});

// DELETE handler is registered on the app in server.js as app.delete("/api/announcements/:id", …)
// so the route always matches (same pattern as other top-level API routes) and never falls through to the /api 404 handler.
export async function deleteAnnouncementById(req, res) {
  try {
    const token = extractAdminToken(req);
    const adminUserId = await getAdminFromToken(token);
    if (!adminUserId) {
      return res.status(401).json({ message: "Admin authentication required." });
    }
    const rawId = req.params.id;
    const id = parseInt(String(rawId), 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: "Invalid announcement id." });
    }
    const result = await query(`DELETE FROM announcements WHERE id = ?`, [id]);
    const affected = result && typeof result.affectedRows === "number" ? result.affectedRows : 0;
    if (affected === 0) {
      return res.status(404).json({ message: "Announcement not found." });
    }
    res.json({ message: "Announcement deleted.", id });
  } catch (err) {
    console.error("Delete announcement error:", err);
    res.status(500).json({ message: "Failed to delete announcement.", error: err.message });
  }
}

export default router;

