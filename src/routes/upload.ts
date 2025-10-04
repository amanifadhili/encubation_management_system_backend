import { Router } from 'express';
import { UploadController } from '../controllers/uploadController';
import { AuthMiddleware } from '../middleware/auth';
import { upload, uploadImages, uploadDocuments } from '../middleware/upload';

const router = Router();

/**
 * @route POST /api/upload/single
 * @desc Upload a single file (general purpose)
 * @access Private
 */
router.post('/single', AuthMiddleware.authenticate, upload.single('file'), UploadController.uploadSingleFile);

/**
 * @route POST /api/upload/multiple
 * @desc Upload multiple files
 * @access Private
 */
router.post('/multiple', AuthMiddleware.authenticate, upload.array('files', 10), UploadController.uploadMultipleFiles);

/**
 * @route POST /api/upload/images
 * @desc Upload image files only
 * @access Private
 */
router.post('/images', AuthMiddleware.authenticate, uploadImages.array('images', 5), UploadController.uploadMultipleFiles);

/**
 * @route POST /api/upload/documents
 * @desc Upload document files only
 * @access Private
 */
router.post('/documents', AuthMiddleware.authenticate, uploadDocuments.array('documents', 5), UploadController.uploadMultipleFiles);

/**
 * @route POST /api/upload/projects/:projectId/files
 * @desc Upload files to a specific project
 * @access Private (Project access required)
 */
router.post('/projects/:projectId/files', AuthMiddleware.authenticate, upload.array('files', 10), UploadController.uploadProjectFiles);

/**
 * @route POST /api/upload/messages/file
 * @desc Upload file for messaging
 * @access Private
 */
router.post('/messages/file', AuthMiddleware.authenticate, upload.single('file'), UploadController.uploadMessageFile);

/**
 * @route GET /api/upload/files/:fileId
 * @desc Get file information
 * @access Private (File access required)
 */
router.get('/files/:fileId', AuthMiddleware.authenticate, UploadController.getFileInfo);

/**
 * @route DELETE /api/upload/files/:fileId
 * @desc Delete a file
 * @access Private (File owner or admin)
 */
router.delete('/files/:fileId', AuthMiddleware.authenticate, UploadController.deleteFile);

/**
 * @route GET /api/upload/stats
 * @desc Get upload statistics
 * @access Private
 */
router.get('/stats', AuthMiddleware.authenticate, UploadController.getUploadStats);

/**
 * @route GET /api/upload/search
 * @desc Search files
 * @access Private
 */
router.get('/search', AuthMiddleware.authenticate, UploadController.searchFiles);

/**
 * @route POST /api/upload/batch-delete
 * @desc Batch delete files
 * @access Private
 */
router.post('/batch-delete', AuthMiddleware.authenticate, UploadController.batchDeleteFiles);

/**
 * @route GET /api/upload/projects/:projectId/files
 * @desc Get project files with pagination
 * @access Private (Project access required)
 */
router.get('/projects/:projectId/files', AuthMiddleware.authenticate, UploadController.getProjectFiles);

/**
 * @route GET /api/upload/files/:fileId/download
 * @desc Download file (with access logging)
 * @access Private (File access required)
 */
router.get('/files/:fileId/download', AuthMiddleware.authenticate, UploadController.downloadFile);

/**
 * @route POST /api/upload/projects/:projectId/cleanup
 * @desc Clean up all files for a project (admin only)
 * @access Private (Director/Manager only)
 */
router.post('/projects/:projectId/cleanup', AuthMiddleware.authenticate, UploadController.cleanupProjectFiles);

export default router;