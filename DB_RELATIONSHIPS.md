# Database Relationships Overview

This document summarizes the Prisma schema relationships used by the Incubation Management System.

## Core Entities

- **User** (`users`)
  - Roles: `director`, `manager`, `mentor`, `incubator`.
  - One-to-many: `team_members`, `projects_uploaded`, `messages_sent`, `notifications_sent`, `announcements_created`.
  - One-to-one optional: `email_preferences`.
  - Specializations:
    - Mentor profile stored in `mentor` (1:1 via `user_id`).
    - Incubator participation tracked via `team_members` (role marks leader/member).

- **Team** (`teams`)
  - Fields: `team_name`, `company_name?`, `status` (`active|pending|inactive`).
  - One-to-many: `team_members`, `projects`, `mentor_assignments`, `inventory_assignments`, `material_requests`.

- **TeamMember** (`team_members`)
  - Links `user` to `team` with a `role` enum (`team_leader`, `member`).
  - Unique composite (`team_id`, `user_id`) prevents duplicates.
  - Deleting team/user cascades.

- **Project** (`projects`)
  - Belongs to a `team`; cascade on delete.
  - One-to-many: `project_files`.

- **ProjectFile** (`project_files`)
  - Belongs to `project`; references uploader `user`.

- **Mentor** (`mentors`)
  - 1:1 with `user` (`user_id` unique).
  - One-to-many: `mentor_assignments`.

- **MentorAssignment** (`mentor_assignments`)
  - Links `mentor` to `team`; unique per mentor-team pair.

- **InventoryItem** (`inventory_items`)
  - One-to-many: `inventory_assignments`.

- **InventoryAssignment** (`inventory_assignments`)
  - Links inventory `item` to `team`; tracks quantity and return status.

- **MaterialRequest** (`material_requests`)
  - Belongs to `team`; requester and reviewer are `user` references.

- **Messaging**
  - `Conversation` stores participants (JSON array).
  - `Message` belongs to `conversation` and `sender` (user).

- **Notification** (`notifications`)
  - Sent by `user`; recipient is either `team` or `user` (by id + `recipient_type`).

- **Announcement** (`announcements`)
  - Authored by `user`.

- **EmailLog** (`email_logs`)
  - Audit of outgoing emails (recipient, template, status, errors).

- **EmailPreferences** (`email_preferences`)
  - 1:1 with `user` via `user_id`.

## Tables (Prisma models ↔ DB tables)

- `users` (model `User`)
- `teams` (model `Team`)
- `team_members` (model `TeamMember`)
- `projects` (model `Project`)
- `project_files` (model `ProjectFile`)
- `mentors` (model `Mentor`)
- `mentor_assignments` (model `MentorAssignment`)
- `inventory_items` (model `InventoryItem`)
- `inventory_assignments` (model `InventoryAssignment`)
- `material_requests` (model `MaterialRequest`)
- `messages` (model `Message`)
- `conversations` (model `Conversation`)
- `notifications` (model `Notification`)
- `announcements` (model `Announcement`)
- `email_logs` (model `EmailLog`)
- `email_preferences` (model `EmailPreferences`)

## Tables and Columns (Prisma models → DB columns)

- `users` (`User`)
  - id (PK), email (unique), password_hash, role, name, first_name, middle_name, last_name, phone, profile_photo_url, enrollment_status, major_program, program_of_study, graduation_year, current_role, skills (json), support_interests (json), additional_notes, profile_completion_percentage, profile_phase_completion (json), created_at, updated_at

- `teams` (`Team`)
  - id (PK), team_name, company_name, status, created_at, updated_at

- `team_members` (`TeamMember`)
  - id (PK), team_id (FK→teams), user_id (FK→users), role (`team_leader`|`member`), joined_at
  - unique: (team_id, user_id)

- `projects` (`Project`)
  - id (PK), name, description, startup_company_name, status_at_enrollment, challenge_description, team_id (FK→teams), category, status, progress, created_at, updated_at

