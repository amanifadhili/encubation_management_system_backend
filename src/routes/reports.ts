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
 * @route GET /api/reports/advanced
 * @desc Get advanced reports with comprehensive filtering
 * @access Private (Director, Manager)
 */
router.get('/advanced', AuthMiddleware.authenticate, ReportsController.getAdvancedReports);

/**
 * @route GET /api/reports/time-series
 * @desc Get time-series analytics data
 * @access Private (Director, Manager)
 */
router.get('/time-series', AuthMiddleware.authenticate, ReportsController.getTimeSeriesAnalytics);

/**
 * @route GET /api/reports/system-metrics
 * @desc Get comprehensive system-wide metrics
 * @access Private (Director, Manager)
 */
router.get('/system-metrics', AuthMiddleware.authenticate, ReportsController.getSystemMetrics);

/**
 * @route GET /api/reports/cross-entity
 * @desc Get cross-entity analytics and insights
 * @access Private (Director, Manager)
 */
router.get('/cross-entity', AuthMiddleware.authenticate, ReportsController.getCrossEntityAnalytics);

/**
 * @route GET /api/reports/general
 * @desc General combined report (projects/teams/mentors) with CSV/JSON
 * @access Private (Director, Manager; mentors/incubators limited to their scope)
 */
router.get('/general', AuthMiddleware.authenticate, ReportsController.getGeneralReport);

/**
 * @route POST /api/reports/export
 * @desc Export reports as data for PDF generation
 * @access Private (Director, Manager)
 */
router.post('/export', AuthMiddleware.authenticate, ReportsController.exportReport);

export default router;