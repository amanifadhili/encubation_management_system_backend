import { Router } from 'express';
import { MaintenanceController } from '../controllers/maintenanceController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/maintenance
 * @desc Get all maintenance logs
 * @access Private (Director, Manager)
 */
router.get('/', AuthMiddleware.authenticate, requireManager, MaintenanceController.getAllMaintenanceLogs);

/**
 * @route GET /api/maintenance/upcoming
 * @desc Get upcoming maintenance (items needing maintenance soon)
 * @access Private (Director, Manager)
 */
router.get('/upcoming', AuthMiddleware.authenticate, requireManager, MaintenanceController.getUpcomingMaintenance);

/**
 * @route POST /api/maintenance
 * @desc Create new maintenance log
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, MaintenanceController.createMaintenanceLog);

/**
 * @route GET /api/maintenance/:id
 * @desc Get maintenance log details
 * @access Private (Director, Manager)
 */
router.get('/:id', AuthMiddleware.authenticate, requireManager, MaintenanceController.getMaintenanceLogById);

/**
 * @route PUT /api/maintenance/:id
 * @desc Update maintenance log
 * @access Private (Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireManager, MaintenanceController.updateMaintenanceLog);

/**
 * @route DELETE /api/maintenance/:id
 * @desc Delete maintenance log
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, MaintenanceController.deleteMaintenanceLog);

/**
 * @route GET /api/maintenance/due
 * @desc Get items due for maintenance
 * @access Private (All authenticated users)
 */
router.get('/due', AuthMiddleware.authenticate, MaintenanceController.getItemsDueForMaintenance);

/**
 * @route POST /api/maintenance/auto-schedule
 * @desc Auto-schedule next maintenance for items with maintenance intervals
 * @access Private (Manager/Director only)
 */
router.post('/auto-schedule', AuthMiddleware.authenticate, requireManager, MaintenanceController.autoScheduleMaintenance);

export default router;
