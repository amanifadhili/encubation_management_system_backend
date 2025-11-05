# 📧 Email System Documentation

## Overview

The Email Notification System is a comprehensive email sending solution integrated into the Incubation Management System. It provides automated email notifications for various system events, user actions, and administrative communications.

## Getting Started

Before running the application with `npm run dev`, you need to set up the project with the following commands:

### Prerequisites

- Node.js 18+ installed
- MySQL 8.0+ installed and running
- npm or yarn package manager

### Setup Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```
   This installs all required packages including email-related dependencies (nodemailer, handlebars, etc.).

2. **Set Up Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and email configuration
   ```
   Make sure to configure the email-related environment variables (see [Configuration](#configuration) section below).

3. **Generate Prisma Client**
   ```bash
   npm run db:generate
   ```
   This generates the Prisma Client based on your schema, including the EmailLog and EmailPreferences models.

4. **Update Database Schema**
   ```bash
   npm run db:push
   ```
   This pushes the database schema to your MySQL database. Alternatively, you can use migrations:
   ```bash
   npm run db:migrate
   ```

5. **Seed Database (Optional)**
   ```bash
   npm run db:seed
   ```
   This populates the database with initial data if you have a seed file configured.

6. **Start Development Server**
   ```bash
   npm run dev
   ```
   The server will start on the configured port (default: 3001).

### Quick Setup Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured (`.env` file)
- [ ] Prisma Client generated (`npm run db:generate`)
- [ ] Database schema updated (`npm run db:push` or `npm run db:migrate`)
- [ ] Database seeded (optional, `npm run db:seed`)
- [ ] Email service enabled in `.env` (`EMAIL_ENABLED=true`)
- [ ] Gmail credentials configured (see [Gmail Setup](#gmail-setup))
- [ ] Development server started (`npm run dev`)

### Troubleshooting Setup Issues

- **Prisma Client errors**: Run `npm run db:generate` again
- **Database connection errors**: Verify MySQL is running and credentials in `.env` are correct
- **Email service disabled**: Check `EMAIL_ENABLED=true` in `.env`
- **Email authentication errors**: Ensure you're using a Gmail app-specific password (see [Gmail Setup](#gmail-setup))

## Features

- ✅ **Gmail SMTP Integration**: Secure email sending via Gmail SMTP
- ✅ **Template Engine**: Handlebars-based email templates with layouts
- ✅ **Retry Logic**: Automatic retry with exponential backoff
- ✅ **Connection Pooling**: Optimized connection management
- ✅ **Bulk Sending**: Efficient batch processing for bulk emails
- ✅ **Email Preferences**: User-controlled email notification preferences
- ✅ **Email Logging**: Comprehensive logging and statistics
- ✅ **Template Caching**: Performance-optimized template rendering
- ✅ **Rate Limiting**: Respects SMTP server rate limits

## Configuration

### Environment Variables

#### Required Variables

```env
# Enable/disable email service
EMAIL_ENABLED=true

# SMTP Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false

# SMTP Credentials
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Sender Information
EMAIL_FROM_NAME=Incubation Management System
EMAIL_FROM_ADDRESS=your-email@gmail.com
```

#### Optional Optimization Variables

```env
# Retry Configuration
EMAIL_MAX_RETRIES=3
EMAIL_RETRY_INITIAL_DELAY=1000
EMAIL_RETRY_MAX_DELAY=10000
EMAIL_RETRY_BACKOFF=2

# Performance Configuration
EMAIL_POOL_SIZE=3
EMAIL_BATCH_SIZE=10
EMAIL_RATE_LIMIT_DELAY=100
```

### Gmail Setup

1. **Enable 2-Factor Authentication**
   - Go to your Google Account settings
   - Navigate to Security
   - Enable 2-Step Verification

2. **Generate App-Specific Password**
   - In Security settings, find "App passwords"
   - Generate a new app password for "Mail"
   - Use this password in `EMAIL_PASSWORD` (not your regular Gmail password)

3. **Verify Configuration**
   ```bash
   # Test email connection
   curl -X GET http://localhost:3001/api/email/verify \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## API Endpoints

