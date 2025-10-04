import { Router } from 'express';
import { ReportsController } from '../controllers/reportsController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/reports/teams
 * @desc Get team assignment reports
 * @access Private (Director, Manager)
 */
router.get('/teams', AuthMiddleware.authenticate, ReportsController.getTeamReports);

/**
 * @route GET /api/reports/inventory
 * @desc Get inventory reports
 * @access Private (Director, Manager)
 */
router.get('/inventory', AuthMiddleware.authenticate, ReportsController.getInventoryReports);

/**
 * @route GET /api/reports/projects
 * @desc Get project reports
 * @access Private (Director, Manager, Mentor)
 */
router.get('/projects', AuthMiddleware.authenticate, ReportsController.getProjectReports);

/**
 * @route GET /api/dashboard/analytics
 * @desc Get dashboard analytics data
 * @access Private (All roles)
 */
router.get('/dashboard/analytics', AuthMiddleware.authenticate, ReportsController.getDashboardAnalytics);

/**
 * @route POST /api/reports/export
 * @desc Export reports as data for PDF generation
 * @access Private (Director, Manager)
 */
router.post('/export', AuthMiddleware.authenticate, ReportsController.exportReport);

export default router;