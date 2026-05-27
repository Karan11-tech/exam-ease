What it does
-ExamEase is a web-based platform for online exams, learning, and assessment in one place.

For students

-Sign up / login with OTP email verification and role-based access (Student / Admin)
-Take online exams with practice mode and results tracking
-Gamified learning, personal notes, and downloadable study materials
-Doubts & discussion forum
-Career & internships section
-Feedback & assessment
-Exam integrity monitoring (integrity score based on violations)
-AI Study Assistant (powered by Google Gemini)
-Certificates (PDF generation)
-Profile photos, notifications, dark/light theme, and language toggle

For admins

-Manage exams, students, and study materials
-Upload PDFs or structured content for study resources
-Handle doubts, feedback, announcements, and notifications
-View reports, security/audit logs, and platform overview
-Tech stack
-Layer	Technologies
-Frontend
-HTML5, CSS3, JavaScript, Boxicons
-Backend (main app)
-Node.js, Express.js
-Database
-MySQL (mysql2)
-Auth & security
-bcrypt, OTP via Nodemailer, session-based login
-File handling
-Multer (uploads), PDFKit (PDF generation)
-AI
-Google Gemini API
-Optional / secondary
-Java 17, Spring Boot 3, MongoDB (separate module in src/ and demo/)

How to run locally

Prerequisites
-Node.js (v18+ recommended)
-MySQL
-Gmail account with App Password (for OTP emails)
-Google Gemini API key (optional, for AI Study Assistant)

1. Clone the repository
git clone https://github.com/Karan11-tech/exam-ease.git
cd exam-ease

2. Set up MySQL database
cd otp-backend
mysql -u root -p < db/schema.sql
Or open otp-backend/db/schema.sql in MySQL Workbench and run it.

3. Configure environment variables
cd otp-backend
copy .env.example .env
Edit .env:  EMAIL_USER=your-email@gmail.com
            EMAIL_PASS=your-gmail-app-password
            DB_HOST=localhost
            DB_USER=root
            DB_PASSWORD=your-mysql-password
            DB_NAME=examease_db
            GEMINI_API_KEY=your-gemini-api-key

4. Install dependencies & seed admin user
-npm install
-node scripts/seed-admin.js
-Default admin (after seeding):
-Email: admin@examease.com
-Password: Admin@123

5. Start the server
-npm start
-Server runs at: http://localhost:5000

Open in browser:

Home / Login: http://localhost:5000/index.html
Student dashboard: after student login
Admin dashboard: after admin login
