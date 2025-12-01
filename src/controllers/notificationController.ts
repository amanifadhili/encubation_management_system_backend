import { Request, Response } from 'express';
import { Notification } from '@prisma/client';
import prisma from '../config/database';
import { emitToUser, emitToRole } from '../services/socketService';

interface CreateNotificationRequest {
  title: string;
  message: string;
  recipient_type: 'user' | 'team';
  recipient_id: string;
}

interface UpdateNotificationRequest {
  title?: string;
  message?: string;
}

interface NotificationResponse {
  success: boolean;
  message: string;
  data?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class NotificationController {
  /**
   * Get all notifications for the authenticated user
   */
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, read_status } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {
        recipient_type: 'user',
        recipient_id: req.user!.userId
      };

      // Add read status filter if provided
      if (read_status !== undefined) {
        where.read_status = read_status === 'true';
      }

      // Get notifications
      const notifications = await prisma.notification.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      });

      // Get total count
      const total = await prisma.notification.count({ where });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Notifications retrieved successfully',
        data: { notifications },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as NotificationResponse);

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Get sent notifications (for managers/directors)
   */
  static async getSentNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Get notifications sent by current user
      const notifications = await prisma.notification.findMany({
        where: {
          sender_id: req.user!.userId
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      });

      // Get total count
      const total = await prisma.notification.count({
        where: {
          sender_id: req.user!.userId
        }
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Sent notifications retrieved successfully',
        data: { notifications },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as NotificationResponse);

    } catch (error) {
      console.error('Get sent notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Create a new notification
   */
  static async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const { title, message, recipient_type, recipient_id }: CreateNotificationRequest = req.body;

      // Validate required fields
      if (!title || !message || !recipient_type) {
        res.status(400).json({
          success: false,
          message: 'Title, message, and recipient_type are required'
        } as NotificationResponse);
        return;
      }

      // Validate recipient_type
      if (!['user', 'team'].includes(recipient_type)) {
        res.status(400).json({
          success: false,
          message: 'Invalid recipient_type. Must be user or team'
        } as NotificationResponse);
        return;
      }

      // Check permissions based on recipient_type
      if (!NotificationController.canSendNotification(req.user!, recipient_type)) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to send this type of notification'
        } as NotificationResponse);
        return;
      }

      // Validate recipient exists
      const exists = await NotificationController.validateRecipient(recipient_type, recipient_id);
      if (!exists) {
        res.status(400).json({
          success: false,
          message: `${recipient_type} not found`
        } as NotificationResponse);
        return;
      }

      // Create notification
      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          sender_id: req.user!.userId,
          recipient_type,
          recipient_id
        }
      });

      // Send real-time notifications
      await NotificationController.sendRealTimeNotifications(notification);

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: { notification }
      } as NotificationResponse);

    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Get notification details
   */
  static async getNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        } as NotificationResponse);
        return;
      }

      // Check if user can access this notification
      if (!NotificationController.canAccessNotification(req.user!, notification)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as NotificationResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Notification retrieved successfully',
        data: { notification }
      } as NotificationResponse);

    } catch (error) {
      console.error('Get notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Update notification read status
   */
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id }
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        } as NotificationResponse);
        return;
      }

      // Check if user can update this notification
      if (!NotificationController.canAccessNotification(req.user!, notification)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as NotificationResponse);
        return;
      }

      // Update read status
      const updatedNotification = await prisma.notification.update({
        where: { id },
        data: { read_status: true },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Notification marked as read',
        data: { notification: updatedNotification }
      } as NotificationResponse);

    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Update notification (sender only)
   */
  static async updateNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, message }: UpdateNotificationRequest = req.body;

      const notification = await prisma.notification.findUnique({
        where: { id }
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        } as NotificationResponse);
        return;
      }

      // Only sender can update
      if (notification.sender_id !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'Only the sender can update this notification'
        } as NotificationResponse);
        return;
      }

      // Update notification
      const updatedNotification = await prisma.notification.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(message && { message })
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Notification updated successfully',
        data: { notification: updatedNotification }
      } as NotificationResponse);

    } catch (error) {
      console.error('Update notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Delete notification (sender only)
   */
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id }
      });

      if (!notification) {
        res.status(404).json({
          success: false,
          message: 'Notification not found'
        } as NotificationResponse);
        return;
      }

      // Only sender can delete
      if (notification.sender_id !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'Only the sender can delete this notification'
        } as NotificationResponse);
        return;
      }

      // Delete notification
      await prisma.notification.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      } as NotificationResponse);

    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      // Get counts for current user
      const [totalReceived, unreadCount, totalSent] = await Promise.all([
        prisma.notification.count({
          where: {
            recipient_type: 'user',
            recipient_id: req.user!.userId
          }
        }),
        prisma.notification.count({
          where: {
            recipient_type: 'user',
            recipient_id: req.user!.userId,
            read_status: false
          }
        }),
        prisma.notification.count({
          where: {
            sender_id: req.user!.userId
          }
        })
      ]);

      res.json({
        success: true,
        message: 'Notification statistics retrieved successfully',
        data: {
          stats: {
            total_received: totalReceived,
            unread_count: unreadCount,
            total_sent: totalSent
          }
        }
      } as NotificationResponse);

    } catch (error) {
      console.error('Get notification stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as NotificationResponse);
    }
  }

  /**
   * Helper method to check if user can send notification of given type
   */
  private static canSendNotification(user: any, recipientType: string): boolean {
    switch (user.role) {
      case 'director':
        return true; // Directors can send all types

      case 'manager':
        return ['user', 'team'].includes(recipientType); // Managers can send to users and teams

      case 'mentor':
        return recipientType === 'user'; // Mentors can only send to individual users

      case 'incubator':
        return recipientType === 'user'; // Incubators can only send to individual users

      default:
        return false;
    }
  }

  /**
   * Helper method to validate recipient exists
   */
  private static async validateRecipient(recipientType: string, recipientId: string): Promise<boolean> {
    try {
      if (recipientType === 'user') {
        const user = await prisma.user.findUnique({
          where: { id: recipientId }
        });
        return !!user;
      } else if (recipientType === 'team') {
        const team = await prisma.team.findUnique({
          where: { id: recipientId }
        });
        return !!team;
      }
      return false;
    } catch (error) {
      console.error('Validate recipient error:', error);
      return false;
    }
  }

  /**
   * Helper method to check if user can access notification
   */
  private static canAccessNotification(user: any, notification: Notification): boolean {
    // Sender can always access their own notifications
    if (notification.sender_id === user.userId) {
      return true;
    }

    // For user-specific notifications, only the recipient can access
    if (notification.recipient_type === 'user' && notification.recipient_id === user.userId) {
      return true;
    }

    // For team notifications, check if user is in the team
    if (notification.recipient_type === 'team') {
      // This would need additional logic to check team membership
      // For now, allow managers and directors to see team notifications
      return ['director', 'manager'].includes(user.role);
    }

    return false;
  }

  /**
   * Helper method to send real-time notifications
   */
  private static async sendRealTimeNotifications(notification: Notification): Promise<void> {
    try {
      if (notification.recipient_type === 'user' && notification.recipient_id) {
        // Send to specific user
        emitToUser(notification.recipient_id, 'new_notification', {
          id: notification.id,
          senderId: notification.sender_id,
          title: notification.title,
          message: notification.message,
          readStatus: notification.read_status,
          createdAt: notification.created_at
        });
      } else if (notification.recipient_type === 'team' && notification.recipient_id) {
        // Send to all team members
        const teamMembers = await prisma.teamMember.findMany({
          where: { team_id: notification.recipient_id },
          select: { user_id: true }
        });

        teamMembers.forEach(member => {
          emitToUser(member.user_id, 'new_notification', {
            id: notification.id,
            senderId: notification.sender_id,
            title: notification.title,
            message: notification.message,
            readStatus: notification.read_status,
            createdAt: notification.created_at
          });
        });
      }
    } catch (error) {
      console.error('Send real-time notifications error:', error);
    }
  }
}