import { Router } from 'express';
import { MessageController } from '../controllers/messageController';
import { AuthMiddleware } from '../middleware/auth';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * @route GET /api/conversations
 * @desc Get all conversations for the authenticated user
 * @access Private
 */
router.get('/conversations', AuthMiddleware.authenticate, MessageController.getConversations);

/**
 * @route POST /api/conversations
 * @desc Create a new conversation
 * @access Private
 */
router.post('/conversations', AuthMiddleware.authenticate, MessageController.createConversation);

/**
 * @route GET /api/conversations/:id
 * @desc Get conversation details
 * @access Private (participants only)
 */
router.get('/conversations/:id', AuthMiddleware.authenticate, MessageController.getConversation);

/**
 * @route GET /api/conversations/:id/messages
 * @desc Get messages for a conversation
 * @access Private (participants only)
 */
router.get('/conversations/:id/messages', AuthMiddleware.authenticate, MessageController.getConversationMessages);

/**
 * @route POST /api/conversations/:id/messages
 * @desc Send a message to a conversation
 * @access Private (participants only)
 */
router.post('/conversations/:id/messages', AuthMiddleware.authenticate, MessageController.sendMessage);

/**
 * @route POST /api/conversations/:id/messages/file
 * @desc Send a file message to a conversation
 * @access Private (participants only)
 */
router.post('/conversations/:id/messages/file', AuthMiddleware.authenticate, upload.single('file'), MessageController.sendFileMessage);

export default router;