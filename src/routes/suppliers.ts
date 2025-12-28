import { Router } from 'express';
import { SupplierController } from '../controllers/supplierController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/suppliers
 * @desc Get all suppliers
 * @access Private (Director, Manager)
 */
router.get('/', AuthMiddleware.authenticate, requireManager, SupplierController.getAllSuppliers);

/**
 * @route POST /api/suppliers
 * @desc Create new supplier
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, SupplierController.createSupplier);

/**
 * @route GET /api/suppliers/:id
 * @desc Get supplier details
 * @access Private (Director, Manager)
 */
router.get('/:id', AuthMiddleware.authenticate, requireManager, SupplierController.getSupplierById);

/**
 * @route PUT /api/suppliers/:id
 * @desc Update supplier
 * @access Private (Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireManager, SupplierController.updateSupplier);

/**
 * @route DELETE /api/suppliers/:id
 * @desc Delete supplier
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, SupplierController.deleteSupplier);

export default router;
