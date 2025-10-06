# 🚀 Role-Based Postman Collection Guide

## 📋 Overview

This guide explains how to use the **Role-Based Postman Collection** for testing the Incubation Management System API. The collection is organized by user roles, making it easy to test role-based access control (RBAC) and understand what each user type can access.

## 📁 Collection Structure

```
📦 Role-Based Postman Collection
├── 🔐 AUTHENTICATION - START HERE
├── 🎯 DIRECTOR - FULL SYSTEM ACCESS
├── 👔 MANAGER - OPERATIONAL MANAGEMENT
├── 🚀 INCUBATOR - TEAM OPERATIONS
├── 🎓 MENTOR - TEAM GUIDANCE
└── 🌐 PUBLIC ACCESS
```

## 🛠️ Setup Instructions

### Step 1: Import the Collection

1. **Open Postman**
2. **Click "Import"** (top left)
3. **Select "File"**
4. **Choose**: `Role_Based_Postman_Collection.postman_collection.json`
5. **Click "Import"**

### Step 2: Create Environment

1. **Click the gear icon** (⚙️) in the top right
2. **Click "Add"** to create a new environment
3. **Name it**: `Incubation System - Local`
4. **Add these variables**:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3001/api` | API base URL |
| `jwt_token` | `` | JWT token (auto-set after login) |
| `test_team_id` | `` | Team ID (auto-set for incubators) |
| `test_project_id` | `` | Project ID for testing |
| `test_mentor_id` | `` | Mentor ID for testing |
| `test_inventory_id` | `` | Inventory ID for testing |
| `test_request_id` | `` | Request ID for testing |
| `director_email` | `director@university.edu` | Director test account |
| `director_password` | `director123` | Director password |
| `manager_email` | `manager@university.edu` | Manager test account |
| `manager_password` | `manager123` | Manager password |
| `incubator_email` | `innovatex@teams.com` | Incubator test account |
| `incubator_password` | `team123` | Incubator password |
| `mentor_email` | `mentor@university.edu` | Mentor test account |
| `mentor_password` | `mentor123` | Mentor password |

5. **Click "Save"**

### Step 3: Select Environment

1. **Click the environment dropdown** (top right)
2. **Select**: `Incubation System - Local`

## 🔐 Authentication & Token Management

### How Token Management Works

The collection uses **automatic token management**:

1. **Login requests** automatically save the JWT token to `jwt_token` variable
2. **All authenticated requests** use this token via Bearer authentication
3. **Logout** clears the token

### Step-by-Step Authentication

#### Option A: Login as Director (Full Access)

1. **Open the collection**
2. **Go to**: `🔐 AUTHENTICATION - START HERE`
3. **Select**: `🎯 Login as Director (Full Access)`
4. **Click "Send"**
5. ✅ **Token automatically saved** - you can now use any endpoint!

#### Option B: Login as Manager

1. **Select**: `👔 Login as Manager (Operational Management)`
2. **Click "Send"**
3. ✅ **Token saved** - access manager-level endpoints

#### Option C: Login as Incubator

1. **Select**: `🚀 Login as Incubator (Team Operations)`
2. **Click "Send"**
3. ✅ **Token and team ID saved** - access team-specific endpoints

#### Option D: Login as Mentor

1. **Select**: `🎓 Login as Mentor (Team Guidance)`
2. **Click "Send"**
3. ✅ **Token saved** - access mentor endpoints

## 🎯 Using Role-Based Folders

### Director Role (🎯 DIRECTOR - FULL SYSTEM ACCESS)

**Access Level**: Complete system access
**Use Case**: System administrators, executives

**Available Endpoints:**
- 📊 Dashboard Analytics
- 👥 View All Teams
- 📁 View All Projects
- 🎓 View All Mentors
- 📦 View All Inventory
- 📋 View All Requests
- 📊 Generate All Reports
- 📢 Create Announcements
- 💬 View All Conversations

**Example Usage:**
1. Login as Director
2. Go to `🎯 DIRECTOR - FULL SYSTEM ACCESS`
3. Click `📊 Dashboard Analytics` → See full system overview
4. Click `👥 View All Teams` → Manage all teams

### Manager Role (👔 MANAGER - OPERATIONAL MANAGEMENT)

**Access Level**: Operational oversight
**Use Case**: Program managers, coordinators

**Available Endpoints:**
- ➕ Create New Team
- 👥 Manage Teams (CRUD)
- 🎓 Create/Manage Mentors
- ➕ Create/Manage Inventory
- 📋 Approve/Decline Requests
- 📢 Create Notifications
- 📊 Generate Reports
- 💬 Team Communications

**Example Usage:**
1. Login as Manager
2. Go to `👔 MANAGER - OPERATIONAL MANAGEMENT`
3. Click `➕ Create New Team` → Add new incubation team
4. Click `📋 Approve Requests` → Review material requests

### Incubator Role (🚀 INCUBATOR - TEAM OPERATIONS)

**Access Level**: Team-specific operations
**Use Case**: Student entrepreneurs, team leaders

**Available Endpoints:**
- 👤 My Team Details
- 👥 Manage Team Members
- ➕ Create Projects
- 📁 My Team Projects
- 📝 Update Project Progress
- 📎 Upload Project Files
- 📋 Request Materials
- 📦 View Available Inventory
- 🔔 My Notifications
- 📢 View Announcements
- 💬 Team Conversations

**Example Usage:**
1. Login as Incubator
2. Go to `🚀 INCUBATOR - TEAM OPERATIONS`
3. Click `➕ Create Project` → Start new project
4. Click `📋 Request Materials` → Request equipment
5. Click `📎 Upload Project Files` → Add project documentation

### Mentor Role (🎓 MENTOR - TEAM GUIDANCE)

**Access Level**: Assigned team guidance
**Use Case**: Academic mentors, industry experts

**Available Endpoints:**
- 👥 My Assigned Teams
- 📁 Assigned Team Projects
- 📊 Project Reports
- 📊 Dashboard Analytics
- 💬 Mentor Conversations

**Example Usage:**
1. Login as Mentor
2. Go to `🎓 MENTOR - TEAM GUIDANCE`
3. Click `👥 My Assigned Teams` → View mentee teams
4. Click `📁 Assigned Team Projects` → Monitor progress
5. Click `💬 Mentor Conversations` → Guide teams

### Public Access (🌐 PUBLIC ACCESS)

**Access Level**: No authentication required
**Use Case**: Public information, health checks

**Available Endpoints:**
- 💚 System Health Check
- 📢 Public Announcements

**Example Usage:**
1. **No login required**
2. Go to `🌐 PUBLIC ACCESS`
3. Click `💚 System Health Check` → Verify system status
4. Click `📢 Public Announcements` → View public notices

## 🔄 Switching Between Roles

To test different roles:

1. **Logout** (from any role folder)
2. **Login as different role** (from Authentication folder)
3. **Navigate to new role folder**
4. **Test role-specific endpoints**

## 🧪 Testing & Validation

### Automatic Tests

Each request includes **automatic test scripts** that:
- ✅ Validate response structure
- ✅ Check success/error codes
- ✅ Verify data types
- ✅ Store IDs for follow-up requests

### Manual Testing Tips

1. **Test Access Control**:
   - Login as Incubator → Try Manager endpoints → Should get 403 Forbidden
   - Login as Mentor → Try Director endpoints → Should get 403 Forbidden

2. **Test Data Flow**:
   - Create team as Manager
   - Login as Incubator from that team
   - Verify team data is accessible

3. **Test File Uploads**:
   - Use Incubator role
   - Create project
   - Upload files (PDF, images)
   - Verify file listing

## 🚨 Error Testing

Use the **ERROR TESTING** folder to validate:
- Invalid credentials
- Missing authentication
- Insufficient permissions
- Invalid data formats

## 📊 Environment Variables Reference

### Auto-Managed Variables
- `jwt_token` - Automatically set after login
- `test_team_id` - Set for Incubator role
- `test_project_id` - Set when creating/viewing projects
- `test_mentor_id` - Set when viewing mentors
- `test_inventory_id` - Set when viewing inventory
- `test_request_id` - Set when viewing requests

### Manual Variables
- `base_url` - Change for different environments
- `*_email` - Test account emails
- `*_password` - Test account passwords

## 🌐 Production Deployment

For production use:

1. **Change `base_url`** to your deployed API URL
2. **Update test accounts** if using different credentials
3. **Import collection** into your team's Postman workspace

## 📞 Support

If you encounter issues:

1. **Check environment variables** are set correctly
2. **Verify backend is running** on the specified port
3. **Check network connectivity** to API endpoints
4. **Review test scripts** for validation errors

## 🎯 Quick Start Checklist

- [ ] Import collection into Postman
- [ ] Create environment with variables
- [ ] Select environment
- [ ] Start backend server (`npm run dev`)
- [ ] Login as desired role
- [ ] Test role-specific endpoints
- [ ] Verify automatic token management

---

**🎉 You're ready to test the Incubation Management System API with proper role-based access control!**