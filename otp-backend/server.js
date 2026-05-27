import dotenv from "dotenv";
import path from "path";
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import studyMaterialsRoutes from "./routes/studyMaterials.js";
import doubtsRoutes from "./routes/doubts.js";
import notificationsRoutes from "./routes/notifications.js";
import careerRoutes from "./routes/career.js";
import feedbackRoutes from "./routes/feedback.js";
import examsRoutes from "./routes/exams.js";
import attemptsRoutes from "./routes/attempts.js";
import announcementsRoutes, { deleteAnnouncementById } from "./routes/announcements.js";
import notesRoutes, { handleNotePdfDownload } from "./routes/notes.js";
import certificatesRoutes from "./routes/certificates.js";
import integrityRoutes from "./routes/integrity.js";
import profilePhotosRoutes from "./routes/profilePhotos.js";
import aiStudyRoutes from "./routes/aiStudy.js";

// Fix __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env properly
dotenv.config({
  path: path.join(__dirname, ".env")
});

// Test
console.log("Email:", process.env.EMAIL_USER);
console.log("Pass:", process.env.EMAIL_PASS ? "Loaded" : "Not Loaded");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(
  cors({
    exposedHeaders: ["Content-Disposition"],
  })
);

// API: auth (register, login, remember-me) – uses MySQL
app.use("/api/auth", authRoutes);
// API: study materials (CRUD + upload, download/generate PDF)
app.use("/api/study-materials", studyMaterialsRoutes);
// API: doubts (student questions, admin replies)
app.use("/api/doubts", doubtsRoutes);
// API: notifications (for toasts and notification panel)
app.use("/api/notifications", notificationsRoutes);
app.use("/api/career", careerRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/exams", examsRoutes);
app.use("/api/attempts", attemptsRoutes);
// DELETE must be registered on the app (full path) so it is not lost behind the mounted router + /api 404 handler.
app.delete("/api/announcements/:id", deleteAnnouncementById);
app.use("/api/announcements", announcementsRoutes);
app.get("/api/notes/download", handleNotePdfDownload);
app.use("/api/notes", notesRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/integrity", integrityRoutes);
app.use("/api/profile", profilePhotosRoutes);
app.use("/api/ai", aiStudyRoutes);

// 404 for API routes so we never serve HTML for /api/*
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found.", path: req.path });
});

// Serve frontend files from parent folder (Exam Ease root)
const FRONTEND_DIR = path.join(__dirname, "..");
app.use(express.static(FRONTEND_DIR));

const otpStorage = {}; // Store OTPs temporarily

// Generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  
  
  // Test login
  transporter.verify((err, success) => {
    if (err) {
      console.log("❌ Gmail Login Failed:", err);
    } else {
      console.log("✅ Gmail Login Success");
    }
  });
  

// Endpoint to send OTP
app.post("/send-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required!" });

        const otp = generateOTP();
        otpStorage[email] = { otp, expiresAt: Date.now() + 300000 }; // OTP valid for 5 minutes

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "OTP sent successfully!" });

    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).json({ message: "Failed to send OTP!", error: error.message });
    }
});

// Endpoint to verify OTP
app.post("/verify-otp", (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
    }

    const stored = otpStorage[email];
    if (stored && String(stored.otp) === String(otp).trim()) {
        if (Date.now() > stored.expiresAt) {
            delete otpStorage[email];
            return res.status(400).json({ message: "OTP expired! Request a new one." });
        }
        delete otpStorage[email]; // Remove OTP after successful verification
        res.json({ message: "OTP verified successfully!" });
    } else {
        res.status(400).json({ message: "Invalid OTP" });
    }
});

// ✅ Contact Form Submission Endpoint
app.post("/send-email", async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const mailOptions = {
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: process.env.EMAIL_USER,
            subject: "New Contact Form Submission",
            text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`
          };
          

        await transporter.sendMail(mailOptions);
        res.json({ message: "Message sent successfully!" });

    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Failed to send message!", error: error.message });
    }
});

// Serve main index.html for root path
app.get("/", (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  if (process.env.DB_HOST || process.env.DB_NAME) {
    console.log("   Database auth: enabled (MySQL)");
  } else {
    console.log("   Database auth: set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in .env to use MySQL auth");
  }
});