### Email Statistics
```http
GET /api/email/statistics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Email statistics retrieved successfully",
  "data": {
    "total": 150,
    "sent": 140,
    "failed": 10,
    "pending": 0,
    "successRate": 93.33
  }
}
```

### Verify Connection
```http
GET /api/email/verify
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Email service is connected",
  "data": {
    "connected": true
  }
}
```

### Clear Template Cache
```http
POST /api/email/clear-cache
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Template cache cleared successfully"
}
```

## Usage Examples

### Sending a Simple Email

```typescript
import emailService from '../services/emailService';

const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<p>Welcome to our system!</p>',
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

### Sending Email with Template

```typescript
const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to Incubation Management System',
  template: 'user/user-created',
  emailType: 'user_created',
  userId: 'user-id-123',
  templateData: {
    userName: 'John Doe',
    userEmail: 'john@example.com',
    password: 'temp123',
    appUrl: 'http://localhost:3000',
    currentYear: 2024,
  },
});
```

### Sending Bulk Emails

```typescript
const emails: EmailOptions[] = [
  {
    to: 'user1@example.com',
    subject: 'Announcement',
    template: 'announcement/announcement-created',
    emailType: 'announcements',
    templateData: { /* ... */ },
  },
  {
    to: 'user2@example.com',
    subject: 'Announcement',
    template: 'announcement/announcement-created',
    emailType: 'announcements',
    templateData: { /* ... */ },
  },
];

