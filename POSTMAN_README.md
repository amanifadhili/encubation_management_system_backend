# 🚀 Incubation Management System - Complete Postman Collection

## 📋 Overview

This directory contains a **complete, ready-to-import Postman collection** for testing all API endpoints of the Incubation Management System backend. The collection includes authentication, comprehensive test suites, and automated validation scripts.

## 📁 Files Included

### Primary Testing Files
- **`Complete_API_Testing.postman_collection.json`** - Main Postman collection (49KB, 50+ requests)
- **`test_environment.json`** - Postman environment variables
- **`newman_config.json`** - Newman CLI configuration for automated testing

### Supporting Documentation
- **`API_TESTING_GUIDE.md`** - Comprehensive testing guide (500+ lines)
- **`API_TESTING_CHECKLIST.md`** - Detailed endpoint checklist (400+ lines)
- **`POSTMAN_README.md`** - This file

## 🚀 Quick Start - Import & Test

### Step 1: Import the Collection
1. Open Postman
2. Click **Import** button
3. Select **File**
4. Choose `Complete_API_Testing.postman_collection.json`
5. Click **Import**

### Step 2: Set Up Environment
1. Click **Environments** (left sidebar)
2. Click **Import**
3. Select `test_environment.json`
4. Make sure the environment is selected

### Step 3: Configure Base URL
In the environment variables, set:
```
base_url = http://localhost:3001/api
```
*(Change this to your deployed backend URL when testing production)*

### Step 4: Start Testing
1. **Start with Authentication folder**
2. Run login requests for different roles
3. JWT tokens will be automatically stored
4. Test other endpoints in sequence

## 📊 Collection Structure

### 🔐 Authentication (4 requests)
- **Login - Director** - Full system access
- **Login - Manager** - Operational management
- **Login - Incubator** - Team operations
- **Login - Mentor** - Team guidance
- **Get Current User** - Profile information
- **Logout** - Session termination

### 👥 Team Management (8 requests)
- List all teams (role-filtered)
- Create new team (Manager only)
- Get team details
- Update team information
- Delete team
- Manage team members
- Add/remove team members

### 📁 Project Management (10 requests)
- List projects (filtered by permissions)
- Create project (Incubator only)
- Get project details
- Update project progress
- Delete project
- Upload project files
- List project files
- Download/delete files

### 🧑‍🏫 Mentor Management (6 requests)
- List all mentors
- Create mentor (Manager only)
- Get mentor details
- Update mentor information
- Delete mentor
- Assign mentor to teams

### 🛠️ Inventory Management (8 requests)
- List inventory items
- Create inventory item (Manager only)
- Get item details
- Update item information
- Delete item
- Assign items to teams
- Unassign items from teams

### 📋 Material Requests (6 requests)
- List material requests
- Create request (Incubator only)
- Get request details
- Update request status (Manager only)
- Approve/decline requests

### 💬 Messaging System (8 requests)
- List conversations
- Create conversation
- Get conversation messages
- Send text messages
- Send file messages
- Real-time message delivery

### 📢 Notifications (6 requests)
- List notifications
- Create notification (Manager only)
- Mark as read
- Delete notification
- Real-time notifications

### 📊 Reports & Analytics (6 requests)
- Get dashboard analytics
- Team reports
- Project reports
- Inventory reports
- Export reports (PDF)

### 📣 Announcements (6 requests)
- List announcements
- Create announcement (Manager/Director)
- Get announcement details
- Update announcement
- Delete announcement

### ❌ Error Testing (4 requests)
- Invalid login credentials
- Access without authentication
- Access non-existent resources
- Invalid request data

### 🏥 Health Check (1 request)
- System health status

## 🔑 Test User Credentials

The collection includes pre-configured test accounts:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Director** | `director@university.edu` | `director123` | Full system access |
| **Manager** | `manager@university.edu` | `manager123` | Team & resource management |
| **Mentor** | `mentor@university.edu` | `mentor123` | Assigned team guidance |
| **Incubator** | `innovatex@teams.com` | `team123` | Own team operations |

## 🎯 Testing Workflow

### 1. Authentication Testing
```
Login → Get Profile → Verify Token → Test Protected Endpoints
```

### 2. Role-Based Access Testing
```
Director Login → Test All Endpoints
Manager Login → Test Management Features
Incubator Login → Test Team Features
Mentor Login → Test Assigned Features
```

### 3. CRUD Operations Testing
```
Create → Read → Update → Delete → Verify
```

