-- One-time migration: add negative_marks to exam_questions if your table was created without it.
-- Run this with: mysql -u your_user -p examease_db < db/migrate-add-negative-marks.sql
-- Or run the line below in MySQL Workbench / your DB client.

USE examease_db;

ALTER TABLE exam_questions
ADD COLUMN negative_marks DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER marks;
