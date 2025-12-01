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

}
