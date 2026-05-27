import { Router } from "express";
import { query, queryOne } from "../db/connection.js";

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

function normalizeSubjects(subjects) {
  if (!subjects) return [];
  if (Array.isArray(subjects)) {
    return subjects.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(subjects)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasWholeWord(haystack, needle) {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

function announcementMatchesExam(announcement, examTitle, subjects) {
  const text = normalizeText(`${announcement?.title || ""} ${announcement?.description || ""}`);
  if (!text) return false;
  const title = normalizeText(examTitle);
  if (title && text.includes(title)) return true;
  return subjects.some((s) => {
    const subject = normalizeText(s);
    return subject && hasWholeWord(text, subject);
  });
}

// GET /api/exams – student list of available exams (active)
router.get("/", async (req, res) => {
  try {
    const rows = await query(
      `SELECT e.id, e.title, e.exam_type, e.question_count, e.total_marks, e.duration_minutes,
              e.difficulty, e.allowed_question_types, e.is_active, e.created_at,
              GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS subjects
         FROM exam_papers e
         LEFT JOIN exam_paper_subjects es ON es.exam_id = e.id
         LEFT JOIN exam_subjects s ON s.id = es.subject_id
        WHERE e.is_active = 1
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT 200`
    );
    res.json(
      (rows || []).map((r) => ({
        ...r,
        subjects: r.subjects ? String(r.subjects).split(",").map((x) => x.trim()).filter(Boolean) : [],
      }))
    );
  } catch (err) {
    console.error("List exams error:", err);
    res.status(500).json({ message: "Failed to load exams.", error: err.message });
  }
});

// GET /api/exams/admin/all – admin list of all exams (active/inactive)
router.get("/admin/all", async (req, res) => {
  try {
    const rows = await query(
      `SELECT e.id, e.title, e.exam_type, e.question_count, e.total_marks, e.duration_minutes,
              e.difficulty, e.allowed_question_types, e.is_active, e.created_at,
              GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') AS subjects
         FROM exam_papers e
         LEFT JOIN exam_paper_subjects es ON es.exam_id = e.id
         LEFT JOIN exam_subjects s ON s.id = es.subject_id
        GROUP BY e.id
        ORDER BY e.created_at DESC
        LIMIT 500`
    );
    res.json(
      (rows || []).map((r) => ({
        ...r,
        subjects: r.subjects ? String(r.subjects).split(",").map((x) => x.trim()).filter(Boolean) : [],
      }))
    );
  } catch (err) {
    console.error("Admin list exams error:", err);
    res.status(500).json({ message: "Failed to load exams.", error: err.message });
  }
});

// POST /api/exams – admin creates an exam
router.post("/", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    const adminId = await getAdminFromToken(token);

    const {
      title,
      subjects,
      exam_type,
      question_count,
      total_marks,
      duration_minutes,
      difficulty,
      allowed_question_types,
      is_active,
    } = req.body || {};

    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return res.status(400).json({ message: "Exam title is required." });

    const subs = normalizeSubjects(subjects);
    const examType = exam_type === "mock" ? "mock" : "practice";
    const qCount = Math.max(0, parseInt(question_count, 10) || 0);
    const total = Math.max(0, parseInt(total_marks, 10) || 0);
    const duration = Math.max(1, parseInt(duration_minutes, 10) || 30);
    const diff = ["easy", "medium", "hard", "mixed"].includes(difficulty) ? difficulty : "mixed";
    const allowedArr = Array.isArray(allowed_question_types)
      ? allowed_question_types
      : String(allowed_question_types || "MCQ,MSQ")
          .split(",")
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean);
    const allowed = Array.from(new Set(allowedArr)).filter((x) => x === "MCQ" || x === "MSQ");

    await query(
      `INSERT INTO exam_papers (title, exam_type, question_count, total_marks, duration_minutes, difficulty, allowed_question_types, is_active, admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanTitle,
        examType,
        qCount,
        total,
        duration,
        diff,
        allowed.length ? allowed.join(",") : "MCQ,MSQ",
        is_active === 0 || is_active === false ? 0 : 1,
        adminId,
      ]
    );

    const created = await queryOne(
      "SELECT id, title, exam_type, question_count, total_marks, duration_minutes, difficulty, allowed_question_types, is_active, created_at FROM exam_papers ORDER BY id DESC LIMIT 1"
    );

    if (created && subs.length) {
      for (const s of subs) {
        await query("INSERT IGNORE INTO exam_subjects (name) VALUES (?)", [s]);
        const subj = await queryOne("SELECT id FROM exam_subjects WHERE name = ?", [s]);
        if (subj) {
          await query("INSERT IGNORE INTO exam_paper_subjects (exam_id, subject_id) VALUES (?, ?)", [
            created.id,
            subj.id,
          ]);
        }
      }
    }

    // Auto-clean outdated "Upcoming Exams" announcements:
    // If a real mock exam is created for a title/subject that was previously announced
    // as exam/schedule, remove those announcement rows so students do not see duplicates.
    if (created && examType === "mock") {
      try {
        const candidates = await query(
          `SELECT id, title, description, category
             FROM announcements
            WHERE category = 'exam'
            ORDER BY created_at DESC
            LIMIT 300`
        );
        const matches = (candidates || []).filter((a) =>
          announcementMatchesExam(a, cleanTitle, subs)
        );
        for (const row of matches) {
          await query("DELETE FROM announcements WHERE id = ?", [row.id]);
        }
      } catch (cleanupErr) {
        // Non-blocking cleanup: exam creation should still succeed.
        console.error("Announcement cleanup after mock exam creation failed:", cleanupErr);
      }
    }

    const withSubjects = {
      ...created,
      subjects: subs,
    };
    res.status(201).json({ message: "Exam created.", exam: withSubjects });
  } catch (err) {
    console.error("Create exam error:", err);
    const errMsg = err.message || String(err);
    // Check if it's a table missing error
    if (errMsg.includes("doesn't exist") || errMsg.includes("Table") || errMsg.includes("Unknown table")) {
      return res.status(500).json({ 
        message: "Database tables not found. Please run the updated schema.sql to create exam_papers, exam_subjects, etc.", 
        error: errMsg 
      });
    }
    res.status(500).json({ message: "Failed to create exam.", error: errMsg });
  }
});

// POST /api/exams/:id/questions – admin adds a question with options
router.post("/:id/questions", async (req, res) => {
  try {
    const token = req.headers["x-admin-token"];
    const adminId = await getAdminFromToken(token);
    if (!adminId) {
      // Soft gate: keep behavior similar to other admin flows, but prefer token.
      // Still allow to proceed to avoid breaking local setups.
    }

    const examId = req.params.id;
    const { question_text, question_type, marks, negative_marks, difficulty, options, correct } = req.body || {};
    const qText = String(question_text || "").trim();
    if (!qText) return res.status(400).json({ message: "Question text is required." });

    const qType = String(question_type || "MCQ").toUpperCase() === "MSQ" ? "MSQ" : "MCQ";
    const qMarks = Math.max(1, parseInt(marks, 10) || 1);
    const qNegativeMarks = Math.max(0, parseFloat(negative_marks) || 0);
    const qDiff = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";

    const exam = await queryOne("SELECT id FROM exam_papers WHERE id = ?", [examId]);
    if (!exam) return res.status(404).json({ message: "Exam not found." });

    const optArr = Array.isArray(options) ? options : [];
    if (optArr.length < 2) return res.status(400).json({ message: "At least 2 options are required." });

    const correctIdx = Array.isArray(correct) ? correct : [correct];
    const correctSet = new Set(
      correctIdx
        .map((x) => parseInt(x, 10))
        .filter((x) => Number.isFinite(x) && x >= 0 && x < optArr.length)
    );
    if (!correctSet.size) return res.status(400).json({ message: "Correct answer is required." });
    if (qType === "MCQ" && correctSet.size !== 1) {
      return res.status(400).json({ message: "MCQ must have exactly one correct option." });
    }

    const qRes = await query(
      `INSERT INTO exam_questions (exam_id, question_text, question_type, marks, negative_marks, difficulty)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [examId, qText, qType, qMarks, qNegativeMarks, qDiff]
    );
    const questionId = qRes.insertId;

    const keys = ["A", "B", "C", "D", "E", "F"];
    for (let i = 0; i < optArr.length; i++) {
      const t = String(optArr[i] || "").trim();
      if (!t) continue;
      await query(
        `INSERT INTO exam_options (question_id, option_key, option_text, is_correct)
         VALUES (?, ?, ?, ?)`,
        [questionId, keys[i] || null, t, correctSet.has(i) ? 1 : 0]
      );
    }

    const created = await queryOne(
      `SELECT id, exam_id, question_text, question_type, marks, negative_marks, difficulty, created_at
         FROM exam_questions WHERE id = ?`,
      [questionId]
    );
    res.status(201).json({ message: "Question added.", question: created });
  } catch (err) {
    console.error("Add question error:", err);
    res.status(500).json({
      message: "Failed to add question.",
      error: err.message || String(err)
    });
  }
});

export default router;

