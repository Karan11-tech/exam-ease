import { Router } from "express";
import { query, queryOne } from "../db/connection.js";

const router = Router();

async function resolveUserByEmail(email) {
  if (!email) return null;
  return await queryOne("SELECT id, full_name FROM users WHERE email = ?", [String(email).trim()]);
}

function normalizeSelectedIds(selected) {
  if (!selected) return [];
  if (Array.isArray(selected)) return selected.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
  try {
    const parsed = JSON.parse(selected);
    if (Array.isArray(parsed)) return parsed.map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n));
  } catch (_) {}
  const n = parseInt(selected, 10);
  return Number.isFinite(n) ? [n] : [];
}

// POST /api/attempts/start – start an attempt and return exam payload (no correct answers)
// Mock: 1 attempt only; Practice: max 2 attempts. Locked after limit.
router.post("/start", async (req, res) => {
  try {
    const { examId, email, name } = req.body || {};
    if (!examId || !email) return res.status(400).json({ message: "examId and email are required." });
    const studentEmail = String(email).trim();
    const user = await resolveUserByEmail(studentEmail);
    const studentName = (String(name || "").trim() || (user && user.full_name) || null);

    const exam = await queryOne(
      `SELECT id, title, exam_type, question_count, total_marks, duration_minutes, difficulty, allowed_question_types
         FROM exam_papers WHERE id = ? AND is_active = 1`,
      [examId]
    );
    if (!exam) return res.status(404).json({ message: "Exam not found or inactive." });

    const existingCount = await queryOne(
      `SELECT COUNT(*) AS cnt FROM exam_attempts
        WHERE exam_id = ? AND student_email = ? AND status IN ('submitted', 'terminated')`,
      [exam.id, studentEmail]
    );
    const submittedCount = Number(existingCount?.cnt || 0);
    const maxAttempts = exam.exam_type === "mock" ? 1 : 2;
    if (submittedCount >= maxAttempts) {
      const msg =
        exam.exam_type === "mock"
          ? "This Mock Test allows only one attempt and has been permanently locked for you."
          : "This Practice Test allows a maximum of two attempts. You have already used both.";
      return res.status(403).json({ message: msg, code: "EXAM_LOCKED", attemptCount: submittedCount });
    }

    const attemptRes = await query(
      `INSERT INTO exam_attempts (exam_id, user_id, student_email, student_name, status, total_marks)
       VALUES (?, ?, ?, ?, 'in_progress', ?)`,
      [exam.id, user ? user.id : null, studentEmail, studentName, exam.total_marks || 0]
    );
    const attemptId = attemptRes.insertId;

    const questions = await query(
      `SELECT q.id, q.question_text, q.question_type, q.marks
         FROM exam_questions q
        WHERE q.exam_id = ?
        ORDER BY q.id ASC`,
      [exam.id]
    );
    const qIds = (questions || []).map((q) => q.id);
    let options = [];
    if (qIds.length) {
      options = await query(
        `SELECT id, question_id, option_key, option_text
           FROM exam_options
          WHERE question_id IN (${qIds.map(() => "?").join(",")})
          ORDER BY question_id ASC, id ASC`,
        qIds
      );
    }
    const optByQ = new Map();
    (options || []).forEach((o) => {
      if (!optByQ.has(o.question_id)) optByQ.set(o.question_id, []);
      optByQ.get(o.question_id).push({ id: o.id, key: o.option_key, text: o.option_text });
    });

    const payload = {
      attemptId,
      exam: {
        id: exam.id,
        title: exam.title,
        exam_type: exam.exam_type,
        duration_minutes: exam.duration_minutes,
        total_marks: exam.total_marks,
        difficulty: exam.difficulty,
        subjects: [], // filled by /api/exams list; not critical for attempt
      },
      questions: (questions || []).map((q) => ({
        id: q.id,
        text: q.question_text,
        type: q.question_type,
        marks: q.marks,
        options: optByQ.get(q.id) || [],
      })),
    };

    res.status(201).json(payload);
  } catch (err) {
    console.error("Start attempt error:", err);
    res.status(500).json({ message: "Failed to start attempt.", error: err.message });
  }
});