### 4. File Upload Testing
```
Upload File → Verify Storage → Download → Delete
```

### 5. Real-time Features Testing
```
Send Message → Receive Message → File Sharing
```

## 🔧 Automated Testing with Newman

### Install Newman
```bash
npm install -g newman
```

### Run Automated Tests
```bash
# Basic test run
npm run test:api

# Generate HTML report
npm run test:api:html

# Generate JSON report
npm run test:api:json

# CI/CD compatible
npm run test:api:ci
```

### Newman Reports
- **CLI Output**: Real-time test results
- **HTML Report**: Visual test results with charts
- **JSON Report**: Machine-readable results
- **JUnit XML**: CI/CD integration

## 📊 Test Results Interpretation

### ✅ Successful Tests
- **Status**: 200-299 range
- **Response**: Proper JSON structure
- **Data**: Expected fields present
- **Validation**: Schema compliance

### ❌ Failed Tests
- **Authentication Errors**: 401 Unauthorized
- **Permission Errors**: 403 Forbidden
- **Not Found Errors**: 404 Not Found
- **Validation Errors**: 400 Bad Request, 422 Unprocessable Entity

## 🔍 Common Issues & Solutions

### Connection Issues
```bash
# Check if backend is running
curl http://localhost:3001/health

# Check database connection
# Backend logs will show database errors
```

### Authentication Issues
```bash
# Clear Postman environment variables
# Re-run login requests
# Check JWT token expiration
```

### Permission Issues
```bash
# Verify user role in login response
# Check endpoint access permissions
# Test with different user roles
```

### File Upload Issues
```bash
# Check file size limits (10MB)
# Verify file type restrictions
# Check upload directory permissions
```

## 📈 Performance Testing

### Response Time Benchmarks
- **Simple GET requests**: < 100ms
- **Complex queries**: < 200ms
- **File uploads**: < 500ms
- **Report generation**: < 1000ms

### Load Testing
```bash
# Test concurrent users
ab -n 1000 -c 10 http://localhost:3001/api/teams

# Monitor response times and error rates
```

## 🔒 Security Testing

### Authentication Security
- [ ] JWT token validation
- [ ] Password complexity requirements
- [ ] Session management
- [ ] Token expiration

### Authorization Security
- [ ] Role-based access control
- [ ] Data isolation
- [ ] Permission enforcement
- [ ] Cross-tenant access prevention

### Data Protection
- [ ] Input validation and sanitization
- [ ] XSS prevention
- [ ] SQL injection protection
- [ ] File upload security

## 🚀 Production Testing

### Pre-Deployment Checklist
- [ ] Update base_url in environment
- [ ] Test all endpoints with production data
- [ ] Verify SSL/TLS configuration
- [ ] Test rate limiting
- [ ] Validate CORS settings
- [ ] Check file storage configuration

### Production Environment Variables
```json
{
  "base_url": "https://your-api-domain.com/api",
  "jwt_token": "",
  // ... other variables
}
```

## 📞 Support & Troubleshooting

### Getting Help
1. **Check API Testing Guide** (`API_TESTING_GUIDE.md`)
2. **Review Testing Checklist** (`API_TESTING_CHECKLIST.md`)
3. **Check Backend Logs** for server errors
4. **Verify Database Connection** and data seeding

### Common Error Codes
- **400**: Bad Request - Check request format
- **401**: Unauthorized - Check authentication
- **403**: Forbidden - Check permissions
- **404**: Not Found - Check resource existence
- **422**: Validation Error - Check input data
- **429**: Too Many Requests - Check rate limiting
- **500**: Server Error - Check backend logs

## 🎯 Success Criteria

### ✅ All Tests Pass
- [ ] Authentication works for all roles
- [ ] All CRUD operations functional
- [ ] File uploads working correctly
- [ ] Real-time features operational
- [ ] Role-based access enforced
- [ ] Error handling working properly
- [ ] Performance within acceptable limits
- [ ] Security measures effective

### ✅ Ready for Production
- [ ] All endpoints tested and validated
- [ ] Error scenarios handled gracefully
- [ ] Security vulnerabilities addressed
- [ ] Performance requirements met
- [ ] Documentation complete

---

## 🎉 **Ready to Test!**

**Your complete Postman collection is ready for import and testing!**

1. **Import** `Complete_API_Testing.postman_collection.json`
2. **Set up** the environment with your backend URL
3. **Start testing** with authentication requests
4. **Run through** all endpoint categories
5. **Generate reports** with Newman for documentation

**Happy Testing! 🚀**