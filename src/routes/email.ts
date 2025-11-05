import { Router } from 'express';
import { EmailController } from '../controllers/emailController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/email/statistics
 * @desc Get email statistics
 * @access Private (Manager, Director)
 */
router.get(
  '/statistics',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize('manager', 'director'),
  EmailController.getStatistics
);

/**
 * @route GET /api/email/verify
 * @desc Verify email service connection
 * @access Private (Manager, Director)
 */
router.get(
  '/verify',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize('manager', 'director'),
  EmailController.verifyConnection
);

/**
 * @route POST /api/email/clear-cache
 * @desc Clear email template cache
 * @access Private (Manager, Director)
 */
router.post(
  '/clear-cache',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize('manager', 'director'),
  EmailController.clearCache
);

export default router;
