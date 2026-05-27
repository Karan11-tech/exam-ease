import { Router } from "express";
import { query } from "../db/connection.js";

const router = Router();

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// GET /api/integrity/student?email=...
// Computes an "integrity score" based on past attempts and violations_count.
router.get("/student", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ message: "email is required." });

    const rows = await query(
      `SELECT a.id, a.exam_id, p.exam_type, a.status, a.violations_count, a.terminated_reason, a.submitted_at
         FROM exam_attempts a
         JOIN exam_papers p ON p.id = a.exam_id
        WHERE a.student_email = ?
          AND a.status IN ('submitted', 'terminated')
        ORDER BY a.submitted_at DESC
        LIMIT 50`,
      [email]
    );

    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      return res.json({
        hasActivity: false,
        totalAttempts: 0,
        totalViolations: 0,
        integrityScore: 100,
        latest: null,
      });
    }

    const totalViolations = list.reduce((sum, r) => sum + (Number(r.violations_count) || 0), 0);
    const latest = list[0] || null;
    const latestViolations = latest ? Number(latest.violations_count) || 0 : 0;
    const latestTerminated = latest && latest.status === "terminated";

    // Latest-attempt-first model:
    // Integrity card should reflect most recent proctoring behavior, not stale history.
    // - Start from 100
    // - Latest attempt violations reduce score significantly
    // - Latest termination reduces score further
    const latestPenaltyViolations = clamp(latestViolations * 25, 0, 100);
    const latestPenaltyTermination = latestTerminated ? 20 : 0;
    const integrityScore = clamp(100 - latestPenaltyViolations - latestPenaltyTermination, 0, 100);

    let status = "good";
    if (integrityScore < 40) status = "bad";
    else if (integrityScore < 70) status = "warn";

    let message;
    if (status === "good") {
      message = "Good integrity — your latest attempt shows no violations.";
    } else if (status === "warn") {
      message = latestTerminated
        ? "Latest attempt ended with integrity concerns. Follow proctoring rules carefully."
        : "Latest attempt had violations. Please avoid suspicious activity in upcoming mock tests.";
    } else {
      message = latestTerminated
        ? "Your latest attempt was terminated due to proctoring violations."
        : "Latest attempt shows serious integrity concerns. Follow proctoring rules strictly.";
    }

    res.json({
      hasActivity: true,
      status, // good | warn | bad
      totalAttempts: list.length,
      totalViolations,
      integrityScore,
      latest: latest
        ? {
            attemptId: latest.id,
            violations_count: latestViolations,
            terminated_reason: latest.terminated_reason || null,
            submitted_at: latest.submitted_at,
          }
        : null,
      message,
    });
  } catch (err) {
    console.error("Integrity status error:", err);
    res.status(500).json({ message: "Failed to load integrity status.", error: err.message });
  }
});

export default router;

