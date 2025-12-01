import { Router } from 'express';
import { InventoryController } from '../controllers/inventoryController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/inventory
 * @desc Get all inventory items
 * @access Private (Director, Manager, Incubator)
 */
router.get('/', AuthMiddleware.authenticate, InventoryController.getAllItems);

/**
 * @route POST /api/inventory
 * @desc Create new inventory item
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, InventoryController.createItem);

/**
 * @route GET /api/inventory/:id
 * @desc Get inventory item details
 * @access Private (Director, Manager, Incubator)
 */
router.get('/:id', AuthMiddleware.authenticate, InventoryController.getItemById);

/**
 * @route PUT /api/inventory/:id
 * @desc Update inventory item
 * @access Private (Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireManager, InventoryController.updateItem);

/**
 * @route DELETE /api/inventory/:id
 * @desc Delete inventory item
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, InventoryController.deleteItem);

/**
 * @route POST /api/inventory/:id/assign
 * @desc Assign inventory item to team
 * @access Private (Manager, Director)
 */
router.post('/:id/assign', AuthMiddleware.authenticate, requireManager, InventoryController.assignToTeam);

/**
 * @route DELETE /api/inventory/:id/assign/:teamId
 * @desc Unassign inventory item from team
 * @access Private (Manager, Director)
 */
router.delete('/:id/assign/:teamId', AuthMiddleware.authenticate, requireManager, InventoryController.unassignFromTeam);

/**
 * @route GET /api/inventory/:id/assignments
 * @desc Get inventory assignments for an item
 * @access Private (Director, Manager)
 */
router.get('/:id/assignments', AuthMiddleware.authenticate, InventoryController.getItemAssignments);

export default router;