import { Router } from "express";
import PDFDocument from "pdfkit";
import { queryOne } from "../db/connection.js";

const router = Router();

// GET /api/certificates?email=&achievement=
router.get("/", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    const achievement = String(req.query.achievement || "").trim();
    if (!email || !achievement) {
      return res.status(400).json({ message: "email and achievement are required." });
    }

    const user = await queryOne("SELECT full_name FROM users WHERE email = ?", [email]);
    const name = (user && user.full_name) ? String(user.full_name) : email;

    const disposition = req.query.preview ? "inline" : "attachment";
    const safe = achievement.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const filename = `certificate-${safe}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 60 });
    doc.pipe(res);

    // Background accents
    doc.rect(0, 0, doc.page.width, 90).fill("#0f1735");
    doc.fillColor("#ffffff").fontSize(18).text("ExamEase", 60, 32);
    doc.fillColor("#ffffff").fontSize(12).text("Certificate of Achievement", 60, 56);

    doc.fillColor("#111827");
    doc.moveDown(6);
    doc.fontSize(24).text("Certificate", { align: "center" });
    doc.moveDown(0.8);
    doc.fontSize(12).fillColor("#374151").text("This is to certify that", { align: "center" });
    doc.moveDown(0.6);
    doc.fontSize(20).fillColor("#111827").text(name, { align: "center" });
    doc.moveDown(0.8);
    doc.fontSize(12).fillColor("#374151").text("has successfully unlocked the achievement", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor("#174bbd").text(`“${achievement}”`, { align: "center" });

    const dateStr = new Date().toLocaleDateString();
    doc.moveDown(2.0);
    doc.fillColor("#111827").fontSize(11).text("Issued on: " + dateStr, 60, doc.y, { align: "left" });
    doc.fontSize(11).text("Platform: ExamEase", { align: "right" });

    // Signature line
    doc.moveDown(2.5);
    doc.strokeColor("#9ca3af").moveTo(380, doc.y).lineTo(540, doc.y).stroke();
    doc.fillColor("#374151").fontSize(10).text("Authorized", 380, doc.y + 6, { width: 160, align: "center" });

    doc.end();
  } catch (err) {
    console.error("Generate certificate error:", err);
    res.status(500).json({ message: "Failed to generate certificate.", error: err.message });
  }
});

export default router;

