import { Router } from 'express';
import { AnnouncementController } from '../controllers/announcementController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/announcements
 * @desc Get all announcements (public access)
 * @access Public
 */
router.get('/', AnnouncementController.getAnnouncements);

/**
 * @route GET /api/announcements/recent
 * @desc Get recent announcements
 * @access Public
 */
router.get('/recent', AnnouncementController.getRecentAnnouncements);

/**
 * @route GET /api/announcements/search
 * @desc Search announcements
 * @access Public
 */
router.get('/search', AnnouncementController.searchAnnouncements);

/**
 * @route GET /api/announcements/stats
 * @desc Get announcement statistics
 * @access Private
 */
router.get('/stats', AuthMiddleware.authenticate, AnnouncementController.getAnnouncementStats);

/**
 * @route GET /api/announcements/author/:authorId
 * @desc Get announcements by author
 * @access Public
 */
router.get('/author/:authorId', AnnouncementController.getAnnouncementsByAuthor);

/**
 * @route GET /api/announcements/:id
 * @desc Get announcement details
 * @access Public
 */
router.get('/:id', AnnouncementController.getAnnouncement);

/**
 * @route POST /api/announcements
 * @desc Create a new announcement
 * @access Private (Director/Manager only)
 */
router.post('/', AuthMiddleware.authenticate, AnnouncementController.createAnnouncement);

/**
 * @route PUT /api/announcements/:id
 * @desc Update announcement (author only)
 * @access Private (Author only)
 */
router.put('/:id', AuthMiddleware.authenticate, AnnouncementController.updateAnnouncement);

/**
 * @route DELETE /api/announcements/:id
 * @desc Delete announcement (author only)
 * @access Private (Author only)
 */
router.delete('/:id', AuthMiddleware.authenticate, AnnouncementController.deleteAnnouncement);

export default router;