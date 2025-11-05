import { Request, Response } from 'express';
import emailService from '../services/emailService';

export class EmailController {
  /**
   * Get email statistics
   * GET /api/email/statistics
   */
  static async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const statistics = await emailService.getEmailStatistics(startDate, endDate);

      res.json({
        success: true,
        message: 'Email statistics retrieved successfully',
        data: statistics
      });
    } catch (error) {
      console.error('Get email statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Verify email service connection
   * GET /api/email/verify
   */
  static async verifyConnection(req: Request, res: Response): Promise<void> {
    try {
      const isConnected = await emailService.verifyConnection();

      res.json({
        success: isConnected,
        message: isConnected ? 'Email service is connected' : 'Email service is not connected',
        data: { connected: isConnected }
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email connection'
      });
    }
  }

  /**
   * Clear template cache
   * POST /api/email/clear-cache
   */
  static async clearCache(req: Request, res: Response): Promise<void> {
    try {
      emailService.clearTemplateCache();

      res.json({
        success: true,
        message: 'Template cache cleared successfully'
      });
    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({
        success: false,
        message: 'Error clearing template cache'
      });
    }
  }

  /**
   * Test email sending with different email types
   * POST /api/email/test
   */
  static async testEmail(req: Request, res: Response): Promise<void> {
    try {
      const { emailType, recipientEmail } = req.body;

      if (!emailType || !recipientEmail) {
        res.status(400).json({
          success: false,
          message: 'emailType and recipientEmail are required'
        });
        return;
      }

      // Sample template data for each email type - matching actual template variables
      const templateDataMap: Record<string, any> = {
        user_created: {
          userName: 'John Doe',
          userEmail: recipientEmail,
          password: 'TempPassword123!',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        user_updated: {
          userName: 'John Doe',
          userEmail: recipientEmail,
          changes: 'Updated role and permissions',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        team_updates: {
          teamName: 'InnovateX Team',
          companyName: 'InnovateX Inc.',
          previousStatus: 'Pending',
          newStatus: 'Active',
          statusColor: '#4CAF50',
          statusMessage: 'Team status has been updated to Active',
          reason: 'Team has completed registration and is ready to start',
          teamId: 'test-team-id',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        project_updates: {
          projectName: 'E-commerce Platform',
          updatedName: 'E-commerce Platform v2',
          updatedStatus: 'Active',
          statusColor: '#4CAF50',
          updatedProgress: 75,
          updateNotes: 'Project status updated to Active',
          projectId: 'test-project-id',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        notifications: {
          notificationTitle: 'New Notification',
          notificationMessage: 'You have a new notification in the system. Please check your notifications panel for more details.',
          senderName: 'System Administrator',
          notificationDate: new Date().toLocaleString(),
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        messages: {
          senderName: 'Jane Smith',
          messageContent: 'Hello! I have a question about the project. Can we schedule a meeting to discuss the progress?',
          messageDate: new Date().toLocaleString(),
          conversationTitle: 'Project Discussion',
          conversationId: 'test-conversation-id',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        announcements: {
          announcementTitle: 'System Maintenance',
          announcementContent: 'The system will be under maintenance on Sunday from 2:00 AM to 4:00 AM. Please save your work before this time.',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        material_requests: {
          requesterName: 'John Doe',
          itemName: 'Laptop',
          description: 'High-performance laptop for development work',
          teamName: 'InnovateX Team',
          requestedDate: new Date().toLocaleDateString(),
          reviewedDate: new Date().toLocaleDateString(),
          reviewerName: 'Manager',
          notes: 'Request approved. Item will be assigned shortly.',
          requestId: 'test-request-id',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
        inventory_updates: {
          itemName: 'Projector',
          itemDescription: 'HD Projector for presentations',
          quantity: 2,
          teamName: 'InnovateX Team',
          companyName: 'InnovateX Inc.',
          assignedDate: new Date().toLocaleDateString(),
          assignedBy: 'Manager',
          appUrl: 'http://localhost:5173',
          currentYear: new Date().getFullYear(),
        },
      };

      // Template mapping - using actual template files that exist
      const templateMap: Record<string, string> = {
        user_created: 'user/user-created',
        user_updated: 'user/user-updated',
        team_updates: 'team/team-status-updated',
        project_updates: 'project/project-updated',
        notifications: 'notification/notification-created', // Using dedicated notification template
        messages: 'message/message-received', // Using dedicated message template
        announcements: 'announcement/announcement-created',
        material_requests: 'request/request-approved',
        inventory_updates: 'inventory/inventory-assigned',
      };

      const template = templateMap[emailType];
      const templateData = templateDataMap[emailType] || {};

      if (!template) {
        res.status(400).json({
          success: false,
          message: `Invalid email type: ${emailType}`
        });
        return;
      }

      // Send test email
      // Note: For test emails, we don't pass userId to bypass email preferences check
      // This ensures test emails are always sent regardless of user preferences
      const result = await emailService.sendEmail({
        to: recipientEmail,
        subject: `Test Email - ${emailType}`,
        template,
        // Don't pass emailType or userId for test emails to bypass preferences
        // emailType: emailType as any, // Commented out to bypass preferences for testing
        templateData,
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Test email sent successfully',
          data: {
            messageId: result.messageId,
            emailType,
            recipientEmail,
            retries: result.retries || 0,
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send test email',
          error: result.error,
          data: {
            emailType,
            recipientEmail,
            retries: result.retries || 0,
          }
        });
      }
    } catch (error: any) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending test email',
        error: error.message || 'Internal server error'
      });
    }
  }
}
