import { Router } from "express";
import PDFDocument from "pdfkit";
import { query, queryOne } from "../db/connection.js";

const router = Router();

// GET /api/notes?email=&subject=&topic=&search=
router.get("/", async (req, res) => {
  try {
    const { email, subject, topic, search } = req.query;
    if (!email) return res.status(400).json({ message: "email is required." });
    const params = [String(email).trim()];
    let sql =
      "SELECT id, student_email, subject_name, topic_name, context_type, context_ref, title, content, is_bookmarked, created_at, updated_at FROM notes WHERE student_email = ?";
    if (subject) {
      sql += " AND subject_name = ?";
      params.push(String(subject).trim());
    }
    if (topic) {
      sql += " AND topic_name = ?";
      params.push(String(topic).trim());
    }
    if (search) {
      sql += " AND (title LIKE ? OR content LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like);
    }
    sql += " ORDER BY updated_at DESC, created_at DESC LIMIT 200";
    const rows = await query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("List notes error:", err);
    res.status(500).json({ message: "Failed to load notes.", error: err.message });
  }
});

// POST /api/notes – create note
router.post("/", async (req, res) => {
  try {
    const {
      email,
      subject_name,
      topic_name,
      context_type,
      context_ref,
      title,
      content,
      is_bookmarked,
    } = req.body || {};
    const studentEmail = String(email || "").trim();
    const body = String(content || "").trim();
    if (!studentEmail || !body) {
      return res.status(400).json({ message: "Email and content are required." });
    }
    const ctype = ["material", "exam_question", "quiz", "general"].includes(context_type)
      ? context_type
      : "general";
    const bookmark = is_bookmarked ? 1 : 0;
    await query(
      `INSERT INTO notes (student_email, subject_name, topic_name, context_type, context_ref, title, content, is_bookmarked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentEmail,
        subject_name || null,
        topic_name || null,
        ctype,
        context_ref || null,
        title || null,
        body,
        bookmark,
      ]
    );
    const created = await queryOne(
      `SELECT id, student_email, subject_name, topic_name, context_type, context_ref, title, content, is_bookmarked, created_at, updated_at
         FROM notes
        WHERE student_email = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      [studentEmail]
    );
    res.status(201).json({ message: "Note saved.", note: created });
  } catch (err) {
    console.error("Create note error:", err);
    res.status(500).json({ message: "Failed to save note.", error: err.message });
  }
});

// GET /api/notes/export?email=&subject=&topic= – export notes as PDF
router.get("/export", async (req, res) => {
  try {
    const { email, subject, topic } = req.query;
    if (!email) return res.status(400).json({ message: "email is required." });
    const params = [String(email).trim()];
    let sql =
      "SELECT subject_name, topic_name, title, content, context_type, context_ref, created_at FROM notes WHERE student_email = ?";
    if (subject) {
      sql += " AND subject_name = ?";
      params.push(String(subject).trim());
    }
    if (topic) {
      sql += " AND topic_name = ?";
      params.push(String(topic).trim());
    }
    sql += " ORDER BY subject_name, topic_name, created_at";
    const rows = await query(sql, params);
    const list = rows || [];

    const disposition = req.query.preview ? "inline" : "attachment";
    const filename = "notes.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(18).text("My Notes", { align: "center" });
    doc.moveDown();
    if (subject) doc.fontSize(12).text("Subject: " + String(subject), { align: "center" });
    if (topic) doc.fontSize(12).text("Topic: " + String(topic), { align: "center" });
    doc.moveDown(1.5);

    if (!list.length) {
      doc.fontSize(12).text("No notes found for the selected filters.");
      doc.end();
      return;
    }

    let currentSubject = null;
    let currentTopic = null;
    for (const n of list) {
      if (n.subject_name && n.subject_name !== currentSubject) {
        currentSubject = n.subject_name;
        currentTopic = null;
        doc.moveDown(0.8);
        doc.fontSize(14).text(currentSubject, { underline: true });
        doc.moveDown(0.2);
      }
      if (n.topic_name && n.topic_name !== currentTopic) {
        currentTopic = n.topic_name;
        doc.moveDown(0.4);
        doc.fontSize(12).text("Topic: " + currentTopic, { italics: true });
        doc.moveDown(0.2);
      }
      const noteTitle = n.title || "(Untitled note)";
      doc.fontSize(12).text("• " + noteTitle, { continued: false });
      if (n.created_at) {
        doc.fontSize(9).fillColor("gray").text(String(n.created_at), { align: "right" });
        doc.fillColor("black");
      }
      doc.moveDown(0.2);
      doc.fontSize(11).text(n.content || "", { align: "left" });
      doc.moveDown(0.6);
    }

    doc.end();
  } catch (err) {
    console.error("Export notes error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to export notes.", error: err.message });
    }
  }
});

