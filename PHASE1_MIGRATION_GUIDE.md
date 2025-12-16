# Phase 1: Database Schema Migration Guide

## Overview
This guide helps you migrate your database to add all the new incubatee profile fields.

## What Was Changed

### User Model - New Fields Added:
1. **Phase 1: Essential Information**
   - `first_name` (VARCHAR 50, nullable)
   - `middle_name` (VARCHAR 50, nullable)
   - `last_name` (VARCHAR 50, nullable)
   - `phone` (VARCHAR 20, nullable)
   - `profile_photo_url` (VARCHAR 500, nullable)

2. **Phase 2: Academic Profile**
   - `enrollment_status` (ENUM: CurrentlyEnrolled, Graduated, OnLeave, Other)
   - `major_program` (VARCHAR 100, nullable)
   - `program_of_study` (VARCHAR 100, nullable)
   - `graduation_year` (INT, nullable)

3. **Phase 3: Professional Profile**
   - `current_role` (ENUM: ProjectLead, Employee, FounderCoFounder, AttendsWorkshopsOnly, Other)
   - `skills` (JSON, nullable) - Array of skill strings
   - `support_interests` (JSON, nullable) - Array of interest strings

4. **Phase 5: Additional Information**
   - `additional_notes` (TEXT, nullable)

5. **Profile Completion Tracking**
   - `profile_completion_percentage` (INT, default 0)
   - `profile_phase_completion` (JSON, nullable)

### Project Model - New Fields Added:
1. `startup_company_name` (VARCHAR 200, nullable)
2. `status_at_enrollment` (ENUM: Idea, Prototype, MVP, Beta, Launched)
3. `challenge_description` (TEXT, nullable)

### ProjectCategory Enum - New Values:
- SocialImpact
- Sustainability
- AgriTech
- HealthTech
- EdTech
- RoboticsAI
- FinTech
- OpenToAny
- Other

### New Enums Created:
- `EnrollmentStatus`
- `ProjectStatusAtEnrollment`
- `CurrentRoleInProject`

---

## Migration Steps

### Option 1: Using Prisma Migrate (Recommended if you have shadow DB access)

```bash
cd encubation_management_system_backend
npx prisma migrate dev --name add_incubatee_profile_fields
```

### Option 2: Manual SQL Migration (If Prisma Migrate fails)

1. **Backup your database first!**

2. **Review the SQL script:**
   - Location: `prisma/migrations/MANUAL_0001_add_incubatee_profile_fields.sql`
   - Review all ALTER TABLE statements
   - Adjust for your specific database setup

3. **Run the SQL script:**
   - Connect to your MySQL database
   - Run the SQL commands one section at a time
   - Verify each step before proceeding

4. **After manual migration, mark it in Prisma:**
   ```bash
   npx prisma migrate resolve --applied add_incubatee_profile_fields
   ```

### Option 3: Using Prisma DB Push (Development only)

```bash
cd encubation_management_system_backend
npx prisma db push
```

**⚠️ WARNING:** `db push` is for development only. Don't use in production!

---

## Step-by-Step Manual Migration

### Step 1: Backup Database
```sql
-- Create backup
mysqldump -u username -p database_name > backup_before_profile_migration.sql
```

### Step 2: Add User Table Columns

Run these one at a time and verify:

```sql
-- Essential Information fields
ALTER TABLE `users` ADD COLUMN `first_name` VARCHAR(50) NULL AFTER `name`;
ALTER TABLE `users` ADD COLUMN `middle_name` VARCHAR(50) NULL AFTER `first_name`;
ALTER TABLE `users` ADD COLUMN `last_name` VARCHAR(50) NULL AFTER `middle_name`;
ALTER TABLE `users` ADD COLUMN `phone` VARCHAR(20) NULL AFTER `last_name`;
ALTER TABLE `users` ADD COLUMN `profile_photo_url` VARCHAR(500) NULL AFTER `phone`;

-- Academic Profile fields
ALTER TABLE `users` ADD COLUMN `enrollment_status` ENUM('CurrentlyEnrolled', 'Graduated', 'OnLeave', 'Other') NULL AFTER `profile_photo_url`;
ALTER TABLE `users` ADD COLUMN `major_program` VARCHAR(100) NULL AFTER `enrollment_status`;
ALTER TABLE `users` ADD COLUMN `program_of_study` VARCHAR(100) NULL AFTER `major_program`;
ALTER TABLE `users` ADD COLUMN `graduation_year` INT NULL AFTER `program_of_study`;

-- Professional Profile fields
ALTER TABLE `users` ADD COLUMN `current_role` ENUM('ProjectLead', 'Employee', 'FounderCoFounder', 'AttendsWorkshopsOnly', 'Other') NULL AFTER `graduation_year`;
ALTER TABLE `users` ADD COLUMN `skills` JSON NULL AFTER `current_role`;
ALTER TABLE `users` ADD COLUMN `support_interests` JSON NULL AFTER `skills`;

-- Additional Information
ALTER TABLE `users` ADD COLUMN `additional_notes` TEXT NULL AFTER `support_interests`;

-- Completion Tracking
ALTER TABLE `users` ADD COLUMN `profile_completion_percentage` INT NOT NULL DEFAULT 0 AFTER `additional_notes`;
ALTER TABLE `users` ADD COLUMN `profile_phase_completion` JSON NULL AFTER `profile_completion_percentage`;
```

### Step 3: Add Project Table Columns

