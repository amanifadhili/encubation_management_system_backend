import { Router } from 'express';
import { ConsumptionController } from '../controllers/consumptionController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/consumption
 * @desc Get all consumption logs
 * @access Private (Director, Manager)
 */
router.get('/', AuthMiddleware.authenticate, requireManager, ConsumptionController.getAllConsumptionLogs);

/**
 * @route POST /api/consumption
 * @desc Create new consumption log
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, ConsumptionController.createConsumptionLog);

/**
 * @route GET /api/consumption/stats/:item_id
 * @desc Get consumption statistics for an item
 * @access Private (Director, Manager)
 */
router.get('/stats/:item_id', AuthMiddleware.authenticate, requireManager, ConsumptionController.getItemConsumptionStats);

/**
 * @route GET /api/consumption/:id
 * @desc Get consumption log details
 * @access Private (Director, Manager)
 */
router.get('/:id', AuthMiddleware.authenticate, requireManager, ConsumptionController.getConsumptionLogById);

/**
 * @route PUT /api/consumption/:id
 * @desc Update consumption log
 * @access Private (Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireManager, ConsumptionController.updateConsumptionLog);

/**
 * @route DELETE /api/consumption/:id
 * @desc Delete consumption log
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, ConsumptionController.deleteConsumptionLog);

export default router;
