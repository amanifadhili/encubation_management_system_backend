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

/**
 * @route POST /api/requests/:id/submit
 * @desc Submit a draft request (change status to submitted/pending_review)
 * @access Private (Requester only)
 */
router.post('/:id/submit', AuthMiddleware.authenticate, RequestController.submitRequest);

/**
 * @route POST /api/requests/:id/cancel
 * @desc Cancel a request
 * @access Private (Requester, Manager, Director)
 */
router.post('/:id/cancel', AuthMiddleware.authenticate, RequestController.cancelRequest);

/**
 * @route POST /api/requests/:id/approve
 * @desc Approve request at a specific approval level
 * @access Private (Approver for that level)
 */
router.post('/:id/approve', AuthMiddleware.authenticate, requireManager, RequestController.approveRequest);

/**
 * @route POST /api/requests/:id/decline
 * @desc Decline request at a specific approval level
 * @access Private (Approver for that level)
 */
router.post('/:id/decline', AuthMiddleware.authenticate, requireManager, RequestController.declineRequest);

/**
 * @route POST /api/requests/:id/delegate
 * @desc Delegate approval to another user
 * @access Private (Approver for that level)
 */
router.post('/:id/delegate', AuthMiddleware.authenticate, requireManager, RequestController.delegateApproval);

/**
 * @route GET /api/requests/:id/comments
 * @desc Get comments for a request
 * @access Private (Role-based access)
 */
router.get('/:id/comments', AuthMiddleware.authenticate, RequestController.getComments);

/**
 * @route POST /api/requests/:id/comments
 * @desc Add a comment to a request
 * @access Private (Role-based access)
 */
router.post('/:id/comments', AuthMiddleware.authenticate, RequestController.addComment);

/**
 * @route PUT /api/requests/:id/comments/:commentId
 * @desc Update a comment
 * @access Private (Comment author, Manager, Director)
 */
router.put('/:id/comments/:commentId', AuthMiddleware.authenticate, RequestController.updateComment);

/**
 * @route DELETE /api/requests/:id/comments/:commentId
 * @desc Delete a comment
 * @access Private (Comment author, Manager, Director)
 */
router.delete('/:id/comments/:commentId', AuthMiddleware.authenticate, RequestController.deleteComment);

/**
 * @route PUT /api/requests/:id/delivery
 * @desc Update delivery status and confirm delivery
 * @access Private (Manager, Director)
 */
router.put('/:id/delivery', AuthMiddleware.authenticate, requireManager, RequestController.updateDeliveryStatus);

export default router;