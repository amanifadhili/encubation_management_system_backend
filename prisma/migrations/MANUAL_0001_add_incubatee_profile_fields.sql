-- Migration: Add Incubatee Profile Fields
-- Description: Adds all new fields for phased profile structure
-- Created: Phase 1 Implementation
-- WARNING: Review and test on development database first!

-- Step 1: Add new enum types (MySQL doesn't support CREATE TYPE, so we'll use VARCHAR)
-- Note: Prisma handles enums as VARCHAR in MySQL, so we'll just add columns

-- Step 2: Add new columns to users table
ALTER TABLE `users` 
  ADD COLUMN `first_name` VARCHAR(50) NULL AFTER `name`,
  ADD COLUMN `middle_name` VARCHAR(50) NULL AFTER `first_name`,
  ADD COLUMN `last_name` VARCHAR(50) NULL AFTER `middle_name`,
  ADD COLUMN `phone` VARCHAR(20) NULL AFTER `last_name`,
  ADD COLUMN `profile_photo_url` VARCHAR(500) NULL AFTER `phone`,
  ADD COLUMN `enrollment_status` ENUM('CurrentlyEnrolled', 'Graduated', 'OnLeave', 'Other') NULL AFTER `profile_photo_url`,
  ADD COLUMN `major_program` VARCHAR(100) NULL AFTER `enrollment_status`,
  ADD COLUMN `program_of_study` VARCHAR(100) NULL AFTER `major_program`,
  ADD COLUMN `graduation_year` INT NULL AFTER `program_of_study`,
  ADD COLUMN `current_role` ENUM('ProjectLead', 'Employee', 'FounderCoFounder', 'AttendsWorkshopsOnly', 'Other') NULL AFTER `graduation_year`,
  ADD COLUMN `skills` JSON NULL AFTER `current_role`,
  ADD COLUMN `support_interests` JSON NULL AFTER `skills`,
  ADD COLUMN `additional_notes` TEXT NULL AFTER `support_interests`,
  ADD COLUMN `profile_completion_percentage` INT NOT NULL DEFAULT 0 AFTER `additional_notes`,
  ADD COLUMN `profile_phase_completion` JSON NULL AFTER `profile_completion_percentage`;

-- Step 3: Update projects table to add new category options
-- First, we need to modify the category column to accept new values
-- Note: MySQL ENUM modification can be tricky. We'll use ALTER to modify enum
-- If this fails, you may need to recreate the column

-- Add new columns to projects table
ALTER TABLE `projects`
  ADD COLUMN `startup_company_name` VARCHAR(200) NULL AFTER `description`,
  ADD COLUMN `status_at_enrollment` ENUM('Idea', 'Prototype', 'MVP', 'Beta', 'Launched') NULL AFTER `startup_company_name`,
  ADD COLUMN `challenge_description` TEXT NULL AFTER `status_at_enrollment`;

-- Step 4: Update project category enum
-- WARNING: This operation can be destructive. Backup your database first!
-- We need to modify the category column to include new enum values
-- For MySQL, we need to recreate the enum with all values

-- First, check current enum values:
-- SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'your_database_name' AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'category';

-- Then modify the enum (this example shows how - adjust based on your actual enum definition):
-- ALTER TABLE `projects` MODIFY COLUMN `category` ENUM(
--   'Technology', 'Agriculture', 'Health', 'Education', 'Design',
--   'SocialImpact', 'Sustainability', 'AgriTech', 'HealthTech', 'EdTech',
--   'RoboticsAI', 'FinTech', 'OpenToAny', 'Other'
-- ) NOT NULL;

-- Step 5: Verify migration
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'your_database_name' AND TABLE_NAME = 'users' 
-- ORDER BY ORDINAL_POSITION;

-- Rollback script (if needed):
-- ALTER TABLE `users` 
--   DROP COLUMN `first_name`,
--   DROP COLUMN `middle_name`,
--   DROP COLUMN `last_name`,
--   DROP COLUMN `phone`,
--   DROP COLUMN `profile_photo_url`,
--   DROP COLUMN `enrollment_status`,
--   DROP COLUMN `major_program`,
--   DROP COLUMN `program_of_study`,
--   DROP COLUMN `graduation_year`,
--   DROP COLUMN `current_role`,
--   DROP COLUMN `skills`,
--   DROP COLUMN `support_interests`,
--   DROP COLUMN `additional_notes`,
--   DROP COLUMN `profile_completion_percentage`,
--   DROP COLUMN `profile_phase_completion`;
--
-- ALTER TABLE `projects`
--   DROP COLUMN `startup_company_name`,
--   DROP COLUMN `status_at_enrollment`,
--   DROP COLUMN `challenge_description`;

