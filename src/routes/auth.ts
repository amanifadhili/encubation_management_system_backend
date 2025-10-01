import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', AuthController.login);

/**
 * @route POST /api/auth/logout
 * @desc User logout
 * @access Private
 */
router.post('/logout', AuthMiddleware.authenticate, AuthController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get('/me', AuthMiddleware.authenticate, AuthController.getCurrentUser);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Private
 */
router.post('/refresh', AuthController.refreshToken);

export default router;