// POST /api/attempts/:id/violation – log suspicious activity and increment count
router.post("/:id/violation", async (req, res) => {
  try {
    const attemptId = req.params.id;
    const { type, detail } = req.body || {};
    const vType = String(type || "").trim();
    if (!vType) return res.status(400).json({ message: "type is required." });
    await query(
      `INSERT INTO exam_violations (attempt_id, v_type, detail) VALUES (?, ?, ?)`,
      [attemptId, vType, detail ? String(detail).slice(0, 255) : null]
    );
    await query(`UPDATE exam_attempts SET violations_count = violations_count + 1 WHERE id = ?`, [attemptId]);
    res.json({ message: "Violation logged." });
  } catch (err) {
    console.error("Log violation error:", err);
    res.status(500).json({ message: "Failed to log violation.", error: err.message });
  }
});

// POST /api/attempts/:id/submit – submit answers and compute score
router.post("/:id/submit", async (req, res) => {
  try {
    const attemptId = req.params.id;
    const { answers, terminated_reason } = req.body || {};

    const attempt = await queryOne(
      `SELECT a.id, a.exam_id, a.status, a.student_email, a.user_id, a.started_at, p.total_marks
         FROM exam_attempts a
         JOIN exam_papers p ON p.id = a.exam_id
        WHERE a.id = ?`,
      [attemptId]
    );
    if (!attempt) return res.status(404).json({ message: "Attempt not found." });
    if (attempt.status !== "in_progress") {
      return res.status(400).json({ message: "Attempt is already submitted." });
    }
    const startedAt = attempt.started_at ? new Date(attempt.started_at).getTime() : Date.now();

    const ansArr = Array.isArray(answers) ? answers : [];

    // Load correct option IDs per question
    const correctRows = await query(
      `SELECT o.question_id, o.id AS option_id
         FROM exam_options o
         JOIN exam_questions q ON q.id = o.question_id
        WHERE q.exam_id = ? AND o.is_correct = 1`,
      [attempt.exam_id]
    );
    const correctMap = new Map();
    (correctRows || []).forEach((r) => {
      if (!correctMap.has(r.question_id)) correctMap.set(r.question_id, []);
      correctMap.get(r.question_id).push(r.option_id);
    });

    const qMetaRows = await query(
      `SELECT id, question_type, marks, question_text
         FROM exam_questions
        WHERE exam_id = ?`,
      [attempt.exam_id]
    );
    const meta = new Map();
    (qMetaRows || []).forEach((q) => meta.set(q.id, q));

    let score = 0;
    const breakdown = [];

    // Save answers (delete existing first, just in case).
    // Important: for forced termination (camera/proctoring), answers can be empty.
    await query("DELETE FROM exam_attempt_answers WHERE attempt_id = ?", [attemptId]);

    for (const a of ansArr) {
      const qid = parseInt(a.question_id, 10);
      if (!Number.isFinite(qid)) continue;
      const selectedIds = normalizeSelectedIds(a.selected_option_ids);
      await query(
        `INSERT INTO exam_attempt_answers (attempt_id, question_id, selected_option_ids)
         VALUES (?, ?, ?)`,
        [attemptId, qid, JSON.stringify(selectedIds)]
      );

      const m = meta.get(qid);
      const correctIds = (correctMap.get(qid) || []).slice().sort((x, y) => x - y);
      const selSorted = selectedIds.slice().sort((x, y) => x - y);
      const isCorrect =
        correctIds.length === selSorted.length && correctIds.every((v, idx) => v === selSorted[idx]);
      const earned = isCorrect ? (m ? m.marks : 0) : 0;
      score += earned;
      breakdown.push({
        question_id: qid,
        question_text: m ? m.question_text : "",
        question_type: m ? m.question_type : "MCQ",
        marks: m ? m.marks : 0,
        earned,
        selected_option_ids: selectedIds,
        correct_option_ids: correctIds,
        is_correct: isCorrect,
      });
    }

    const totalMarks = attempt.total_marks || 0;
    const percent = totalMarks ? Math.round((score / totalMarks) * 100) : 0;
    const correctCount = breakdown.filter((b) => b.is_correct).length;
    const incorrectCount = breakdown.length - correctCount;

    await query(
      `UPDATE exam_attempts
          SET status = ?, submitted_at = NOW(), score = ?, total_marks = ?, terminated_reason = ?
        WHERE id = ?`,
      [terminated_reason ? "terminated" : "submitted", score, totalMarks, terminated_reason || null, attemptId]
    );

    const submittedAt = Date.now();
    const timeTakenSeconds = Math.max(0, Math.floor((submittedAt - startedAt) / 1000));

    res.json({
      message: "Submitted.",
      attemptId,
      score,
      totalMarks,
      percent,
      breakdown,
      timeTakenSeconds,
      correctCount,
      incorrectCount,
      negativeMarksApplied: 0,
    });
  } catch (err) {
    console.error("Submit attempt error:", err);
    res.status(500).json({ message: "Failed to submit attempt.", error: err.message });
  }
});