- `project_files` (`ProjectFile`)
  - id (PK), project_id (FK→projects), file_name, file_path, file_type, file_size, uploaded_by (FK→users), uploaded_at

- `mentors` (`Mentor`)
  - id (PK), user_id (FK→users, unique), expertise, phone, created_at

- `mentor_assignments` (`MentorAssignment`)
  - id (PK), mentor_id (FK→mentors), team_id (FK→teams), assigned_at
  - unique: (mentor_id, team_id)

- `inventory_items` (`InventoryItem`)
  - id (PK), name, description, total_quantity, available_quantity, status, created_at, updated_at

- `inventory_assignments` (`InventoryAssignment`)
  - id (PK), item_id (FK→inventory_items), team_id (FK→teams), quantity, assigned_at, returned_at

- `material_requests` (`MaterialRequest`)
  - id (PK), team_id (FK→teams), item_name, description, status, requested_by (FK→users), reviewed_by (FK→users, nullable), requested_at, reviewed_at

- `messages` (`Message`)
  - id (PK), conversation_id (FK→conversations), sender_id (FK→users), content, message_type, file_path, sent_at

- `conversations` (`Conversation`)
  - id (PK), participants (json array), created_at, updated_at

- `notifications` (`Notification`)
  - id (PK), title, message, sender_id (FK→users), recipient_type (`team`|`user`), recipient_id, read_status, created_at

- `announcements` (`Announcement`)
  - id (PK), title, content, author_id (FK→users), created_at, updated_at

- `email_logs` (`EmailLog`)
  - id (PK), recipient, subject, template_name, status, error_message, sent_at, created_at

- `email_preferences` (`EmailPreferences`)
  - id (PK), user_id (FK→users, unique), user_created, user_updated, team_updates, project_updates, notifications, messages, announcements, material_requests, inventory_updates, created_at, updated_at

## Key Enums

- `UserRole`: `director | manager | mentor | incubator`
- `TeamStatus`: `active | pending | inactive`
- `TeamMemberRole`: `team_leader | member`
- Others: `ProjectStatus`, `ProjectCategory`, `InventoryStatus`, `RequestStatus`, `MessageType`, `RecipientType`, etc.

## Leadership Model

- Leadership is represented by `team_members.role = team_leader`.
- Each team leader is also a team member (same `TeamMember` row, marked as `team_leader`).
- On team creation, the leader user is added to `team_members` with role `team_leader`.

## Cascading Rules

- Most relations use `onDelete: Cascade` (Team ↔ TeamMember, Team ↔ Project, Team ↔ MentorAssignment, Team ↔ InventoryAssignment, Team ↔ MaterialRequest, Project ↔ ProjectFile, User ↔ Mentor, etc.).
- Composite uniques enforce:
  - `team_members`: one row per (team, user).
  - `mentor_assignments`: one row per (mentor, team).

## How to Find a Team’s Leader

- Query `team_members` for `team_id = <id>` where `role = team_leader`, join to `users` for details.

## Tokens and Team Context (incubators)

- JWT payload can include `teamId` for incubator users (derived from first `team_members` row).
- Middleware surfaces `req.user.teamId`; frontend can use it to fetch/manage team data.

## Common Workflows

- **Create Team**: create `user` (incubator) if missing, add `team`, insert leader row into `team_members` with `role=team_leader`.
- **Add Member**: insert into `team_members` with `role=member` (or `team_leader` if reassigning leadership logic is added).
- **Assign Mentor**: insert into `mentor_assignments` (unique per mentor-team).
- **Inventory Assignment**: insert into `inventory_assignments` for a `team`.
- **Material Request**: link to `team`, requester `user`, optional reviewer `user`.

## Notes for Future Changes

- If supporting leader reassignment, update `team_members` to set previous leader to `member` and target to `team_leader` (keep unique (team,user) intact).
- If multiple team memberships per incubator are needed, remove the implicit single-team assumption in auth/JWT.

