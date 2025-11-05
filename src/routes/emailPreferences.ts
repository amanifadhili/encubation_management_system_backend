import { Router } from 'express';
import { EmailPreferencesController } from '../controllers/emailPreferencesController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/email-preferences
 * @desc Get user's email preferences
 * @access Private (All authenticated users)
 */
router.get('/', AuthMiddleware.authenticate, EmailPreferencesController.getPreferences);

/**
 * @route PUT /api/email-preferences
 * @desc Update user's email preferences
 * @access Private (All authenticated users)
 */
router.put('/', AuthMiddleware.authenticate, EmailPreferencesController.updatePreferences);

export default router;