```sql
ALTER TABLE `projects` ADD COLUMN `startup_company_name` VARCHAR(200) NULL AFTER `description`;
ALTER TABLE `projects` ADD COLUMN `status_at_enrollment` ENUM('Idea', 'Prototype', 'MVP', 'Beta', 'Launched') NULL AFTER `startup_company_name`;
ALTER TABLE `projects` ADD COLUMN `challenge_description` TEXT NULL AFTER `status_at_enrollment`;
```

### Step 4: Update Project Category Enum

**⚠️ CAUTION:** This modifies an existing column. Test on development first!

First, check current enum values:
```sql
SELECT COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'your_database_name' 
  AND TABLE_NAME = 'projects' 
  AND COLUMN_NAME = 'category';
```

Then modify (adjust based on your current values):
```sql
ALTER TABLE `projects` 
MODIFY COLUMN `category` ENUM(
  'Technology', 
  'Agriculture', 
  'Health', 
  'Education', 
  'Design',
  'SocialImpact', 
  'Sustainability', 
  'AgriTech', 
  'HealthTech', 
  'EdTech',
  'RoboticsAI', 
  'FinTech', 
  'OpenToAny', 
  'Other'
) NOT NULL;
```

### Step 5: Verify Migration

```sql
-- Check users table columns
DESCRIBE users;

-- Check projects table columns
DESCRIBE projects;

-- Verify enum values
SHOW COLUMNS FROM projects WHERE Field = 'category';
```

### Step 6: Regenerate Prisma Client

After migration is complete:

```bash
cd encubation_management_system_backend
npx prisma generate
```

---

## Rollback Plan

If you need to rollback the migration:

```sql
-- Remove User table columns
ALTER TABLE `users` 
  DROP COLUMN `first_name`,
  DROP COLUMN `middle_name`,
  DROP COLUMN `last_name`,
  DROP COLUMN `phone`,
  DROP COLUMN `profile_photo_url`,
  DROP COLUMN `enrollment_status`,
  DROP COLUMN `major_program`,
  DROP COLUMN `program_of_study`,
  DROP COLUMN `graduation_year`,
  DROP COLUMN `current_role`,
  DROP COLUMN `skills`,
  DROP COLUMN `support_interests`,
  DROP COLUMN `additional_notes`,
  DROP COLUMN `profile_completion_percentage`,
  DROP COLUMN `profile_phase_completion`;

-- Remove Project table columns
ALTER TABLE `projects`
  DROP COLUMN `startup_company_name`,
  DROP COLUMN `status_at_enrollment`,
  DROP COLUMN `challenge_description`;

-- Revert category enum (change back to original values)
-- ALTER TABLE `projects` MODIFY COLUMN `category` ENUM('Technology', 'Agriculture', 'Health', 'Education', 'Design') NOT NULL;
```

---

## Data Migration Strategy

### For Existing Users

After adding the new columns, you may want to migrate existing data:

```sql
-- Option 1: Split existing 'name' field into first_name and last_name
-- This is a simple split on first space - adjust as needed
UPDATE users 
SET 
  first_name = SUBSTRING_INDEX(name, ' ', 1),
  last_name = CASE 
    WHEN LOCATE(' ', name) > 0 
    THEN SUBSTRING(name, LOCATE(' ', name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL AND name IS NOT NULL AND name != '';

-- Option 2: Leave fields NULL and let users fill them
-- (Recommended - safer approach)
```

### Setting Default Profile Completion

For existing users, set completion based on existing data:

```sql
-- Initialize completion percentage based on existing data
UPDATE users 
SET profile_completion_percentage = 
  CASE 
    WHEN name IS NOT NULL THEN 20  -- Basic info exists
    ELSE 0
  END;
```

---

## Testing Checklist

After migration:

- [ ] Verify all new columns exist in users table
- [ ] Verify all new columns exist in projects table
- [ ] Verify enum values are correct
- [ ] Test creating a new user with new fields
- [ ] Test updating an existing user with new fields
- [ ] Test querying users with new fields
- [ ] Test JSON fields (skills, support_interests)
- [ ] Verify Prisma client generation works
- [ ] Test existing functionality still works
- [ ] Check database size/storage impact

---

## Troubleshooting

### Issue: ENUM modification fails
**Solution:** Recreate the column:
1. Create a backup of the data
2. Drop the old column
3. Create new column with all enum values
4. Restore data

### Issue: JSON columns not supported (old MySQL version)
**Solution:** Use TEXT instead and handle JSON in application:
```sql
-- Change JSON to TEXT
ALTER TABLE `users` MODIFY COLUMN `skills` TEXT NULL;
ALTER TABLE `users` MODIFY COLUMN `support_interests` TEXT NULL;
```

### Issue: Migration takes too long (large database)
**Solution:** 
- Run migration during off-peak hours
- Add columns one at a time
- Consider using online DDL if available

---

## Next Steps

After successful migration:

1. ✅ Update Prisma Client: `npx prisma generate`
2. ✅ Verify schema is in sync: `npx prisma db pull` (compare)
3. ✅ Update TODO list - mark Phase 1.1 complete
4. ✅ Proceed to Phase 2: Backend API Implementation

---

## Questions?

If you encounter issues:
1. Check Prisma documentation: https://www.prisma.io/docs/guides/migrate
2. Review MySQL ALTER TABLE documentation
3. Test on development database first
4. Create backups before any migration

Good luck! 🚀