const results = await emailService.sendBulkEmail(emails);
console.log(`Sent: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
```

### Getting Email Statistics

```typescript
const stats = await emailService.getEmailStatistics(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

console.log(`Total: ${stats.total}`);
console.log(`Sent: ${stats.sent}`);
console.log(`Success Rate: ${stats.successRate}%`);
```

## Email Templates

### Template Structure

Templates are located in `templates/emails/` and use Handlebars syntax.

**Example Template: `user/user-created.hbs`**
```handlebars
{{!< layouts/main}}

<h1>Welcome {{userName}}!</h1>
<p>Your account has been created with email: {{userEmail}}</p>
<p>Your temporary password is: <strong>{{password}}</strong></p>
<p>Please log in and change your password: <a href="{{appUrl}}/login">{{appUrl}}/login</a></p>
```

**Layout Template: `layouts/main.hbs`**
```handlebars
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{subject}}</title>
</head>
<body>
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    {{{body}}}
    <footer style="margin-top: 40px; text-align: center; color: #666;">
      <p>&copy; {{currentYear}} Incubation Management System</p>
    </footer>
  </div>
</body>
</html>
```

### Available Templates

- `user/user-created.hbs` - User account creation
- `user/user-updated.hbs` - User account update
- `team/team-created.hbs` - Team creation
- `team/team-status-updated.hbs` - Team status change
- `team/member-added.hbs` - Team member added
- `project/project-created.hbs` - Project creation
- `project/project-updated.hbs` - Project update
- `request/request-created.hbs` - Material request created
- `request/request-approved.hbs` - Request approved
- `request/request-declined.hbs` - Request declined
- `inventory/inventory-assigned.hbs` - Inventory assignment
- `announcement/announcement-created.hbs` - New announcement

## Email Types

The system supports the following email types for preference management:

- `user_created` - User account created
- `user_updated` - User account updated
- `team_updates` - Team-related updates
- `project_updates` - Project-related updates
- `notifications` - System notifications
- `messages` - Direct messages
- `announcements` - System announcements
- `material_requests` - Material request updates
- `inventory_updates` - Inventory assignment updates

## Retry Logic

The email service implements automatic retry with exponential backoff:

- **Default Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Max Delay**: 10 seconds
- **Backoff Multiplier**: 2x

**Example Retry Sequence:**
- Attempt 1: Immediate
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds (if configured)

**Non-Retryable Errors:**
- Authentication errors (EAUTH)
- Envelope errors (EENVELOPE)

## Performance Optimization

### Connection Pooling

The service maintains a pool of SMTP connections for better performance:

- **Pool Size**: Configurable (default: 3)
- **Connection Reuse**: Reduces connection overhead
- **Round-Robin**: Distributes load across connections

### Template Caching

Templates are compiled and cached in memory:

- **First Request**: Template is read, compiled, and cached
- **Subsequent Requests**: Uses cached compiled template
- **Cache Clear**: Use `/api/email/clear-cache` endpoint or `clearTemplateCache()`

### Batch Processing

Bulk emails are processed in batches:

- **Batch Size**: Configurable (default: 10)
- **Parallel Processing**: Emails in a batch are sent in parallel
- **Rate Limiting**: Configurable delay between emails (default: 100ms)

## Error Handling

### Common Errors

**Email Service Disabled**
```json
{
  "success": false,
  "error": "Email service is disabled or not configured"
}
```

**Authentication Failed**
```json
{
  "success": false,
  "error": "Invalid login: 535-5.7.8 Username and Password not accepted"
}
```

**Template Not Found**
```json
{
  "success": false,
  "error": "Template not found: user/nonexistent"
}
```

### Error Logging

All email operations are logged to the `email_logs` table:

- **Status**: PENDING, SENT, or FAILED
- **Error Message**: Detailed error information
- **Timestamp**: Creation and sent timestamps

## Email Preferences

Users can manage their email preferences via:

- **Frontend UI**: `/email-preferences`
- **API Endpoints**: `/api/email-preferences`

The email service automatically respects user preferences before sending emails.

## Testing

### Unit Tests

```bash
npm test -- emailService.test.ts
```

### Integration Tests

```bash
# Set test email credentials
export EMAIL_ENABLED=true
export EMAIL_USER=test@gmail.com
export EMAIL_PASSWORD=test-app-password

npm test -- emailService.integration.test.ts
```

### Manual Testing

```bash
# Send test email via API
curl -X POST http://localhost:3001/api/test/send-email \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test email</p>"
  }'
```

## Troubleshooting

### Emails Not Sending

1. **Check Service Status**
   ```bash
   curl http://localhost:3001/api/email/verify
   ```

2. **Check Email Logs**
   ```sql
   SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;
   ```

3. **Verify Gmail Credentials**
   - Ensure using app-specific password
   - Check 2FA is enabled
   - Verify credentials in `.env`

### Template Rendering Errors

1. **Clear Template Cache**
   ```bash
   curl -X POST http://localhost:3001/api/email/clear-cache
   ```

2. **Check Template Syntax**
   - Verify Handlebars syntax
   - Check template file exists
   - Validate template variables

### Performance Issues

1. **Adjust Pool Size**
   ```env
   EMAIL_POOL_SIZE=5
   ```

2. **Increase Batch Size**
   ```env
   EMAIL_BATCH_SIZE=20
   ```

3. **Monitor Statistics**
   ```bash
   curl http://localhost:3001/api/email/statistics
   ```

## Best Practices

1. **Use Templates**: Always use templates instead of raw HTML
2. **Set Email Types**: Always specify `emailType` for preference checking
3. **Handle Errors**: Always check `result.success` before proceeding
4. **Log Failures**: Monitor email logs for failed sends
5. **Respect Preferences**: System automatically respects user preferences
6. **Batch Large Sends**: Use `sendBulkEmail` for multiple recipients
7. **Monitor Statistics**: Regularly check email statistics for issues

## Security Considerations

1. **App-Specific Passwords**: Never use regular Gmail passwords
2. **Environment Variables**: Never commit credentials to version control
3. **Rate Limiting**: Respect Gmail's sending limits (500/day for free accounts)
4. **Input Validation**: Always validate email addresses before sending
5. **Template Security**: Sanitize user input in templates to prevent XSS

## Support

For issues or questions:
- Check email logs in database
- Review error messages in API responses
- Verify configuration in `.env` file
- Test connection with `/api/email/verify` endpoint
