import { Router } from 'express';
import { ReportsController } from '../controllers/reportsController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

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
 * @route GET /api/reports/company/:id
 * @desc Detailed company report (team + members + projects/files)
 * @access Private (Director, Manager; mentors/incubators limited to their scope)
 */
router.get('/company/:id', AuthMiddleware.authenticate, ReportsController.getCompanyReport);

/**
 * @route POST /api/reports/export
 * @desc Export reports as data for PDF generation
 * @access Private (Director, Manager)
 */
router.post('/export', AuthMiddleware.authenticate, ReportsController.exportReport);

/**
 * @route GET /api/reports/usage-analytics
 * @desc Get usage analytics: Most used items, utilization rates
 * @access Private (Director, Manager)
 */
router.get('/usage-analytics', AuthMiddleware.authenticate, ReportsController.getUsageAnalytics);

/**
 * @route GET /api/reports/assignment-trends
 * @desc Get assignment trends: Assignment patterns over time
 * @access Private (Director, Manager)
 */
router.get('/assignment-trends', AuthMiddleware.authenticate, ReportsController.getAssignmentTrends);

/**
 * @route GET /api/reports/low-stock-alerts
 * @desc Get low stock alerts
 * @access Private (Director, Manager)
 */
router.get('/low-stock-alerts', AuthMiddleware.authenticate, ReportsController.getLowStockAlerts);

/**
 * @route GET /api/reports/utilization
 * @desc Get utilization reports: Item usage efficiency
 * @access Private (Director, Manager)
 */
router.get('/utilization', AuthMiddleware.authenticate, ReportsController.getUtilizationReports);

/**
 * @route GET /api/reports/consumption
 * @desc Get consumption reports: Track refreshments and consumables usage
 * @access Private (Director, Manager)
 */
router.get('/consumption', AuthMiddleware.authenticate, ReportsController.getConsumptionReports);

/**
 * @route GET /api/reports/distribution
 * @desc Get distribution reports: Who received what and when
 * @access Private (Director, Manager)
 */
router.get('/distribution', AuthMiddleware.authenticate, ReportsController.getDistributionReports);

/**
 * @route GET /api/reports/replenishment-forecasting
 * @desc Get replenishment forecasting: Predict when to reorder based on consumption patterns
 * @access Private (Director, Manager)
 */
router.get('/replenishment-forecasting', AuthMiddleware.authenticate, ReportsController.getReplenishmentForecasting);

/**
 * @route GET /api/reports/usage-patterns
 * @desc Get usage pattern analysis: Time-series consumption patterns
 * @access Private (Director, Manager)
 */
router.get('/usage-patterns', AuthMiddleware.authenticate, ReportsController.getUsagePatternAnalysis);

/**
 * @route POST /api/reports/auto-replenishment
 * @desc Auto-create replenishment requests for low stock items
 * @access Private (Director, Manager)
 */
router.post('/auto-replenishment', AuthMiddleware.authenticate, requireManager, ReportsController.autoCreateReplenishmentRequests);

/**
 * @route GET /api/reports/request-analytics
 * @desc Get request analytics: Request patterns, approval times, trends
 * @access Private (Director, Manager)
 */
router.get('/request-analytics', AuthMiddleware.authenticate, ReportsController.getRequestAnalytics);

/**
 * @route GET /api/reports/comprehensive-usage
 * @desc Get comprehensive usage analytics combining inventory, requests, and consumption
 * @access Private (Director, Manager)
 */
router.get('/comprehensive-usage', AuthMiddleware.authenticate, ReportsController.getComprehensiveUsageAnalytics);

export default router;