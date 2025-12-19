import { Router } from 'express';
import { RequestTemplateController } from '../controllers/requestTemplateController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/request-templates
 * @desc Get all request templates
 * @access Private (All authenticated users)
 */
router.get('/', AuthMiddleware.authenticate, RequestTemplateController.getAllTemplates);

/**
 * @route POST /api/request-templates
 * @desc Create new request template
 * @access Private (All authenticated users)
 */
router.post('/', AuthMiddleware.authenticate, RequestTemplateController.createTemplate);

/**
 * @route GET /api/request-templates/:id
 * @desc Get request template details
 * @access Private (Public templates or template creator)
 */
router.get('/:id', AuthMiddleware.authenticate, RequestTemplateController.getTemplateById);

/**
 * @route PUT /api/request-templates/:id
 * @desc Update request template
 * @access Private (Template creator or Manager/Director)
 */
router.put('/:id', AuthMiddleware.authenticate, RequestTemplateController.updateTemplate);

/**
 * @route DELETE /api/request-templates/:id
 * @desc Delete request template
 * @access Private (Template creator or Manager/Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, RequestTemplateController.deleteTemplate);

/**
 * @route POST /api/request-templates/:id/create-request
 * @desc Create a request from a template
 * @access Private (Template accessible to user)
 */
router.post('/:id/create-request', AuthMiddleware.authenticate, RequestTemplateController.createRequestFromTemplate);

export default router;
