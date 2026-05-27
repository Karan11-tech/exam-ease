-- ExamEase MySQL Schema
-- Run this script to create the database and tables.

CREATE DATABASE IF NOT EXISTS examease_db;
USE examease_db;

-- Users: students and admins (single table with role)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL DEFAULT 'student',
    account_status ENUM('active', 'blocked', 'pending') NOT NULL DEFAULT 'active',
    profile_photo_path VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (account_status)
);

-- Sessions: for "Remember Me" tokens (secure token, no password stored)
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    role ENUM('student', 'admin') NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_role (user_id, role)
);

-- Login history
CREATE TABLE IF NOT EXISTS login_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    email VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL,
    login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_login_at (login_at)
);

-- OTP logs (verification status and audit)
CREATE TABLE IF NOT EXISTS otp_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    purpose ENUM('signup', 'password_reset') NOT NULL DEFAULT 'signup',
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);

-- Doubts: student questions and admin answers
CREATE TABLE IF NOT EXISTS doubts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    student_email VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NULL,
    subject VARCHAR(255) NULL,
    question TEXT NOT NULL,
    answer TEXT NULL,
    status ENUM('pending', 'answered', 'closed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    answered_at TIMESTAMP NULL,
    answered_by_id INT NULL,
    answered_by_name VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (answered_by_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_student_email (student_email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Notifications: per-user (student/admin) messages (doubts, materials, etc.)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_email_role (email, role),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at_notif (created_at)
);

-- Announcements: system-wide updates (exam schedules, materials, career, general)
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('exam', 'study', 'career', 'general') NOT NULL DEFAULT 'general',
    link_url VARCHAR(512) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category_announce (category),
    INDEX idx_created_announce (created_at)
);

-- Career resources: tips, strategies, resume & interview guidance
CREATE TABLE IF NOT EXISTS career_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category ENUM('tips', 'exam_strategy', 'resume', 'interview') NOT NULL DEFAULT 'tips',
    content TEXT NOT NULL,
    admin_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_category_career (category),
    INDEX idx_created_career (created_at)
);

-- Career opportunities (internships / jobs) – can be filled manually or by background scripts
CREATE TABLE IF NOT EXISTS career_opportunities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source ENUM('linkedin', 'internshala', 'indeed', 'naukri', 'other') NOT NULL DEFAULT 'other',
    company VARCHAR(255) NOT NULL,
    role_title VARCHAR(255) NOT NULL,
    location VARCHAR(255) NULL,
    apply_url VARCHAR(512) NOT NULL,
    deadline DATE NULL,
    tags VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_source (source),
    INDEX idx_deadline (deadline),
    INDEX idx_created_opps (created_at)
);

-- Exams
CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    exam_date DATE,
    exam_time TIME,
    duration_minutes INT,
    status ENUM('upcoming', 'ongoing', 'completed') DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- Exam Management System (DB-backed)
-- ============================================

-- Subjects (OS, DBMS, CN, etc.)
CREATE TABLE IF NOT EXISTS exam_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exam paper/definition created by admin
CREATE TABLE IF NOT EXISTS exam_papers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    exam_type ENUM('practice', 'mock') NOT NULL DEFAULT 'practice',
    question_count INT NOT NULL DEFAULT 0,
    total_marks INT NOT NULL DEFAULT 0,
    duration_minutes INT NOT NULL DEFAULT 30,
    difficulty ENUM('easy', 'medium', 'hard', 'mixed') NOT NULL DEFAULT 'mixed',
    allowed_question_types VARCHAR(16) NOT NULL DEFAULT 'MCQ,MSQ',
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    admin_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_exam_type (exam_type),
    INDEX idx_is_active (is_active),
    INDEX idx_created_exam (created_at)
);

-- Link exam papers to one or more subjects
CREATE TABLE IF NOT EXISTS exam_paper_subjects (
    exam_id INT NOT NULL,
    subject_id INT NOT NULL,
    PRIMARY KEY (exam_id, subject_id),
    FOREIGN KEY (exam_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES exam_subjects(id) ON DELETE CASCADE
);

-- Questions (MCQ single correct, MSQ multiple correct)
CREATE TABLE IF NOT EXISTS exam_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('MCQ', 'MSQ') NOT NULL DEFAULT 'MCQ',
    marks INT NOT NULL DEFAULT 1,
    negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    difficulty ENUM('easy', 'medium', 'hard') NOT NULL DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
    INDEX idx_exam_id_q (exam_id)
);

