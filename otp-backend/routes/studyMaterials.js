import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import { fileURLToPath } from "url";
import { query, queryOne } from "../db/connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "study-materials");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (file.originalname || "file").replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = !file.mimetype || file.mimetype === "application/pdf" || file.originalname?.toLowerCase().endsWith(".pdf");
    cb(null, !!ok);
  },
});

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
    } catch (err) {
      console.error("Study materials admin check:", err);
      return res.status(500).json({ message: "Server error." });
    }
  }
  req.adminId = null;
  next();
}

// GET /api/study-materials – list all (students + admin)
router.get("/", async (req, res) => {
  try {
    const category = req.query.category;
    let sql = "SELECT id, subject_name, description, category, file_path, admin_id, created_at FROM study_materials ORDER BY created_at DESC";
    const params = [];
    if (category && ["notes", "lectures", "resources"].includes(category)) {
      sql = "SELECT id, subject_name, description, category, file_path, admin_id, created_at FROM study_materials WHERE category = ? ORDER BY created_at DESC";
      params.push(category);
    }
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("List study materials:", err);
    res.status(500).json({ message: "Failed to list materials.", error: err.message });
  }
});


// GET /api/study-materials/:id – get one
router.get("/:id", async (req, res) => {
  try {
    const row = await queryOne(
      "SELECT id, subject_name, description, category, file_path, admin_id, content_json, created_at FROM study_materials WHERE id = ?",
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: "Material not found." });
    if (row.content_json && typeof row.content_json === "string") row.content_json = JSON.parse(row.content_json);
    res.json(row);
  } catch (err) {
    console.error("Get study material:", err);
    res.status(500).json({ message: "Failed to get material.", error: err.message });
  }
});

// GET /api/study-materials/:id/download – serve PDF (file or generated)
router.get("/:id/download", async (req, res) => {
  try {
    const row = await queryOne("SELECT id, subject_name, description, category, file_path, content_json FROM study_materials WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Material not found." });

    const disposition = req.query.preview ? "inline" : "attachment";
    const filename = (row.subject_name || "material").replace(/[^a-zA-Z0-9.-]/g, "_") + ".pdf";

    if (row.file_path) {
      const fullPath = path.join(__dirname, "..", row.file_path);
      if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "File not found." });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
      fs.createReadStream(fullPath).pipe(res);
      return;
    }

    const content = row.content_json ? (typeof row.content_json === "string" ? JSON.parse(row.content_json) : row.content_json) : {};
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    doc.pipe(res);

    doc.fontSize(18).text(row.subject_name || "Study Material", { align: "center" });
    doc.moveDown();
    if (row.description) doc.fontSize(11).text(row.description, { align: "center" });
    doc.moveDown(1.5);

    if (content.notes) {
      doc.fontSize(14).text("Notes", { underline: true });
      doc.fontSize(10).text(content.notes);
      doc.moveDown(1);
    }
    if (content.important_topics && content.important_topics.length) {
      doc.fontSize(14).text("Important Topics", { underline: true });
      (Array.isArray(content.important_topics) ? content.important_topics : [content.important_topics]).forEach((t) => doc.fontSize(10).text("• " + (typeof t === "string" ? t : String(t))));
      doc.moveDown(1);
    }
    if (content.examples) {
      doc.fontSize(14).text("Examples", { underline: true });
      doc.fontSize(10).text(content.examples);
      doc.moveDown(1);
    }
    if (content.practice_questions && content.practice_questions.length) {
      doc.fontSize(14).text("Practice Questions", { underline: true });
      (Array.isArray(content.practice_questions) ? content.practice_questions : [content.practice_questions]).forEach((q, i) => doc.fontSize(10).text(`${i + 1}. ${typeof q === "string" ? q : String(q)}`));
      doc.moveDown(1);
    }
    if (content.reference_links && content.reference_links.length) {
      doc.fontSize(14).text("Recommended Resources", { underline: true });
      (Array.isArray(content.reference_links) ? content.reference_links : [content.reference_links]).forEach((l) => doc.fontSize(10).text("• " + (typeof l === "string" ? l : String(l))));
    }

    doc.end();
  } catch (err) {
    console.error("Download study material:", err);
    if (!res.headersSent) res.status(500).json({ message: "Failed to generate PDF.", error: err.message });
  }
});

