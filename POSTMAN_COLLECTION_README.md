# 🚀 Comprehensive Role-Based Postman Collection

## Overview

This Postman collection provides a complete, organized set of API endpoints for the Incubation Management System, organized by user roles for easy testing and role-based access control verification.

**File Name:** `COMPREHENSIVE_Role_Based_Postman_Collection.postman_collection.json`

**Version:** 3.0.0

## ✨ Features

- **Role-Based Organization**: Endpoints organized by user roles (Director, Manager, Mentor, Incubator)
- **Complete Profile Management**: All new profile endpoints (Phase 1-5) included
- **Auto-Token Management**: JWT tokens automatically saved after login
- **Test Scripts**: Pre-configured tests for each endpoint
- **Comprehensive Documentation**: Each endpoint includes detailed descriptions and examples
- **Ready to Import**: Valid JSON format, ready for direct import into Postman

## 📋 Collection Structure

### 1. 🔐 AUTHENTICATION - START HERE
- Login endpoints for all roles (Director, Manager, Mentor, Incubator)
- Get current user profile
- Logout
- **Auto-saves JWT token** for subsequent requests

### 2. 👤 ALL ROLES - PROFILE MANAGEMENT
**Accessible to all authenticated users** (Director, Manager, Mentor, Incubator)

#### Profile Endpoints:
- ✅ **Get Extended Profile** - Complete profile with all fields
- ✅ **Get Profile Completion** - Completion percentage and phase status
- ✅ **Get Profile Phase Data** - Get specific phase (1-5)
- ✅ **Phase 1: Update Basic Information** - First name, last name, phone, photo
- ✅ **Phase 2: Update Academic Profile** - Enrollment status, major, graduation year
- ✅ **Phase 3: Update Professional Profile** - Role, skills, support interests
- ✅ **Phase 5: Update Additional Information** - Optional notes
- ✅ **Upload/Update Profile Photo** - Profile picture URL
- Basic profile endpoints (legacy)

### 3. 🎯 DIRECTOR - FULL SYSTEM ACCESS
Complete administrative access including:
- User Management (CRUD operations)
- Dashboard & Analytics
- Teams & Projects (view all)
- Mentors (view all)
- Inventory (view all)
- Announcements (create)

### 4. 👔 MANAGER - OPERATIONAL MANAGEMENT
Day-to-day operational tasks:
- **Team Management** - Create, update, delete teams
- **Mentor Management** - Create, assign, manage mentors
- **Inventory Management** - Create, assign inventory items
- **Material Requests** - Approve/decline requests
- **Notifications** - Send notifications to teams
- **Reports** - Generate operational reports

### 5. 🚀 INCUBATOR - TEAM OPERATIONS
Team-focused operations:
- **Team Management** - View team, manage members
- **Project Management** - Create, update projects (with new fields)
- **Material Requests** - Request materials from managers
- **Inventory** - View available inventory
- **Notifications & Announcements** - View updates
- **Communication** - Team conversations

### 6. 🎓 MENTOR - TEAM GUIDANCE
Guidance and monitoring:
- **Team Management** - View assigned teams
- **Projects** - View assigned team projects
- **Analytics & Reports** - Team performance analytics
- **Communication** - Mentor conversations

### 7. 🌐 PUBLIC ACCESS
Endpoints accessible without authentication:
- System Health Check
- Public Announcements

## 🚀 Quick Start Guide

### Step 1: Import Collection
1. Open Postman
2. Click **Import** button
3. Select `COMPREHENSIVE_Role_Based_Postman_Collection.postman_collection.json`
4. Collection will be imported with all folders and endpoints

### Step 2: Configure Variables
The collection includes these variables (already configured):
- `base_url`: `http://localhost:3001/api` (change to your server URL)
- Test account credentials (Director, Manager, Mentor, Incubator)

### Step 3: Login
1. Go to **🔐 AUTHENTICATION - START HERE**
2. Choose your role and click **Login**
3. The JWT token will be **automatically saved** for all subsequent requests

### Step 4: Test Endpoints
1. Navigate to the appropriate role folder
2. Select any endpoint
3. Click **Send**
4. View response and test results

## 📝 Profile Management Workflow

### For Incubators (Complete Your Profile):

1. **Phase 1: Basic Information**
   - Update first name, last name, phone number
   - Upload profile photo (optional)

2. **Phase 2: Academic Profile**
   - Set enrollment status
   - Add major/program of study
   - Set graduation year

3. **Phase 3: Professional Profile**
   - Select current role
   - Add skills (at least 1)
   - Add support interests (at least 1)

4. **Phase 4: Project Information**
   - Create/update projects with new fields:
     - `startup_company_name`
     - `status_at_enrollment`
     - `challenge_description`

