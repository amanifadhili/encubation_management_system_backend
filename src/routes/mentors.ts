import { Router } from 'express';
import { MentorController } from '../controllers/mentorController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/mentors
 * @desc Get all mentors
 * @access Private (Director, Manager)
 */
router.get('/', AuthMiddleware.authenticate, MentorController.getAllMentors);

/**
 * @route POST /api/mentors
 * @desc Create new mentor
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, MentorController.createMentor);

/**
 * @route GET /api/mentors/:id
 * @desc Get mentor details
 * @access Private (Director, Manager, Mentor themselves, Assigned teams)
 */
router.get('/:id', AuthMiddleware.authenticate, MentorController.getMentorById);

/**
 * @route PUT /api/mentors/:id
 * @desc Update mentor
 * @access Private (Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, requireManager, MentorController.updateMentor);

/**
 * @route DELETE /api/mentors/:id
 * @desc Delete mentor
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, MentorController.deleteMentor);

/**
 * @route POST /api/mentors/:id/assign
 * @desc Assign mentor to team
 * @access Private (Manager, Director)
 */
router.post('/:id/assign', AuthMiddleware.authenticate, requireManager, MentorController.assignMentorToTeam);

/**
 * @route DELETE /api/mentors/:id/assign/:teamId
 * @desc Remove mentor from team
 * @access Private (Manager, Director)
 */
router.delete('/:id/assign/:teamId', AuthMiddleware.authenticate, requireManager, MentorController.removeMentorFromTeam);

/**
 * @route GET /api/mentors/:id/assignments
 * @desc Get mentor assignments
 * @access Private (Director, Manager, Mentor themselves)
 */
router.get('/:id/assignments', AuthMiddleware.authenticate, MentorController.getMentorAssignments);

export default router;