import { Request, Response } from 'express';
import { Announcement } from '@prisma/client';
import prisma from '../config/database';
import { emitToRole } from '../services/socketService';

interface CreateAnnouncementRequest {
  title: string;
  content: string;
}

interface UpdateAnnouncementRequest {
  title?: string;
  content?: string;
}

interface AnnouncementResponse {
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

export class AnnouncementController {
  /**
   * Get all announcements (public access)
   */
  static async getAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Get announcements with author info
      const announcements = await prisma.announcement.findMany({
        include: {
          author: {
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
      const total = await prisma.announcement.count();

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Announcements retrieved successfully',
        data: { announcements },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Get announcements error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Get announcement details (public access)
   */
  static async getAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const announcement = await prisma.announcement.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!announcement) {
        res.status(404).json({
          success: false,
          message: 'Announcement not found'
        } as AnnouncementResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Announcement retrieved successfully',
        data: { announcement }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Get announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Create a new announcement (Director/Manager only)
   */
  static async createAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const { title, content }: CreateAnnouncementRequest = req.body;

      // Validate required fields
      if (!title || !content) {
        res.status(400).json({
          success: false,
          message: 'Title and content are required'
        } as AnnouncementResponse);
        return;
      }

      // Check permissions
      if (!AnnouncementController.canCreateAnnouncement(req.user!.role)) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to create announcements'
        } as AnnouncementResponse);
        return;
      }

      // Create announcement
      const announcement = await prisma.announcement.create({
        data: {
          title,
          content,
          author_id: req.user!.userId
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Send real-time announcement to all users
      await AnnouncementController.broadcastAnnouncement(announcement);

      res.status(201).json({
        success: true,
        message: 'Announcement created successfully',
        data: { announcement }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Create announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Update announcement (author only)
   */
  static async updateAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, content }: UpdateAnnouncementRequest = req.body;

      const announcement = await prisma.announcement.findUnique({
        where: { id }
      });

      if (!announcement) {
        res.status(404).json({
          success: false,
          message: 'Announcement not found'
        } as AnnouncementResponse);
        return;
      }

      // Only author can update
      if (announcement.author_id !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'Only the author can update this announcement'
        } as AnnouncementResponse);
        return;
      }

      // Update announcement
      const updatedAnnouncement = await prisma.announcement.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(content && { content }),
          updated_at: new Date()
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Broadcast update to all users
      await AnnouncementController.broadcastAnnouncementUpdate(updatedAnnouncement);

      res.json({
        success: true,
        message: 'Announcement updated successfully',
        data: { announcement: updatedAnnouncement }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Delete announcement (author only)
   */
  static async deleteAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const announcement = await prisma.announcement.findUnique({
        where: { id }
      });

      if (!announcement) {
        res.status(404).json({
          success: false,
          message: 'Announcement not found'
        } as AnnouncementResponse);
        return;
      }

      // Only author can delete
      if (announcement.author_id !== req.user!.userId) {
        res.status(403).json({
          success: false,
          message: 'Only the author can delete this announcement'
        } as AnnouncementResponse);
        return;
      }

      // Delete announcement
      await prisma.announcement.delete({
        where: { id }
      });

      // Broadcast deletion to all users
      await AnnouncementController.broadcastAnnouncementDeletion(id);

      res.json({
        success: true,
        message: 'Announcement deleted successfully'
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Get announcements by author
   */
  static async getAnnouncementsByAuthor(req: Request, res: Response): Promise<void> {
    try {
      const { authorId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Get announcements by author
      const announcements = await prisma.announcement.findMany({
        where: { author_id: authorId },
        include: {
          author: {
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
      const total = await prisma.announcement.count({
        where: { author_id: authorId }
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Author announcements retrieved successfully',
        data: { announcements },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Get announcements by author error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Get recent announcements (last N announcements)
   */
  static async getRecentAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 5 } = req.query;
      const limitNum = Math.min(parseInt(limit as string, 10), 20); // Max 20

      const announcements = await prisma.announcement.findMany({
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: limitNum
      });

      res.json({
        success: true,
        message: 'Recent announcements retrieved successfully',
        data: { announcements }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Get recent announcements error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Search announcements
   */
  static async searchAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        } as AnnouncementResponse);
        return;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const searchQuery = q.trim();

      // Search in title and content (case-insensitive for MySQL)
      const announcements = await prisma.announcement.findMany({
        where: {
          OR: [
            {
              title: {
                contains: searchQuery
              }
            },
            {
              content: {
                contains: searchQuery
              }
            }
          ]
        },
        include: {
          author: {
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
      const total = await prisma.announcement.count({
        where: {
          OR: [
            {
              title: {
                contains: searchQuery
              }
            },
            {
              content: {
                contains: searchQuery
              }
            }
          ]
        }
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Announcements search completed successfully',
        data: { announcements },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Search announcements error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Get announcement statistics
   */
  static async getAnnouncementStats(req: Request, res: Response): Promise<void> {
    try {
      // Get statistics
      const [totalAnnouncements, myAnnouncements, recentCount] = await Promise.all([
        prisma.announcement.count(),
        req.user ? prisma.announcement.count({
          where: { author_id: req.user.userId }
        }) : Promise.resolve(0),
        prisma.announcement.count({
          where: {
            created_at: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        })
      ]);

      res.json({
        success: true,
        message: 'Announcement statistics retrieved successfully',
        data: {
          stats: {
            total_announcements: totalAnnouncements,
            my_announcements: myAnnouncements,
            recent_announcements: recentCount
          }
        }
      } as AnnouncementResponse);

    } catch (error) {
      console.error('Get announcement stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as AnnouncementResponse);
    }
  }

  /**
   * Helper method to check if user can create announcements
   */
  private static canCreateAnnouncement(role: string): boolean {
    return ['director', 'manager'].includes(role);
  }

  /**
   * Helper method to broadcast new announcement to all users
   */
  private static async broadcastAnnouncement(announcement: Announcement & { author: any }): Promise<void> {
    try {
      // Broadcast to all connected users
      emitToRole('director', 'new_announcement', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        createdAt: announcement.created_at
      });

      emitToRole('manager', 'new_announcement', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        createdAt: announcement.created_at
      });

      emitToRole('mentor', 'new_announcement', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        createdAt: announcement.created_at
      });

      emitToRole('incubator', 'new_announcement', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        createdAt: announcement.created_at
      });

    } catch (error) {
      console.error('Broadcast announcement error:', error);
    }
  }

  /**
   * Helper method to broadcast announcement update to all users
   */
  private static async broadcastAnnouncementUpdate(announcement: Announcement & { author: any }): Promise<void> {
    try {
      // Broadcast update to all connected users
      emitToRole('director', 'announcement_updated', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        updatedAt: announcement.updated_at
      });

      emitToRole('manager', 'announcement_updated', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        updatedAt: announcement.updated_at
      });

      emitToRole('mentor', 'announcement_updated', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        updatedAt: announcement.updated_at
      });

      emitToRole('incubator', 'announcement_updated', {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        author: announcement.author,
        updatedAt: announcement.updated_at
      });

    } catch (error) {
      console.error('Broadcast announcement update error:', error);
    }
  }

  /**
   * Helper method to broadcast announcement deletion to all users
   */
  private static async broadcastAnnouncementDeletion(announcementId: string): Promise<void> {
    try {
      // Broadcast deletion to all connected users
      emitToRole('director', 'announcement_deleted', { id: announcementId });
      emitToRole('manager', 'announcement_deleted', { id: announcementId });
      emitToRole('mentor', 'announcement_deleted', { id: announcementId });
      emitToRole('incubator', 'announcement_deleted', { id: announcementId });

    } catch (error) {
      console.error('Broadcast announcement deletion error:', error);
    }
  }
}