// POST /api/study-materials – create (admin only, optional file upload)
router.post("/", requireAdmin, upload.single("pdf"), async (req, res) => {
  try {
    const subject_name = (req.body.subject_name || req.body.subjectName || "").trim();
    const description = (req.body.description || "").trim();
    const category = ["notes", "lectures", "resources"].includes(req.body.category) ? req.body.category : "notes";
    if (!subject_name) return res.status(400).json({ message: "Subject name is required." });

    let file_path = null;
    if (req.file && req.file.path) {
      file_path = path.relative(path.join(__dirname, ".."), req.file.path).replace(/\\/g, "/");
    }

    let content_json = null;
    const raw = req.body.content_json || req.body.contentJson;
    if (raw) {
      try {
        content_json = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (_) {}
    } else if (req.body.notes || req.body.important_topics || req.body.examples || req.body.reference_links) {
      content_json = {
        notes: req.body.notes || "",
        important_topics: parseList(req.body.important_topics),
        examples: req.body.examples || "",
        practice_questions: parseList(req.body.practice_questions),
        reference_links: parseList(req.body.reference_links),
      };
    }

    await query(
      `INSERT INTO study_materials (subject_name, description, category, file_path, admin_id, content_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [subject_name, description || null, category, file_path, req.adminId, content_json ? JSON.stringify(content_json) : null]
    );
    const row = await queryOne("SELECT id, subject_name, description, category, file_path, admin_id, created_at FROM study_materials ORDER BY id DESC LIMIT 1");
    res.status(201).json(row);
  } catch (err) {
    console.error("Create study material:", err);
    res.status(500).json({ message: "Failed to create material.", error: err.message });
  }
});

function parseList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string") return [];
  return v.split("\n").map((s) => s.trim()).filter(Boolean);
}

// PUT /api/study-materials/:id – update (admin only)
router.put("/:id", requireAdmin, upload.single("pdf"), async (req, res) => {
  try {
    const existing = await queryOne("SELECT id, file_path FROM study_materials WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ message: "Material not found." });

    const subject_name = (req.body.subject_name || req.body.subjectName || "").trim();
    const description = (req.body.description || "").trim();
    const category = ["notes", "lectures", "resources"].includes(req.body.category) ? req.body.category : undefined;

    let file_path = existing.file_path;
    if (req.file && req.file.path) {
      if (existing.file_path) {
        const oldPath = path.join(__dirname, "..", existing.file_path);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      file_path = path.relative(path.join(__dirname, ".."), req.file.path).replace(/\\/g, "/");
    }

    let content_json = null;
    const raw = req.body.content_json || req.body.contentJson;
    if (raw) {
      try {
        content_json = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (_) {}
    } else if (req.body.notes || req.body.important_topics || req.body.examples || req.body.reference_links) {
      content_json = {
        notes: req.body.notes || "",
        important_topics: parseList(req.body.important_topics),
        examples: req.body.examples || "",
        practice_questions: parseList(req.body.practice_questions),
        reference_links: parseList(req.body.reference_links),
      };
    }

    const updates = [];
    const params = [];
    if (subject_name) { updates.push("subject_name = ?"); params.push(subject_name); }
    if (description !== undefined) { updates.push("description = ?"); params.push(description); }
    if (category) { updates.push("category = ?"); params.push(category); }
    if (file_path !== undefined) { updates.push("file_path = ?"); params.push(file_path); }
    if (content_json !== undefined) { updates.push("content_json = ?"); params.push(content_json ? JSON.stringify(content_json) : null); }
    if (updates.length === 0) {
      const row = await queryOne("SELECT id, subject_name, description, category, file_path, admin_id, created_at FROM study_materials WHERE id = ?", [req.params.id]);
      return res.json(row);
    }
    params.push(req.params.id);
    await query(`UPDATE study_materials SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
    const row = await queryOne("SELECT id, subject_name, description, category, file_path, admin_id, created_at FROM study_materials WHERE id = ?", [req.params.id]);
    res.json(row);
  } catch (err) {
    console.error("Update study material:", err);
    res.status(500).json({ message: "Failed to update material.", error: err.message });
  }
});

// DELETE /api/study-materials/:id – delete (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const row = await queryOne("SELECT id, file_path FROM study_materials WHERE id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Material not found." });
    if (row.file_path) {
      const fullPath = path.join(__dirname, "..", row.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await query("DELETE FROM study_materials WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted." });
  } catch (err) {
    console.error("Delete study material:", err);
    res.status(500).json({ message: "Failed to delete material.", error: err.message });
  }
});

export default router;