5. **Phase 5: Additional Information**
   - Add optional notes

### Check Completion:
- Use **Get Profile Completion** to see your progress
- Completion percentage automatically calculated
- Missing fields are identified

## 🔧 Configuration

### Update Base URL
If your API is running on a different URL:
1. Click on the collection name
2. Go to **Variables** tab
3. Update `base_url` value
4. Click **Save**

### Update Test Credentials
To use your own test accounts:
1. Go to **Variables** tab
2. Update email/password variables:
   - `director_email`, `director_password`
   - `manager_email`, `manager_password`
   - `incubator_email`, `incubator_password`
   - `mentor_email`, `mentor_password`

## 📊 New Profile Endpoints Details

### Phase 1: Basic Information
```json
{
  "first_name": "John",
  "middle_name": "Michael",  // optional
  "last_name": "Doe",
  "phone": "+250123456789",
  "profile_photo_url": "https://..."  // optional
}
```

### Phase 2: Academic Profile
```json
{
  "enrollment_status": "CurrentlyEnrolled",  // Enum: CurrentlyEnrolled, Graduated, OnLeave, Other
  "major_program": "Computer Science",
  "program_of_study": "Software Engineering",
  "graduation_year": 2025
}
```

### Phase 3: Professional Profile
```json
{
  "current_role": "ProjectLead",  // Enum: ProjectLead, Employee, FounderCoFounder, AttendsWorkshopsOnly, Other
  "skills": ["Coding/Development", "UX/UI Design"],
  "support_interests": ["Mentorship", "Funding"]
}
```

### Phase 4: Project Information
Update when creating/updating projects:
```json
{
  "startup_company_name": "HealthTech Solutions",
  "status_at_enrollment": "Prototype",  // Enum: Idea, Prototype, MVP, Beta, Launched
  "challenge_description": "Addressing health monitoring in rural areas"
}
```

### Phase 5: Additional Information
```json
{
  "additional_notes": "Optional notes here"  // Optional, max 5000 chars
}
```

## 🎯 Testing Tips

1. **Token Management**: Login endpoints automatically save tokens. No manual configuration needed.

2. **Role Testing**: 
   - Login as different roles to test access control
   - Verify that role-restricted endpoints return 403 for unauthorized roles

3. **Profile Completion**:
   - Start with Phase 1, work through phases sequentially
   - Check completion percentage after each phase
   - Verify that completion increases as you complete phases

4. **Error Testing**:
   - Try invalid data to test validation
   - Test with missing required fields
   - Test with invalid enum values

## 📦 Included Variables

| Variable | Default Value | Description |
|----------|--------------|-------------|
| `base_url` | `http://localhost:3001/api` | API base URL |
| `jwt_token` | (auto-set) | JWT authentication token |
| `test_team_id` | (auto-set) | Team ID for testing |
| `test_project_id` | (manual) | Project ID for testing |
| `test_mentor_id` | (manual) | Mentor ID for testing |
| `test_inventory_id` | (manual) | Inventory ID for testing |
| `test_request_id` | (manual) | Request ID for testing |
| `test_user_id` | (auto-set) | User ID for testing |

## 🔐 Test Accounts

Default test accounts (update in Variables tab):

| Role | Email | Password |
|------|-------|----------|
| Director | director@university.edu | director123 |
| Manager | manager@university.edu | manager123 |
| Incubator | innovatex@teams.com | team123 |
| Mentor | mentor@university.edu | mentor123 |

## 📝 Notes

- All profile endpoints are accessible to all authenticated users
- Profile completion percentage is automatically calculated
- Phase 4 completion requires project data (project endpoints)
- Profile photo requires uploading image first, then providing URL
- All endpoints include validation and error handling

## 🐛 Troubleshooting

### Token Not Saving
- Ensure you're using the login endpoints in the collection
- Check that test scripts are enabled in Postman settings

### 401 Unauthorized
- Make sure you've logged in first
- Check that `jwt_token` variable is set
- Verify token hasn't expired (re-login if needed)

### 403 Forbidden
- Verify you're logged in with the correct role
- Check endpoint access requirements

### 404 Not Found
- Verify `base_url` is correct
- Ensure endpoint paths match your API routes
- Check that server is running

## 📞 Support

For issues or questions:
1. Check endpoint descriptions for requirements
2. Verify your role has access to the endpoint
3. Check server logs for detailed error messages
4. Ensure all required fields are provided

## 🎉 Happy Testing!

This collection includes all endpoints organized by role, making it easy to:
- Test role-based access control
- Complete profile phases
- Verify all system functionality
- Debug API issues

**Ready to import and start testing!** 🚀

