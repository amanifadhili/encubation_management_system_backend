import { Router } from 'express';
import { ProjectController } from '../controllers/projectController';
import { AuthMiddleware, requireIncubator } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { projectSchemas, querySchemas } from '../utils/validation';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/', // Temporary upload directory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const router = Router();

/**
 * @route GET /api/projects
 * @desc Get all projects (role-filtered)
 * @access Private (Director, Manager, Mentor, Incubator)
 */
router.get('/', AuthMiddleware.authenticate, validateQuery(querySchemas.projectFilters), ProjectController.getAllProjects);

/**
 * @route POST /api/projects
 * @desc Create new project
 * @access Private (Incubator team leader only)
 */
router.post('/', AuthMiddleware.authenticate, requireIncubator, validateBody(projectSchemas.create), ProjectController.createProject);

/**
 * @route GET /api/projects/:id
 * @desc Get project details
 * @access Private (Role-based access)
 */
router.get('/:id', AuthMiddleware.authenticate, ProjectController.getProjectById);

/**
 * @route PUT /api/projects/:id
 * @desc Update project
 * @access Private (Incubator team leader, Manager, Director)
 */
router.put('/:id', AuthMiddleware.authenticate, validateBody(projectSchemas.update), ProjectController.updateProject);

/**
 * @route DELETE /api/projects/:id
 * @desc Delete project
 * @access Private (Incubator team leader, Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, ProjectController.deleteProject);

/**
 * @route GET /api/projects/:id/files
 * @desc Get project files
 * @access Private (Role-based access)
 */
router.get('/:id/files', AuthMiddleware.authenticate, ProjectController.getProjectFiles);

/**
 * @route POST /api/projects/:id/files
 * @desc Upload project file
 * @access Private (Incubator team leader only)
 */
router.post('/:id/files', AuthMiddleware.authenticate, requireIncubator, upload.single('file'), ProjectController.uploadFile);

/**
 * @route DELETE /api/projects/:id/files/:fileId
 * @desc Delete project file
 * @access Private (Incubator team leader only)
 */
router.delete('/:id/files/:fileId', AuthMiddleware.authenticate, requireIncubator, ProjectController.deleteFile);

export default router;