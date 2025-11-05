import { Request, Response } from 'express';
import prisma from '../config/database';

interface UpdateEmailPreferencesRequest {
  user_created?: boolean;
  user_updated?: boolean;
  team_updates?: boolean;
  project_updates?: boolean;
  notifications?: boolean;
  messages?: boolean;
  announcements?: boolean;
  material_requests?: boolean;
  inventory_updates?: boolean;
}

interface EmailPreferencesResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class EmailPreferencesController {
  /**
   * Get user's email preferences
   * GET /api/email-preferences
   */
  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      // Get or create default preferences
      let preferences = await prisma.emailPreferences.findUnique({
        where: { user_id: userId }
      });

      // If no preferences exist, create default ones
      if (!preferences) {
        preferences = await prisma.emailPreferences.create({
          data: {
            user_id: userId
          }
        });
      }

      res.json({
        success: true,
        message: 'Email preferences retrieved successfully',
        data: { preferences }
      } as EmailPreferencesResponse);
    } catch (error) {
      console.error('Get email preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as EmailPreferencesResponse);
    }
  }

  /**
   * Update user's email preferences
   * PUT /api/email-preferences
   */
  static async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updateData: UpdateEmailPreferencesRequest = req.body;

      // Check if preferences exist
      const existingPreferences = await prisma.emailPreferences.findUnique({
        where: { user_id: userId }
      });

      let preferences;

      if (existingPreferences) {
        // Update existing preferences
        preferences = await prisma.emailPreferences.update({
          where: { user_id: userId },
          data: updateData
        });
      } else {
        // Create new preferences with provided data
        preferences = await prisma.emailPreferences.create({
          data: {
            user_id: userId,
            ...updateData
          }
        });
      }

      res.json({
        success: true,
        message: 'Email preferences updated successfully',
        data: { preferences }
      } as EmailPreferencesResponse);
    } catch (error) {
      console.error('Update email preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as EmailPreferencesResponse);
    }
  }

  /**
   * Get email preference for a specific email type
   * Helper method for checking if user wants to receive specific email types
   */
  static async shouldSendEmail(
    userId: string,
    emailType: 'user_created' | 'user_updated' | 'team_updates' | 'project_updates' | 'notifications' | 'messages' | 'announcements' | 'material_requests' | 'inventory_updates'
  ): Promise<boolean> {
    try {
      const preferences = await prisma.emailPreferences.findUnique({
        where: { user_id: userId }
      });

      // If no preferences exist, use defaults
      if (!preferences) {
        const defaults: Record<string, boolean> = {
          user_created: true,
          user_updated: true,
          team_updates: true,
          project_updates: true,
          notifications: false,
          messages: false,
          announcements: true,
          material_requests: true,
          inventory_updates: true
        };
        return defaults[emailType] ?? true;
      }

      return preferences[emailType] ?? true;
    } catch (error) {
      console.error('Error checking email preference:', error);
      // Default to true if there's an error
      return true;
    }
  }
}
