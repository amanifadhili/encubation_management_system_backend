import { Router } from 'express';
import { RequestController } from '../controllers/requestController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/requests
 * @desc Get all material requests
 * @access Private (Director, Manager, Incubator)
 */
router.get('/', AuthMiddleware.authenticate, RequestController.getAllRequests);

/**
 * @route POST /api/requests
 * @desc Create new material request
 * @access Private (Incubator team leader only)
 */
router.post('/', AuthMiddleware.authenticate, RequestController.createRequest);

/**
 * @route GET /api/requests/:id
 * @desc Get material request details
 * @access Private (Role-based access)
 */
router.get('/:id', AuthMiddleware.authenticate, RequestController.getRequestById);

/**
 * @route PUT /api/requests/:id/status
 * @desc Update request status (approve/decline)
 * @access Private (Manager, Director)
 */
router.put('/:id/status', AuthMiddleware.authenticate, requireManager, RequestController.updateRequestStatus);

/**
 * @route DELETE /api/requests/:id
 * @desc Delete material request
 * @access Private (Manager, Director, or team leader for own pending requests)
 */
router.delete('/:id', AuthMiddleware.authenticate, RequestController.deleteRequest);

/**
 * @route GET /api/requests/team/:teamId
 * @desc Get requests for a specific team
 * @access Private (Director, Manager, Team members)
 */
router.get('/team/:teamId', AuthMiddleware.authenticate, RequestController.getTeamRequests);

export default router;