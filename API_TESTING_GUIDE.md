# 🚀 Incubation Management System - Comprehensive API Testing Guide

## 📋 Table of Contents

- [Overview](#overview)
- [Testing Environment Setup](#testing-environment-setup)
- [Authentication & Authorization Testing](#authentication--authorization-testing)
- [API Endpoint Testing Matrix](#api-endpoint-testing-matrix)
- [Role-Based Access Testing](#role-based-access-testing)
- [Error Scenario Testing](#error-scenario-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [Automated Testing with Newman](#automated-testing-with-newman)
- [Testing Checklist](#testing-checklist)

---

## 🎯 Overview

This comprehensive API testing guide provides detailed instructions for testing all endpoints of the Incubation Management System backend. The guide covers manual testing with Postman, automated testing with Newman, and includes test scenarios for different user roles, edge cases, and security validation.

### Testing Objectives
- ✅ Verify all API endpoints function correctly
- ✅ Test role-based access control (RBAC)
- ✅ Validate input/output data structures
- ✅ Test error handling and edge cases
- ✅ Ensure security measures are effective
- ✅ Performance and load testing
- ✅ Automated regression testing

### Test Environment Requirements
- ✅ MySQL database running with test data
- ✅ Backend server running on port 3001
- ✅ Postman or similar API testing tool
- ✅ Newman CLI for automated testing (optional)

---

## 🛠️ Testing Environment Setup

### 1. Database Setup
```bash
# Ensure MySQL is running
sudo service mysql start

# Create test database
mysql -u root -p
CREATE DATABASE incubation_test;
EXIT;

# Run migrations
cd encubation_management_system_backend
npm run db:push
npm run db:seed
```

### 2. Backend Server Setup
```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start server
npm run dev
```

### 3. Postman Setup
```bash
# Import the Postman collection
# File: postman_collection.json
# Set environment variables:
# - base_url: http://localhost:3001/api
# - jwt_token: (will be set after login)
```

### 4. Test Data Setup
The system includes predefined test users for each role:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Director | `director@university.edu` | `director123` | Full system access |
| Manager | `manager@university.edu` | `manager123` | Operational management |
| Mentor | `mentor@university.edu` | `mentor123` | Team guidance |
| Incubator | `innovatex@teams.com` | `team123` | Team operations |

---

## 🔐 Authentication & Authorization Testing

### Login Testing Scenarios

#### ✅ Valid Login Tests
```json
// POST /api/auth/login
{
  "email": "director@university.edu",
  "password": "director123"
}

// Expected Response:
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "director@university.edu",
    "name": "Director Name",
    "role": "director"
  }
}
```

#### ❌ Invalid Login Tests
- Wrong password
- Non-existent email
- Empty credentials
- Malformed email format
- SQL injection attempts

#### Rate Limiting Tests
```bash
# Make 6 rapid login attempts (exceeds 5 limit)
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"director@university.edu","password":"wrong"}'
done

# Expected: 429 Too Many Requests on 6th attempt
```

### Token Validation Tests

#### ✅ Valid Token Tests
```bash
# Use token from successful login
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### ❌ Invalid Token Tests
- Expired tokens
- Malformed tokens
- Missing tokens
- Tampered tokens

---

## 📊 API Endpoint Testing Matrix

### Authentication Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/auth/login` | POST | All | ✅ Valid login, ❌ Invalid credentials, ❌ Rate limiting |
| `/api/auth/logout` | POST | Authenticated | ✅ Valid logout, ❌ No token |
| `/api/auth/me` | GET | Authenticated | ✅ Valid token, ❌ Invalid token, ❌ Expired token |

### Team Management Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/teams` | GET | Director, Manager, Incubator | ✅ List teams, ❌ Unauthorized, ✅ Filtering |
| `/api/teams` | POST | Manager | ✅ Create team, ❌ Validation errors, ❌ Unauthorized |
| `/api/teams/:id` | GET | Director, Manager, Incubator* | ✅ Get team, ❌ Not found, ❌ Access denied |
| `/api/teams/:id` | PUT | Manager, Incubator* | ✅ Update team, ❌ Validation, ❌ Permissions |
| `/api/teams/:id` | DELETE | Manager | ✅ Delete team, ❌ Not found, ❌ Unauthorized |
| `/api/teams/:id/members` | GET | Director, Manager, Incubator* | ✅ List members, ❌ Access denied |
| `/api/teams/:id/members` | POST | Incubator* | ✅ Add member, ❌ Validation, ❌ Permissions |
| `/api/teams/:id/members/:userId` | DELETE | Incubator* | ✅ Remove member, ❌ Not found |

*Incubator role limited to own team

### Project Management Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/projects` | GET | All (filtered) | ✅ List projects, ❌ Unauthorized, ✅ Filtering |
| `/api/projects` | POST | Incubator | ✅ Create project, ❌ Validation, ❌ Unauthorized |
| `/api/projects/:id` | GET | All (team access) | ✅ Get project, ❌ Not found, ❌ Access denied |
| `/api/projects/:id` | PUT | Incubator*, Manager, Director | ✅ Update project, ❌ Validation |
| `/api/projects/:id` | DELETE | Incubator*, Manager, Director | ✅ Delete project, ❌ Permissions |
| `/api/projects/:id/files` | POST | Incubator* | ✅ Upload files, ❌ File validation, ❌ Size limits |
| `/api/projects/:id/files` | GET | All (team access) | ✅ List files, ❌ Access denied |
| `/api/projects/:id/files/:fileId` | DELETE | Incubator* | ✅ Delete file, ❌ Permissions |

### Mentor Management Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/mentors` | GET | Director, Manager | ✅ List mentors, ❌ Unauthorized |
| `/api/mentors` | POST | Director, Manager | ✅ Create mentor, ❌ Validation |
| `/api/mentors/:id` | GET | Director, Manager, Incubator* | ✅ Get mentor, ❌ Access denied |
| `/api/mentors/:id` | PUT | Director, Manager | ✅ Update mentor, ❌ Permissions |
| `/api/mentors/:id` | DELETE | Director, Manager | ✅ Delete mentor, ❌ Unauthorized |
| `/api/mentors/:id/assign` | POST | Director, Manager | ✅ Assign to team, ❌ Validation |
| `/api/mentors/:id/assign/:teamId` | DELETE | Director, Manager | ✅ Remove assignment |

### Inventory Management Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/inventory` | GET | Director, Manager, Incubator* | ✅ List items, ❌ Unauthorized |
| `/api/inventory` | POST | Manager | ✅ Create item, ❌ Validation |
| `/api/inventory/:id` | GET | Director, Manager, Incubator* | ✅ Get item, ❌ Not found |
| `/api/inventory/:id` | PUT | Manager | ✅ Update item, ❌ Permissions |
| `/api/inventory/:id` | DELETE | Manager | ✅ Delete item, ❌ Unauthorized |
| `/api/inventory/:id/assign` | POST | Manager | ✅ Assign to team, ❌ Insufficient stock |
| `/api/inventory/:id/assign/:teamId` | DELETE | Manager | ✅ Unassign from team |

### Material Request Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/requests` | GET | Manager, Incubator* | ✅ List requests, ❌ Unauthorized |
| `/api/requests` | POST | Incubator | ✅ Create request, ❌ Validation |
| `/api/requests/:id` | GET | Manager, Incubator* | ✅ Get request, ❌ Access denied |
| `/api/requests/:id/status` | PUT | Manager | ✅ Update status, ❌ Permissions |

### Messaging Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/conversations` | GET | All (filtered) | ✅ List conversations, ❌ Unauthorized |
| `/api/conversations` | POST | All | ✅ Create conversation, ❌ Validation |
| `/api/conversations/:id/messages` | GET | Participants | ✅ Get messages, ❌ Access denied |
| `/api/conversations/:id/messages` | POST | Participants | ✅ Send message, ❌ Permissions |
| `/api/conversations/:id/messages/file` | POST | Participants | ✅ Send file, ❌ File validation |

### Notification Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/notifications` | GET | Manager, Incubator* | ✅ List notifications, ❌ Unauthorized |
| `/api/notifications` | POST | Manager | ✅ Create notification, ❌ Permissions |
| `/api/notifications/:id/read` | PUT | Incubator* | ✅ Mark as read, ❌ Access denied |
| `/api/notifications/:id` | DELETE | Manager | ✅ Delete notification, ❌ Unauthorized |

### Announcement Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/announcements` | GET | All | ✅ List announcements, ❌ Unauthorized |
| `/api/announcements` | POST | Director, Manager | ✅ Create announcement, ❌ Permissions |
| `/api/announcements/:id` | GET | All | ✅ Get announcement, ❌ Not found |
| `/api/announcements/:id` | PUT | Director, Manager | ✅ Update announcement, ❌ Unauthorized |
| `/api/announcements/:id` | DELETE | Director, Manager | ✅ Delete announcement, ❌ Permissions |

### Reports Endpoints

| Endpoint | Method | Roles | Test Cases |
|----------|--------|-------|------------|
| `/api/reports/teams` | GET | Director, Manager | ✅ Team reports, ❌ Unauthorized |
| `/api/reports/projects` | GET | Director, Manager, Mentor | ✅ Project reports, ❌ Permissions |
| `/api/reports/inventory` | GET | Director, Manager | ✅ Inventory reports, ❌ Unauthorized |
| `/api/dashboard/analytics` | GET | All (filtered) | ✅ Dashboard data, ❌ Access denied |
| `/api/reports/export` | POST | Director, Manager | ✅ Export reports, ❌ Permissions |

---

## 👥 Role-Based Access Testing

### Director Role Testing

**Full System Access:**
```bash
# Login as director
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"director@university.edu","password":"director123"}'

# Should have access to all endpoints
curl -X GET http://localhost:3001/api/teams \
  -H "Authorization: Bearer DIRECTOR_JWT_TOKEN"

curl -X GET http://localhost:3001/api/reports/teams \
  -H "Authorization: Bearer DIRECTOR_JWT_TOKEN"
```

### Manager Role Testing

**Operational Management:**
```bash
# Login as manager
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@university.edu","password":"manager123"}'

# Should access team management
curl -X POST http://localhost:3001/api/teams \
  -H "Authorization: Bearer MANAGER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"team_name":"New Team","company_name":"New Corp","credentials":{"email":"new@team.com","password":"pass123"}}'

# Should access inventory management
curl -X GET http://localhost:3001/api/inventory \
  -H "Authorization: Bearer MANAGER_JWT_TOKEN"
```

### Incubator Role Testing

**Team-Specific Access:**
```bash
# Login as incubator
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"innovatex@teams.com","password":"team123"}'

# Should access own team projects
curl -X GET http://localhost:3001/api/projects \
  -H "Authorization: Bearer INCUBATOR_JWT_TOKEN"

# Should be denied access to other teams
curl -X GET http://localhost:3001/api/teams \
  -H "Authorization: Bearer INCUBATOR_JWT_TOKEN"
# Expected: Limited to own team data
```

---

## ❌ Error Scenario Testing

### Validation Error Testing

#### Input Validation
```bash
# Test team creation with invalid data
curl -X POST http://localhost:3001/api/teams \
  -H "Authorization: Bearer MANAGER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team_name": "A",
    "company_name": "Valid Company",
    "credentials": {
      "email": "invalid-email",
      "password": "123"
    }
  }'

# Expected Response:
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "team_name",
      "message": "Team name must be at least 2 characters long"
    },
    {
      "field": "credentials.email",
      "message": "Please enter a valid email address"
    },
    {
      "field": "credentials.password",
      "message": "Password must meet security requirements"
    }
  ]
}
```

#### File Upload Validation
```bash
# Test invalid file type
curl -X POST http://localhost:3001/api/projects/PROJECT_ID/files \
  -H "Authorization: Bearer INCUBATOR_JWT_TOKEN" \
  -F "files=@malicious.exe"

# Expected: File type validation error
```

### Authorization Error Testing

#### Insufficient Permissions
```bash
# Incubator trying to create team
curl -X POST http://localhost:3001/api/teams \
  -H "Authorization: Bearer INCUBATOR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"team_name":"Unauthorized Team","credentials":{"email":"test@test.com","password":"pass123"}}'

# Expected Response:
{
  "success": false,
  "code": "INSUFFICIENT_PERMISSIONS",
  "message": "You do not have permission to perform this action"
}
```

#### Resource Not Found
```bash
# Access non-existent resource
curl -X GET http://localhost:3001/api/teams/non-existent-id \
  -H "Authorization: Bearer DIRECTOR_JWT_TOKEN"

# Expected Response:
{
  "success": false,
  "code": "NOT_FOUND",
  "message": "Team not found"
}
```

### Rate Limiting Testing

#### API Rate Limiting
```bash
# Make rapid requests to trigger rate limiting
for i in {1..101}; do
  curl -X GET http://localhost:3001/api/teams \
    -H "Authorization: Bearer DIRECTOR_JWT_TOKEN"
done

# Expected: 429 Too Many Requests after 100 requests
```

#### Authentication Rate Limiting
```bash
# Rapid login attempts
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"director@university.edu","password":"wrong"}'
done

# Expected: 429 after 5 attempts
```

---

## ⚡ Performance Testing

### Response Time Testing

#### Baseline Performance
```bash
# Test response times for key endpoints
curl -X GET http://localhost:3001/api/dashboard/analytics \
  -H "Authorization: Bearer DIRECTOR_JWT_TOKEN" \
  -w "@curl-format.txt"

# Expected: < 200ms response time
```

#### Concurrent User Testing
```bash
# Simulate multiple concurrent users
ab -n 1000 -c 10 -H "Authorization: Bearer DIRECTOR_JWT_TOKEN" \
  http://localhost:3001/api/teams
```

### Load Testing Scenarios

#### Database Load Testing
```bash
# Test with large dataset
# Create 100 teams, 500 projects, 1000 users
# Measure query performance
```

#### File Upload Load Testing
```bash
# Test multiple file uploads simultaneously
# Measure upload throughput and error rates
```

---

## 🔒 Security Testing

### Input Sanitization Testing

#### XSS Prevention
```bash
# Test script injection
curl -X POST http://localhost:3001/api/teams \
  -H "Authorization: Bearer MANAGER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "team_name": "<script>alert(\"XSS\")</script>Team",
    "company_name": "Test Company",
    "credentials": {
      "email": "test@test.com",
      "password": "password123"
    }
  }'

# Expected: Script tags removed from stored data
```

#### SQL Injection Prevention
```bash
# Test SQL injection attempts
curl -X GET "http://localhost:3001/api/teams?search=1' OR '1'='1" \
  -H "Authorization: Bearer DIRECTOR_JWT_TOKEN"

# Expected: No SQL injection, safe query execution
```

### Authentication Security Testing

#### JWT Token Security
```bash
# Test token tampering
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer tampered.jwt.token"

# Expected: Invalid token error
```

#### Session Management
```bash
# Test token expiration
# Wait for token to expire, then make request
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer EXPIRED_JWT_TOKEN"

# Expected: Token expired error
```

---

## 🤖 Automated Testing with Newman

### Newman Setup

```bash
# Install Newman globally
npm install -g newman

# Run Postman collection
newman run postman_collection.json \
  --environment test_environment.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

### CI/CD Integration

```yaml
# .github/workflows/api-tests.yml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run database migrations
        run: npm run db:push
      - name: Start server
        run: npm run dev &
      - name: Wait for server
        run: sleep 10
      - name: Run API tests
        run: newman run postman_collection.json --environment test_environment.json
```

---

## ✅ Testing Checklist

### Pre-Testing Setup
- [ ] MySQL database running with test data
- [ ] Backend server started on port 3001
- [ ] Postman collection imported
- [ ] Environment variables configured
- [ ] Test users created in database

### Authentication Testing
- [ ] Valid login for all roles
- [ ] Invalid login scenarios
- [ ] Token validation and expiration
- [ ] Rate limiting for auth endpoints
- [ ] Logout functionality

### Team Management Testing
- [ ] Team CRUD operations (Create, Read, Update, Delete)
- [ ] Role-based access control
- [ ] Team member management
- [ ] Search and filtering
- [ ] Validation error handling

### Project Management Testing
- [ ] Project CRUD operations
- [ ] File upload functionality
- [ ] Progress tracking
- [ ] Category classification
- [ ] Access permissions

### Mentor Management Testing
- [ ] Mentor CRUD operations
- [ ] Team assignment functionality
- [ ] Expertise tracking
- [ ] Contact information management

### Inventory Management Testing
- [ ] Inventory item management
- [ ] Team assignment system
- [ ] Stock level tracking
- [ ] Assignment/unassignment operations

### Material Request Testing
- [ ] Request creation and submission
- [ ] Approval/decline workflow
- [ ] Status tracking
- [ ] Permission-based access

### Messaging System Testing
- [ ] Conversation creation
- [ ] Message sending and receiving
- [ ] File message support
- [ ] Real-time delivery (Socket.io)

### Notification System Testing
- [ ] Notification creation
- [ ] Read/unread status
- [ ] Role-based targeting
- [ ] Real-time delivery

### Announcement System Testing
- [ ] Announcement CRUD operations
- [ ] Public access verification
- [ ] Author permissions
- [ ] Content management

### Reports & Analytics Testing
- [ ] Team reports generation
- [ ] Project status reports
- [ ] Inventory usage reports
- [ ] Dashboard analytics
- [ ] PDF export functionality

### Error Handling Testing
- [ ] Validation error responses
- [ ] Authentication failures
- [ ] Authorization denials
- [ ] Resource not found errors
- [ ] Server error handling

### Security Testing
- [ ] Input sanitization
- [ ] XSS prevention
- [ ] SQL injection protection
- [ ] Rate limiting effectiveness
- [ ] File upload security

### Performance Testing
- [ ] Response time validation (< 200ms)
- [ ] Concurrent user handling
- [ ] Database query optimization
- [ ] File upload performance
- [ ] Memory usage monitoring

### Integration Testing
- [ ] End-to-end workflows
- [ ] Cross-service communication
- [ ] Database relationships
- [ ] Real-time features
- [ ] File management integration

---

## 📊 Test Results Summary

### Test Execution Command
```bash
# Run all tests
npm test

# Run integration tests only
npm run test -- --testPathPattern=integration

# Run with coverage
npm run test:coverage

# Run Newman API tests
newman run postman_collection.json --environment test_environment.json
```

### Expected Test Results
- **Unit Tests**: 95%+ code coverage
- **Integration Tests**: All endpoints tested with role-based scenarios
- **API Tests**: 100% endpoint coverage with error scenarios
- **Performance Tests**: < 200ms average response time
- **Security Tests**: Zero security vulnerabilities

### Reporting
- Generate coverage reports: `npm run test:coverage`
- Export Newman results: `--reporter-json-export results.json`
- Monitor performance metrics during testing
- Document any issues found during testing

---

**🎯 API Testing Complete - Ready for Production Deployment!**

*This comprehensive testing guide ensures all API endpoints are thoroughly tested with proper security, performance, and functionality validation.*