/** Shared PDF body for one note (used by GET /download; same query style as /api/certificates). */
async function streamSingleNotePdf(req, res, id, email) {
  if (!Number.isFinite(id) || !email) {
    return res.status(400).json({ message: "email and id are required." });
  }
  const row = await queryOne(
    `SELECT id, student_email, subject_name, topic_name, title, content, created_at, updated_at
       FROM notes
      WHERE id = ? AND student_email = ?`,
    [id, email]
  );
  if (!row) {
    return res.status(404).json({ message: "Note not found." });
  }

  const disposition = req.query.preview ? "inline" : "attachment";
  const rawName = String(row.title || "note").replace(/[^\w\-]+/g, "_").slice(0, 80) || "note";
  const filename = `${rawName}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(18).text(row.title || "(Untitled note)", { align: "center" });
  doc.moveDown(0.5);
  const meta = [row.subject_name, row.topic_name].filter(Boolean).join(" · ");
  if (meta) {
    doc.fontSize(11).fillColor("gray").text(meta, { align: "center" });
    doc.fillColor("black");
    doc.moveDown(0.5);
  }
  const stamp = row.updated_at || row.created_at;
  if (stamp) {
    doc.fontSize(9).fillColor("gray").text(String(stamp), { align: "right" });
    doc.fillColor("black");
    doc.moveDown(0.5);
  }
  doc.fontSize(11).text(row.content || "", { align: "left" });
  doc.end();
}

/** Registered on the app as GET /api/notes/download (see server.js) so routing always matches. */
export async function handleNotePdfDownload(req, res) {
  try {
    const id = parseInt(String(req.query.id || ""), 10);
    const email = String(req.query.email || "").trim();
    await streamSingleNotePdf(req, res, id, email);
  } catch (err) {
    console.error("Export single note PDF error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to export note.", error: err.message });
    }
  }
}

// PUT /api/notes/:id – update note
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid note id." });
    const { email, title, content, is_bookmarked, subject_name, topic_name } = req.body || {};
    if (!email) return res.status(400).json({ message: "email is required." });

    const existing = await queryOne("SELECT id, student_email FROM notes WHERE id = ?", [id]);
    if (!existing || existing.student_email !== String(email).trim()) {
      return res.status(404).json({ message: "Note not found." });
    }

    const updates = [];
    const params = [];
    if (title !== undefined) {
      updates.push("title = ?");
      params.push(title || null);
    }
    if (content !== undefined) {
      const body = String(content || "").trim();
      if (!body) return res.status(400).json({ message: "Content cannot be empty." });
      updates.push("content = ?");
      params.push(body);
    }
    if (is_bookmarked !== undefined) {
      updates.push("is_bookmarked = ?");
      params.push(is_bookmarked ? 1 : 0);
    }
    if (subject_name !== undefined) {
      updates.push("subject_name = ?");
      params.push(subject_name || null);
    }
    if (topic_name !== undefined) {
      updates.push("topic_name = ?");
      params.push(topic_name || null);
    }
    if (!updates.length) {
      const row = await queryOne(
        "SELECT id, student_email, subject_name, topic_name, context_type, context_ref, title, content, is_bookmarked, created_at, updated_at FROM notes WHERE id = ?",
        [id]
      );
      return res.json(row);
    }
    params.push(id);
    await query(`UPDATE notes SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);
    const row = await queryOne(
      "SELECT id, student_email, subject_name, topic_name, context_type, context_ref, title, content, is_bookmarked, created_at, updated_at FROM notes WHERE id = ?",
      [id]
    );
    res.json({ message: "Note updated.", note: row });
  } catch (err) {
    console.error("Update note error:", err);
    res.status(500).json({ message: "Failed to update note.", error: err.message });
  }
});

// DELETE /api/notes/:id – delete note
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const email = String((req.body && req.body.email) || req.query.email || "").trim();
    if (!Number.isFinite(id) || !email) {
      return res.status(400).json({ message: "id and email are required." });
    }
    const existing = await queryOne("SELECT id, student_email FROM notes WHERE id = ?", [id]);
    if (!existing || existing.student_email !== email) {
      return res.status(404).json({ message: "Note not found." });
    }
    await query("DELETE FROM notes WHERE id = ?", [id]);
    res.json({ message: "Note deleted." });
  } catch (err) {
    console.error("Delete note error:", err);
    res.status(500).json({ message: "Failed to delete note.", error: err.message });
  }
});

export default router;

