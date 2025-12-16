import { Router } from 'express';
import { TeamController } from '../controllers/teamController';
import { AuthMiddleware, requireManager, requireIncubator } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validation';
import { teamSchemas, querySchemas } from '../utils/validation';

const router = Router();

/**
 * @route GET /api/teams
 * @desc Get all teams (role-based filtering)
 * @access Private (Director, Manager, Mentor, Incubator)
 */
router.get('/', AuthMiddleware.authenticate, validateQuery(querySchemas.teamFilters), TeamController.getAllTeams);

/**
 * @route POST /api/teams
 * @desc Create new team
 * @access Private (Manager, Director)
 */
router.post('/', AuthMiddleware.authenticate, requireManager, validateBody(teamSchemas.create), TeamController.createTeam);

/**
 * @route GET /api/teams/inactive
 * @desc Get inactive teams
 * @access Private (Manager, Director)
 */
router.get('/inactive', AuthMiddleware.authenticate, requireManager, TeamController.getInactiveTeams);

/**
 * @route GET /api/teams/:id
 * @desc Get team by ID
 * @access Private (Role-based access)
 */
router.get('/:id', AuthMiddleware.authenticate, TeamController.getTeamById);

/**
 * @route PUT /api/teams/:id
 * @desc Update team
 * @access Private (Manager, Director, Incubator team leader)
 */
router.put('/:id', AuthMiddleware.authenticate, validateBody(teamSchemas.update), TeamController.updateTeam);

/**
 * @route DELETE /api/teams/:id
 * @desc Deactivate team (soft delete)
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, TeamController.deleteTeam);

/**
 * @route PATCH /api/teams/:id/restore
 * @desc Restore deactivated team
 * @access Private (Manager, Director)
 */
router.patch('/:id/restore', AuthMiddleware.authenticate, requireManager, TeamController.restoreTeam);

/**
 * @route GET /api/teams/:id/members
 * @desc Get team members
 * @access Private (Role-based access)
 */
router.get('/:id/members', AuthMiddleware.authenticate, TeamController.getTeamMembers);

/**
 * @route POST /api/teams/:id/members
 * @desc Add member to team
 * @access Private (Incubator team leader only)
 */
router.post('/:id/members', AuthMiddleware.authenticate, requireIncubator, validateBody(teamSchemas.addMember), TeamController.addMember);

/**
 * @route DELETE /api/teams/:id/members/:memberId
 * @desc Remove member from team
 * @access Private (Incubator team leader only)
 */
router.delete('/:id/members/:memberId', AuthMiddleware.authenticate, requireIncubator, TeamController.removeMember);

export default router;