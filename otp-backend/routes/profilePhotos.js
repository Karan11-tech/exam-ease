import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { query, queryOne } from "../db/connection.js";
import { fileURLToPath } from "url";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const __uploadDir = path.join(__dirname, "..", "uploads", "profile-photos");
if (!fs.existsSync(__uploadDir)) {
  fs.mkdirSync(__uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, __uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = ext && ext.length <= 8 ? ext.replace(/[^a-z0-9.]/g, "") : ".jpg";
    const safeBase = path.basename(file.originalname || "photo").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeBase}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ok =
      !file.mimetype ||
      ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype) ||
      /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i.test(file.originalname || "");
    cb(null, !!ok);
  },
});

function getRelativeUploadPath(absPath) {
  // Store relative to otp-backend root so we can reconstruct the full path later.
  // Example: uploads/profile-photos/169...-name.jpg
  const backendRoot = path.join(__dirname, "..");
  return path.relative(backendRoot, absPath).replace(/\\/g, "/");
}

async function resolvePhotoPathByEmail(email) {
  const row = await queryOne("SELECT profile_photo_path FROM users WHERE email = ?", [String(email).trim()]);
  const rel = row && row.profile_photo_path ? String(row.profile_photo_path) : null;
  if (!rel) return null;
  const backendRoot = path.join(__dirname, "..");
  const full = path.join(backendRoot, rel);
  if (!fs.existsSync(full)) return null;
  return { rel, full };
}

// GET /api/profile/photo?email=...
// Returns the image file (or 404 if not uploaded).
router.get("/photo", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) return res.status(400).json({ message: "email is required." });

    const photo = await resolvePhotoPathByEmail(email);
    if (!photo) return res.status(404).json({ message: "Profile photo not found." });

    return res.sendFile(photo.full);
  } catch (err) {
    console.error("Get profile photo error:", err);
    res.status(500).json({ message: "Failed to load profile photo.", error: err.message });
  }
});

// POST /api/profile/photo
// Form-data fields: email (string), photo (file)
router.post("/photo", upload.single("photo"), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    if (!email) return res.status(400).json({ message: "email is required." });
    if (!req.file || !req.file.path) return res.status(400).json({ message: "photo file is required." });

    // Make sure the user exists (avoid creating phantom records).
    const user = await queryOne("SELECT id, profile_photo_path FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Delete previous photo file if stored.
    if (user.profile_photo_path) {
      const backendRoot = path.join(__dirname, "..");
      const oldFull = path.join(backendRoot, String(user.profile_photo_path));
      if (fs.existsSync(oldFull)) {
        try {
          fs.unlinkSync(oldFull);
        } catch (_) {
          // ignore deletion errors; new photo upload should still succeed
        }
      }
    }

    const relPath = getRelativeUploadPath(req.file.path);
    await query("UPDATE users SET profile_photo_path = ? WHERE email = ?", [relPath, email]);

    res.json({ message: "Profile photo updated.", profile_photo_path: relPath });
  } catch (err) {
    console.error("Update profile photo error:", err);
    res.status(500).json({ message: "Failed to upload profile photo.", error: err.message });
  }
});

export default router;

