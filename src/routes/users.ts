import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/users
 * @desc Get all users
 * @access Private
 */
router.get('/', AuthMiddleware.authenticate, UserController.getUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get('/:id', AuthMiddleware.authenticate, UserController.getUser);

export default router;