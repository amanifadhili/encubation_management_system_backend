import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/notifications
 * @desc Get all notifications for the authenticated user
 * @access Private
 */
router.get('/', AuthMiddleware.authenticate, NotificationController.getNotifications);

/**
 * @route GET /api/notifications/sent
 * @desc Get notifications sent by the authenticated user
 * @access Private
 */
router.get('/sent', AuthMiddleware.authenticate, NotificationController.getSentNotifications);

/**
 * @route POST /api/notifications
 * @desc Create a new notification
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, NotificationController.createNotification);

/**
 * @route GET /api/notifications/:id
 * @desc Get notification details
 * @access Private (Sender or Recipient)
 */
router.get('/:id', AuthMiddleware.authenticate, NotificationController.getNotification);

/**
 * @route PUT /api/notifications/:id/read
 * @desc Mark notification as read
 * @access Private (Recipient)
 */
router.put('/:id/read', AuthMiddleware.authenticate, NotificationController.markAsRead);

/**
 * @route PUT /api/notifications/:id
 * @desc Update notification (sender only)
 * @access Private (Sender)
 */
router.put('/:id', AuthMiddleware.authenticate, NotificationController.updateNotification);

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete notification (sender only)
 * @access Private (Sender)
 */
router.delete('/:id', AuthMiddleware.authenticate, NotificationController.deleteNotification);

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics
 * @access Private
 */
router.get('/stats', AuthMiddleware.authenticate, NotificationController.getNotificationStats);

export default router;