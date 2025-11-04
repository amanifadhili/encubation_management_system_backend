import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { AuthMiddleware, requireDirector } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { userSchemas } from '../utils/validation';

const router = Router();

/**
 * @route GET /api/users
 * @desc Get all users (Director only)
 * @access Private (Director)
 */
router.get('/', AuthMiddleware.authenticate, requireDirector, UserController.getUsers);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get('/:id', AuthMiddleware.authenticate, UserController.getUser);

/**
 * @route POST /api/users
 * @desc Create new user (Director only)
 * @access Private (Director)
 */
router.post('/', AuthMiddleware.authenticate, requireDirector, validateBody(userSchemas.create), UserController.createUser);

/**
 * @route PUT /api/users/:id
 * @desc Update user (Director only)
 * @access Private (Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireDirector, validateBody(userSchemas.update), UserController.updateUser);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (Director only)
 * @access Private (Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireDirector, UserController.deleteUser);

export default router;