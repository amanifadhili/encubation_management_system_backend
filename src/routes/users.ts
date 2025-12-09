import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { AuthMiddleware, requireDirector } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { userSchemas } from '../utils/validation';
import { profileSchemas } from '../utils/profileValidation';

const router = Router();

/**
 * @route GET /api/users
 * @desc Get all users (Director only)
 * @access Private (Director)
 */
router.get('/', AuthMiddleware.authenticate, requireDirector, UserController.getUsers);

/**
 * @route POST /api/users
 * @desc Create new user (Director only)
 * @access Private (Director)
 */
router.post('/', AuthMiddleware.authenticate, requireDirector, validateBody(userSchemas.create), UserController.createUser);

/**
 * @route GET /api/users/profile
 * @desc Get current user's profile
 * @access Private (All authenticated users)
 */
router.get('/profile', AuthMiddleware.authenticate, UserController.getProfile);

/**
 * @route PUT /api/users/profile
 * @desc Update current user's profile
 * @access Private (All authenticated users)
 */
router.put('/profile', AuthMiddleware.authenticate, UserController.updateProfile);

/**
 * @route GET /api/users/profile/extended
 * @desc Get extended profile with all fields
 * @access Private (All authenticated users)
 */
router.get('/profile/extended', AuthMiddleware.authenticate, UserController.getExtendedProfile);

/**
 * @route GET /api/users/profile/completion
 * @desc Get profile completion percentage and status
 * @access Private (All authenticated users)
 */
router.get('/profile/completion', AuthMiddleware.authenticate, UserController.getProfileCompletion);

/**
 * @route PUT /api/users/profile/phase1
 * @desc Update Phase 1: Basic Information
 * @access Private (All authenticated users)
 */
router.put('/profile/phase1', AuthMiddleware.authenticate, validateBody(profileSchemas.phase1Basic), UserController.updateProfilePhase1);

/**
 * @route PUT /api/users/profile/phase2
 * @desc Update Phase 2: Academic Profile
 * @access Private (All authenticated users)
 */
router.put('/profile/phase2', AuthMiddleware.authenticate, validateBody(profileSchemas.phase2Academic), UserController.updateProfilePhase2);

/**
 * @route PUT /api/users/profile/phase3
 * @desc Update Phase 3: Professional Profile
 * @access Private (All authenticated users)
 */
router.put('/profile/phase3', AuthMiddleware.authenticate, validateBody(profileSchemas.phase3Professional), UserController.updateProfilePhase3);

/**
 * @route PUT /api/users/profile/phase5
 * @desc Update Phase 5: Additional Information
 * @access Private (All authenticated users)
 */
router.put('/profile/phase5', AuthMiddleware.authenticate, validateBody(profileSchemas.phase5Additional), UserController.updateProfilePhase5);

/**
 * @route GET /api/users/profile/phase/:phaseNumber
 * @desc Get specific phase data (1, 2, 3, or 5)
 * @note Phase 4 has been moved to Projects page
 * @access Private (All authenticated users)
 */
router.get('/profile/phase/:phaseNumber', AuthMiddleware.authenticate, UserController.getProfilePhase);

/**
 * @route PUT /api/users/profile/photo
 * @desc Upload/update profile photo URL
 * @access Private (All authenticated users)
 */
router.put('/profile/photo', AuthMiddleware.authenticate, validateBody(profileSchemas.photoUpload), UserController.uploadProfilePhoto);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get('/:id', AuthMiddleware.authenticate, UserController.getUser);

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