// GET /api/attempts/student/summary?email= – per-exam stats: attemptCount, latestScore, averageScore, rank, locked
router.get("/student/summary", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ message: "email is required." });

    const myAttempts = await query(
      `SELECT a.id, a.exam_id, a.score, a.total_marks, a.submitted_at, p.title AS exam_title, p.exam_type
         FROM exam_attempts a
         JOIN exam_papers p ON p.id = a.exam_id
        WHERE a.student_email = ? AND a.status IN ('submitted', 'terminated')
        ORDER BY a.exam_id, a.submitted_at DESC`,
      [email]
    );

    const byExam = new Map();
    for (const row of myAttempts || []) {
      const eid = row.exam_id;
      if (!byExam.has(eid)) {
        byExam.set(eid, {
          examId: eid,
          examTitle: row.exam_title,
          examType: row.exam_type,
          attemptCount: 0,
          scores: [],
          latestScore: null,
          latestPercent: null,
          latestSubmittedAt: null,
        });
      }
      const rec = byExam.get(eid);
      rec.attemptCount += 1;
      const total = row.total_marks || 1;
      const pct = total ? Math.round((row.score / total) * 100) : 0;
      rec.scores.push({ score: row.score, totalMarks: total, percent: pct });
      if (rec.latestScore === null) {
        rec.latestScore = row.score;
        rec.latestPercent = pct;
        rec.latestSubmittedAt = row.submitted_at || null;
      }
    }

    for (const [eid, rec] of byExam) {
      const sum = rec.scores.reduce((a, s) => a + s.percent, 0);
      rec.averageScore = rec.scores.length ? Math.round(sum / rec.scores.length) : 0;
      const maxAttempts = rec.examType === "mock" ? 1 : 2;
      rec.locked = rec.attemptCount >= maxAttempts;

      const rankRows = await query(
        `SELECT a.student_email, MAX(a.score) AS best_score
           FROM exam_attempts a
          WHERE a.exam_id = ? AND a.status IN ('submitted', 'terminated')
          GROUP BY a.student_email
          ORDER BY best_score DESC`,
        [eid]
      );
      const rankList = (rankRows || []).map((r) => r.student_email);
      const myRank = rankList.indexOf(email) + 1;
      rec.rank = myRank || null;
      rec.totalParticipants = rankList.length;
    }

    const arr = Array.from(byExam.values());
    const overall =
      arr.length > 0
        ? {
            totalExamsAttempted: arr.length,
            averagePercentAcrossExams: Math.round(arr.reduce((a, e) => a + (e.averageScore || 0), 0) / arr.length),
          }
        : null;

    res.json({ byExam: arr, overall });
  } catch (err) {
    console.error("Student summary error:", err);
    res.status(500).json({ message: "Failed to load summary.", error: err.message });
  }
});

