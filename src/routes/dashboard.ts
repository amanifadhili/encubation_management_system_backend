import { Router } from 'express';
import { ReportsController } from '../controllers/reportsController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/dashboard/analytics
 * @desc Get dashboard analytics data
 * @access Private (All roles)
 */
router.get('/analytics', AuthMiddleware.authenticate, ReportsController.getDashboardAnalytics);

export default router;