import { Router } from 'express';
import { LocationController } from '../controllers/locationController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/locations
 * @desc Get all storage locations
 * @access Private (Director, Manager)
 */
router.get('/', AuthMiddleware.authenticate, requireManager, LocationController.getAllLocations);

/**
 * @route GET /api/locations/hierarchy
 * @desc Get location hierarchy (tree structure)
 * @access Private (Director, Manager)
 */
router.get('/hierarchy', AuthMiddleware.authenticate, requireManager, LocationController.getLocationHierarchy);

/**
 * @route POST /api/locations
 * @desc Create new storage location
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, LocationController.createLocation);

/**
 * @route GET /api/locations/:id
 * @desc Get storage location details
 * @access Private (Director, Manager)
 */
router.get('/:id', AuthMiddleware.authenticate, requireManager, LocationController.getLocationById);

/**
 * @route PUT /api/locations/:id
 * @desc Update storage location
 * @access Private (Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireManager, LocationController.updateLocation);

/**
 * @route DELETE /api/locations/:id
 * @desc Delete storage location
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, LocationController.deleteLocation);

export default router;