// GET /api/attempts/admin/analytics?examId= – totalParticipants, averageMarks, highestScore, lowestScore, rankingList
router.get("/admin/analytics", async (req, res) => {
  try {
    const examId = req.query.examId ? parseInt(req.query.examId, 10) : null;
    const params = examId != null && Number.isFinite(examId) ? [examId] : [];

    const whereClause =
      examId != null && Number.isFinite(examId)
        ? "WHERE a.exam_id = ? AND a.status IN ('submitted', 'terminated')"
        : "WHERE a.status IN ('submitted', 'terminated')";
    const bestPerStudent = await query(
      `SELECT a.exam_id, a.student_email, a.student_name, MAX(a.score) AS best_score
         FROM exam_attempts a
         JOIN exam_papers p ON p.id = a.exam_id
        ${whereClause}
        GROUP BY a.exam_id, a.student_email, a.student_name`,
      params
    );

    const byExam = new Map();
    for (const row of bestPerStudent || []) {
      const eid = row.exam_id;
      if (!byExam.has(eid)) byExam.set(eid, []);
      byExam.get(eid).push({ student_email: row.student_email, student_name: row.student_name, best_score: row.best_score });
    }

    const result = [];
    for (const [eid, students] of byExam) {
      const scores = students.map((s) => Number(s.best_score) || 0).filter((n) => Number.isFinite(n));
      const totalParticipants = scores.length;
      const sum = scores.reduce((a, b) => a + b, 0);
      const averageMarks = totalParticipants ? Math.round((sum / totalParticipants) * 100) / 100 : 0;
      const highestScore = scores.length ? Math.max(...scores) : 0;
      const lowestScore = scores.length ? Math.min(...scores) : 0;
      const sorted = students.slice().sort((a, b) => (Number(b.best_score) || 0) - (Number(a.best_score) || 0));
      const rankingList = sorted.map((s, i) => ({
        rank: i + 1,
        student_email: s.student_email,
        student_name: s.student_name || s.student_email,
        score: Number(s.best_score) || 0,
      }));

      result.push({
        examId: eid,
        totalParticipants,
        averageMarks,
        highestScore,
        lowestScore,
        rankingList,
      });
    }

    if (examId != null && Number.isFinite(examId)) {
      const single = result.find((r) => r.examId === examId);
      return res.json(single || { examId, totalParticipants: 0, averageMarks: 0, highestScore: 0, lowestScore: 0, rankingList: [] });
    }
    res.json({ byExam: result });
  } catch (err) {
    console.error("Admin analytics error:", err);
    res.status(500).json({ message: "Failed to load analytics.", error: err.message });
  }
});

// GET /api/attempts/admin/list – admin view of attempts (flaggedOnly optional)
router.get("/admin/list", async (req, res) => {
  try {
    const { examId, flaggedOnly } = req.query;
    const params = [];
    let sql = `SELECT a.id, a.exam_id, p.title AS exam_title, p.exam_type, a.student_email, a.student_name,
                      a.status, a.started_at, a.submitted_at, a.score, a.total_marks, a.violations_count, a.terminated_reason
                 FROM exam_attempts a
                 JOIN exam_papers p ON p.id = a.exam_id`;
    const where = [];
    if (examId) {
      where.push("a.exam_id = ?");
      params.push(examId);
    }
    if (flaggedOnly === "1") {
      where.push("a.violations_count > 0");
    }
    if (where.length) sql += " WHERE " + where.join(" AND ");
    sql += " ORDER BY a.started_at DESC LIMIT 500";
    const rows = await query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("Admin list attempts error:", err);
    res.status(500).json({ message: "Failed to load attempts.", error: err.message });
  }
});

// GET /api/attempts/admin/:id/violations – list violations for an attempt
router.get("/admin/:id/violations", async (req, res) => {
  try {
    const attemptId = req.params.id;
    const rows = await query(
      `SELECT id, v_type, detail, created_at
         FROM exam_violations
        WHERE attempt_id = ?
        ORDER BY created_at ASC`,
      [attemptId]
    );
    res.json(rows || []);
  } catch (err) {
    console.error("List violations error:", err);
    res.status(500).json({ message: "Failed to load violations.", error: err.message });
  }
});

export default router;

