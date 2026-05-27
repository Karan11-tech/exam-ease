What it does
ExamEase is a web-based platform for online exams, learning, and assessment in one place.

For students

Sign up / login with OTP email verification and role-based access (Student / Admin)
Take online exams with practice mode and results tracking
Gamified learning, personal notes, and downloadable study materials
Doubts & discussion forum
Career & internships section
Feedback & assessment
Exam integrity monitoring (integrity score based on violations)
AI Study Assistant (powered by Google Gemini)
Certificates (PDF generation)
Profile photos, notifications, dark/light theme, and language toggle

For admins

Manage exams, students, and study materials
Upload PDFs or structured content for study resources
Handle doubts, feedback, announcements, and notifications
View reports, security/audit logs, and platform overview
Tech stack
Layer	Technologies
Frontend
HTML5, CSS3, JavaScript, Boxicons
Backend (main app)
Node.js, Express.js
Database
MySQL (mysql2)
Auth & security
bcrypt, OTP via Nodemailer, session-based login
File handling
Multer (uploads), PDFKit (PDF generation)
AI
Google Gemini API
Optional / secondary
Java 17, Spring Boot 3, MongoDB (separate module in src/ and demo/)
How to run locally
Prerequisites
Node.js (v18+ recommended)
MySQL
Gmail account with App Password (for OTP emails)
Google Gemini API key (optional, for AI Study Assistant)