-- Migration: If negative_marks column doesn't exist, add it:
-- ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER marks;

-- Options; mark correct options with is_correct=1 (for MSQ multiple rows)
CREATE TABLE IF NOT EXISTS exam_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    option_key CHAR(1) NULL,
    option_text TEXT NOT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE,
    INDEX idx_question_id_opt (question_id)
);

-- Attempts (student executions)
CREATE TABLE IF NOT EXISTS exam_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    user_id INT NULL,
    student_email VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NULL,
    status ENUM('in_progress', 'submitted', 'terminated') NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    score INT NOT NULL DEFAULT 0,
    total_marks INT NOT NULL DEFAULT 0,
    violations_count INT NOT NULL DEFAULT 0,
    terminated_reason VARCHAR(255) NULL,
    FOREIGN KEY (exam_id) REFERENCES exam_papers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_exam_attempt (exam_id),
    INDEX idx_student_email_attempt (student_email),
    INDEX idx_status_attempt (status)
);

-- Saved answers (selected option IDs stored as JSON array)
CREATE TABLE IF NOT EXISTS exam_attempt_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option_ids JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE,
    INDEX idx_attempt_id_ans (attempt_id)
);

-- Student personal notes (per subject/topic, with context)
CREATE TABLE IF NOT EXISTS notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_email VARCHAR(255) NOT NULL,
    subject_name VARCHAR(255) NULL,
    topic_name VARCHAR(255) NULL,
    context_type ENUM('material','exam_question','quiz','general') NOT NULL DEFAULT 'general',
    context_ref VARCHAR(255) NULL,
    title VARCHAR(255) NULL,
    content TEXT NOT NULL,
    is_bookmarked TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_notes_email (student_email),
    INDEX idx_notes_subject_topic (subject_name, topic_name)
);

-- Violations during mock tests (tab switch, copy attempt, camera off, etc.)
CREATE TABLE IF NOT EXISTS exam_violations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    v_type VARCHAR(64) NOT NULL,
    detail VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
    INDEX idx_attempt_id_v (attempt_id),
    INDEX idx_type_v (v_type)
);

-- Exam results
CREATE TABLE IF NOT EXISTS results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    exam_id INT,
    exam_name VARCHAR(255),
    score DECIMAL(5,2),
    rank INT,
    status VARCHAR(50),
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id)
);

-- Practice progress
CREATE TABLE IF NOT EXISTS practice_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    topic_name VARCHAR(255),
    progress_percent INT DEFAULT 0,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
);

-- Study materials: subject-wise resources (PDFs, notes) – admin upload/create, students view/download
CREATE TABLE IF NOT EXISTS study_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('notes', 'lectures', 'resources') NOT NULL DEFAULT 'notes',
    file_path VARCHAR(512) NULL,
    admin_id INT NULL,
    content_json JSON NULL COMMENT 'Structured: notes, important_topics, examples, reference_links for generated PDF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_subject (subject_name),
    INDEX idx_category (category),
    INDEX idx_created (created_at)
);

-- Student feedback: platform improvement (category, rating, comment, status, admin reply)
CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_email VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NULL,
    category VARCHAR(64) NOT NULL COMMENT 'Study Materials, Doubt Support, Exams, Career Section, Technical Issues',
    rating TINYINT NOT NULL DEFAULT 0 COMMENT '1-5 stars',
    message TEXT NOT NULL,
    admin_reply TEXT NULL COMMENT 'Admin acknowledgment, clarification, or resolution',
    status ENUM('pending', 'reviewed', 'resolved') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student_email_fb (student_email),
    INDEX idx_status_fb (status),
    INDEX idx_created_fb (created_at)
);
-- If table already exists without admin_reply: ALTER TABLE feedback ADD COLUMN admin_reply TEXT NULL AFTER message;

-- Optional: default super admin (password: Admin@123) - run after first deploy and change password
-- INSERT INTO users (email, password_hash, full_name, role, account_status)
-- VALUES ('admin@examease.com', '$2b$10$...', 'ExamEase Admin', 'admin', 'active')
-- Use your app to register admin or hash 'Admin@123' with bcrypt and insert.
