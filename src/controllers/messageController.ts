import { Request, Response } from 'express';
import { Message, Conversation, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { emitToConversation, emitToUser } from '../services/socketService';

interface CreateConversationRequest {
  participants: string[];
}

interface SendMessageRequest {
  content: string;
  message_type?: 'text' | 'file';
  file_path?: string;
}

interface MessageResponse {
  success: boolean;
  message: string;
  data?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class MessageController {
  /**
   * Get all conversations for the authenticated user
   */
  static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Get conversations where user is a participant
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            path: '$',
            array_contains: req.user?.userId
          }
        },
        include: {
          messages: {
            orderBy: { sent_at: 'desc' },
            take: 1, // Get latest message
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        orderBy: { updated_at: 'desc' },
        skip,
        take: limitNum
      });

      // Get total count
      const total = await prisma.conversation.count({
        where: {
          participants: {
            path: '$',
            array_contains: req.user?.userId
          }
        }
      });

      const totalPages = Math.ceil(total / limitNum);

      // Get all unique participant IDs from conversations
      const allParticipantIds = new Set<string>();
      conversations.forEach(conv => {
        const participants = conv.participants as string[];
        participants.forEach(p => allParticipantIds.add(p));
      });

      // Fetch user details for all participants
      const participantUsers = await prisma.user.findMany({
        where: {
          id: {
            in: Array.from(allParticipantIds)
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      });

      // Create a map for quick user lookup
      const userMap = new Map(participantUsers.map(user => [user.id, user]));

      // Format conversations with participant user objects
      const formattedConversations = conversations.map(conv => {
        const participantIds = conv.participants as string[];
        const participants = participantIds.map(id => userMap.get(id)).filter(Boolean);
        const otherParticipants = participants.filter(p => p!.id !== req.user?.userId);

        return {
          ...conv,
          participants, // Now contains user objects instead of IDs
          other_participants: otherParticipants, // Now contains user objects
          latest_message: conv.messages[0] || null
        };
      });

      res.json({
        success: true,
        message: 'Conversations retrieved successfully',
        data: { conversations: formattedConversations },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as MessageResponse);

    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MessageResponse);
    }
  }

  /**
   * Create a new conversation
   */
  static async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const { participants }: CreateConversationRequest = req.body;

      // Validate participants
      if (!participants || !Array.isArray(participants) || participants.length < 1) {
        res.status(400).json({
          success: false,
          message: 'At least one participant is required'
        } as MessageResponse);
        return;
      }

      // Add current user to participants if not already included
      const allParticipants = [...new Set([...participants, req.user!.userId])];

      // Check if conversation already exists with these participants
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          AND: allParticipants.map(participantId => ({
            participants: {
              path: '$',
              array_contains: participantId
            }
          }))
        }
      });

      if (existingConversation) {
        // Check if all participants match
        const existingParticipants = existingConversation.participants as string[];
        const participantsMatch = allParticipants.every(p => existingParticipants.includes(p)) &&
                                  existingParticipants.length === allParticipants.length;

        if (participantsMatch) {
          res.status(400).json({
            success: false,
            message: 'Conversation already exists with these participants'
          } as MessageResponse);
          return;
        }
      }

      // Validate that all participants exist and user can message them
      for (const participantId of allParticipants) {
        const user = await prisma.user.findUnique({
          where: { id: participantId }
        });

        if (!user) {
          res.status(400).json({
            success: false,
            message: `User ${participantId} not found`
          } as MessageResponse);
          return;
        }

        // Check if current user can message this participant
        if (participantId !== req.user!.userId && !(await MessageController.canMessageUser(req.user!, user))) {
          res.status(403).json({
            success: false,
            message: `You cannot message user ${user.name || user.email}`
          } as MessageResponse);
          return;
        }
      }

      // Create conversation
      const conversation = await prisma.conversation.create({
        data: {
          participants: allParticipants
        }
      });

      // Get user details for the created conversation
      const participantUsers = await prisma.user.findMany({
        where: {
          id: {
            in: allParticipants
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      });

      // Format conversation with user objects
      const userMap = new Map(participantUsers.map(user => [user.id, user]));
      const participantObjects = allParticipants.map(id => userMap.get(id)).filter(Boolean);
      const otherParticipants = participantObjects.filter(p => p!.id !== req.user?.userId);

      const formattedConversation = {
        ...conversation,
        participants: participantObjects,
        other_participants: otherParticipants
      };

      res.status(201).json({
        success: true,
        message: 'Conversation created successfully',
        data: { conversation: formattedConversation }
      } as MessageResponse);

    } catch (error) {
      console.error('Create conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MessageResponse);
    }
  }

  /**
   * Get messages for a conversation
   */
  static async getConversationMessages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Check if conversation exists and user is participant
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          participants: true,
          _count: {
            select: {
              messages: true
            }
          }
        }
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found'
        } as MessageResponse);
        return;
      }

      // Check if user is participant
      const participants = conversation.participants as string[];
      if (!participants.includes(req.user!.userId)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as MessageResponse);
        return;
      }

      // Get messages with pagination (newest first)
      const messages = await prisma.message.findMany({
        where: { conversation_id: id },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: { sent_at: 'desc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(conversation._count.messages / limitNum);

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: { messages: messages.reverse() }, // Reverse to show oldest first
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: conversation._count.messages,
          pages: totalPages
        }
      } as MessageResponse);

    } catch (error) {
      console.error('Get conversation messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MessageResponse);
    }
  }

  /**
   * Send a message to a conversation
   */
  static async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { content, message_type = 'text', file_path }: SendMessageRequest = req.body;

      // Validate input
      if (!content && message_type === 'text') {
        res.status(400).json({
          success: false,
          message: 'Message content is required for text messages'
        } as MessageResponse);
        return;
      }

      // Check if conversation exists and user is participant
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          participants: true
        }
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found'
        } as MessageResponse);
        return;
      }

      // Check if user is participant
      const participants = conversation.participants as string[];
      if (!participants.includes(req.user!.userId)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as MessageResponse);
        return;
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          conversation_id: id,
          sender_id: req.user!.userId,
          content,
          message_type,
          file_path
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          conversation: {
            select: {
              id: true,
              participants: true
            }
          }
        }
      });

      // Update conversation updated_at
      await prisma.conversation.update({
        where: { id },
        data: { updated_at: new Date() }
      });

      // Emit real-time message to conversation participants
      emitToConversation(id, 'new_message', {
        id: message.id,
        conversationId: id,
        sender: message.sender,
        content: message.content,
        messageType: message.message_type,
        filePath: message.file_path,
        sentAt: message.sent_at
      });

      // Send notifications to other participants
      participants.forEach(participantId => {
        if (participantId !== req.user!.userId) {
          emitToUser(participantId, 'message_notification', {
            conversationId: id,
            sender: message.sender,
            content: message.content,
            messageType: message.message_type
          });
        }
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: { message }
      } as MessageResponse);

    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MessageResponse);
    }
  }

  /**
   * Send a file message to a conversation
   */
  static async sendFileMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if conversation exists and user is participant
      const conversation = await prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          participants: true
        }
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found'
        } as MessageResponse);
        return;
      }

      // Check if user is participant
      const participants = conversation.participants as string[];
      if (!participants.includes(req.user!.userId)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as MessageResponse);
        return;
      }

      // Handle file upload (assuming multer is configured)
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'File is required'
        } as MessageResponse);
        return;
      }

      const filePath = req.file.path; // Or cloud storage URL
      const fileName = req.file.originalname;

      // Create file message
      const message = await prisma.message.create({
        data: {
          conversation_id: id,
          sender_id: req.user!.userId,
          content: fileName,
          message_type: 'file',
          file_path: filePath
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          conversation: {
            select: {
              id: true,
              participants: true
            }
          }
        }
      });

      // Update conversation updated_at
      await prisma.conversation.update({
        where: { id },
        data: { updated_at: new Date() }
      });

      // Emit real-time message to conversation participants
      emitToConversation(id, 'new_message', {
        id: message.id,
        conversationId: id,
        sender: message.sender,
        content: message.content,
        messageType: message.message_type,
        filePath: message.file_path,
        sentAt: message.sent_at
      });

      // Send notifications to other participants
      participants.forEach(participantId => {
        if (participantId !== req.user!.userId) {
          emitToUser(participantId, 'message_notification', {
            conversationId: id,
            sender: message.sender,
            content: message.content,
            messageType: message.message_type
          });
        }
      });

      res.status(201).json({
        success: true,
        message: 'File message sent successfully',
        data: { message }
      } as MessageResponse);

    } catch (error) {
      console.error('Send file message error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MessageResponse);
    }
  }

  /**
   * Get conversation details
   */
  static async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            take: 1,
            orderBy: { sent_at: 'desc' },
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      });

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found'
        } as MessageResponse);
        return;
      }

      // Check if user is participant
      const participants = conversation.participants as string[];
      if (!participants.includes(req.user!.userId)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as MessageResponse);
        return;
      }

      // Get user details for participants
      const participantUsers = await prisma.user.findMany({
        where: {
          id: {
            in: participants
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      });

      // Create user map and format participants
      const userMap = new Map(participantUsers.map(user => [user.id, user]));
      const participantObjects = participants.map(id => userMap.get(id)).filter(Boolean);
      const otherParticipants = participantObjects.filter(p => p!.id !== req.user?.userId);

      const formattedConversation = {
        ...conversation,
        participants: participantObjects, // User objects instead of IDs
        other_participants: otherParticipants, // User objects instead of IDs
        latest_message: conversation.messages[0] || null
      };

      res.json({
        success: true,
        message: 'Conversation retrieved successfully',
        data: { conversation: formattedConversation }
      } as MessageResponse);

    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MessageResponse);
    }
  }

  /**
   * Helper method to check if user can message another user
   */
  private static async canMessageUser(currentUser: any, targetUser: any): Promise<boolean> {
    // Users can always message themselves (for group creation)
    if (currentUser.userId === targetUser.id) {
      return true;
    }

    // Define messaging rules based on roles
    switch (currentUser.role) {
      case 'director':
        return true; // Directors can message anyone

      case 'manager':
        return true; // Managers can message anyone

      case 'mentor':
        // Mentors can message directors, managers, and assigned teams
        return ['director', 'manager'].includes(targetUser.role) ||
               await MessageController.isMentorAssignedToUser(currentUser.userId, targetUser.id);

      case 'incubator':
        // Incubators can message directors, managers, assigned mentors, and other teams
        return ['director', 'manager'].includes(targetUser.role) ||
               await MessageController.isMentorAssignedToUser(targetUser.id, currentUser.userId) ||
               (targetUser.role === 'incubator' && targetUser.id !== currentUser.userId);

      default:
        return false;
    }
  }

  /**
   * Helper method to check if mentor is assigned to a user
   */
  private static async isMentorAssignedToUser(mentorId: string, userId: string): Promise<boolean> {
    try {
      // Get user's team
      const teamMember = await prisma.teamMember.findFirst({
        where: { user_id: userId }
      });

      if (!teamMember) return false;

      // Check if mentor is assigned to user's team
      const assignment = await prisma.mentorAssignment.findFirst({
        where: {
          mentor_id: mentorId,
          team_id: teamMember.team_id
        }
      });

      return !!assignment;
    } catch (error) {
      console.error('Error checking mentor assignment:', error);
      return false;
    }
  }
}