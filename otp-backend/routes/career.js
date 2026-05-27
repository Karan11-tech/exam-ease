import { Router } from "express";
import { query, queryOne } from "../db/connection.js";

const router = Router();

async function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (token) {
    try {
      const session = await queryOne(
        "SELECT user_id FROM sessions WHERE token = ? AND role = 'admin' AND expires_at > NOW()",
        [token]
      );
      if (session) {
        req.adminId = session.user_id;
        return next();
      }
    } catch (_) {}
  }
  req.adminId = null;
  next();
}

// GET /api/career/resources – tips, exam strategy, resume, interview (for student dashboard)
router.get("/resources", async (req, res) => {
  try {
    const { category } = req.query;
    let sql =
      "SELECT id, title, category, content, created_at FROM career_resources ORDER BY created_at DESC";
    const params = [];
    if (category && ["tips", "exam_strategy", "resume", "interview"].includes(category)) {
      sql = "SELECT id, title, category, content, created_at FROM career_resources WHERE category = ? ORDER BY created_at DESC";
      params.push(category);
    }
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("List career resources error:", err);
    res.status(500).json({ message: "Failed to load resources.", error: err.message });
  }
});

// GET /api/career/opportunities – internships/jobs (for student dashboard)
router.get("/opportunities", async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, source, company, role_title, location, apply_url, deadline, tags, created_at
       FROM career_opportunities
       ORDER BY deadline IS NULL ASC, deadline ASC, created_at DESC
       LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    console.error("List career opportunities error:", err);
    res.status(500).json({ message: "Failed to load opportunities.", error: err.message });
  }
});

// POST /api/career/resources – admin adds tip / resume / interview content
router.post("/resources", requireAdmin, async (req, res) => {
  try {
    const { title, category, content } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required." });
    }
    const cat = ["tips", "exam_strategy", "resume", "interview"].includes(category) ? category : "tips";
    await query(
      "INSERT INTO career_resources (title, category, content, admin_id) VALUES (?, ?, ?, ?)",
      [String(title).trim(), cat, String(content).trim(), req.adminId]
    );
    const row = await queryOne(
      "SELECT id, title, category, content, created_at FROM career_resources ORDER BY id DESC LIMIT 1"
    );
    res.status(201).json(row);
  } catch (err) {
    console.error("Create career resource error:", err);
    res.status(500).json({ message: "Failed to add resource.", error: err.message });
  }
});

// POST /api/career/opportunities – admin adds job/internship link (or for cron to use)
router.post("/opportunities", requireAdmin, async (req, res) => {
  try {
    const { source, company, role_title, location, apply_url, deadline } = req.body || {};
    if (!company || !role_title || !apply_url) {
      return res.status(400).json({ message: "Company, role title, and apply URL are required." });
    }
    const src = ["linkedin", "internshala", "indeed", "naukri", "other"].includes(source) ? source : "other";
    await query(
      "INSERT INTO career_opportunities (source, company, role_title, location, apply_url, deadline) VALUES (?, ?, ?, ?, ?, ?)",
      [src, String(company).trim(), String(role_title).trim(), location ? String(location).trim() : null, String(apply_url).trim(), deadline || null]
    );
    const row = await queryOne(
      "SELECT id, source, company, role_title, location, apply_url, deadline, created_at FROM career_opportunities ORDER BY id DESC LIMIT 1"
    );
    res.status(201).json(row);
  } catch (err) {
    console.error("Create career opportunity error:", err);
    res.status(500).json({ message: "Failed to add opportunity.", error: err.message });
  }
});

export default router;
