import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { JWTUtils } from '../utils/jwt';
import prisma from '../config/database';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userName?: string;
}

interface MessageData {
  conversationId: string;
  content: string;
  messageType?: 'text' | 'file';
  filePath?: string;
}

interface NotificationData {
  recipientId: string;
  title: string;
  message: string;
  type?: string;
}

export class SocketHandler {
  private io: SocketIOServer;

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.SOCKET_CORS_ORIGIN 
          ? process.env.SOCKET_CORS_ORIGIN.split(',').map(origin => origin.trim())
          : process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
            : (() => {
                throw new Error('SOCKET_CORS_ORIGIN or CORS_ORIGIN environment variable is required. Please set at least one in your .env file.');
              })(),
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Set up Socket.io middleware for authentication
   */
  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = JWTUtils.verifyToken(token);

        // Get user details from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            name: true,
            role: true
          }
        });

        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user info to socket
        socket.userId = user.id;
        socket.userRole = user.role;
        socket.userName = user.name;

        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Set up Socket.io event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} (${socket.userName}) connected`);

      // Join user-specific room
      socket.join(`user_${socket.userId}`);

      // Join role-based room
      socket.join(`role_${socket.userRole}`);

      // Handle joining conversation rooms
      socket.on('join_conversation', (conversationId: string) => {
        this.handleJoinConversation(socket, conversationId);
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (conversationId: string) => {
        this.handleLeaveConversation(socket, conversationId);
      });

      // Handle sending messages
      socket.on('send_message', (data: MessageData) => {
        this.handleSendMessage(socket, data);
      });

      // Handle sending notifications
      socket.on('send_notification', (data: NotificationData) => {
        this.handleSendNotification(socket, data);
      });

      // Handle typing indicators
      socket.on('typing_start', (conversationId: string) => {
        this.handleTypingStart(socket, conversationId);
      });

      socket.on('typing_stop', (conversationId: string) => {
        this.handleTypingStop(socket, conversationId);
      });

      // Handle user online status
      socket.on('user_online', () => {
        this.handleUserOnline(socket);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle joining a conversation room
   */
  private async handleJoinConversation(socket: AuthenticatedSocket, conversationId: string): Promise<void> {
    try {
      // Verify user is participant in conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { participants: true }
      });

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const participants = conversation.participants as string[];
      if (!participants.includes(socket.userId!)) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join conversation room
      socket.join(`conversation_${conversationId}`);
      console.log(`User ${socket.userId} joined conversation ${conversationId}`);

      // Notify other participants
      socket.to(`conversation_${conversationId}`).emit('user_joined', {
        userId: socket.userId,
        userName: socket.userName,
        conversationId
      });

    } catch (error) {
      console.error('Join conversation error:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  /**
   * Handle leaving a conversation room
   */
  private handleLeaveConversation(socket: AuthenticatedSocket, conversationId: string): void {
    socket.leave(`conversation_${conversationId}`);
    console.log(`User ${socket.userId} left conversation ${conversationId}`);

    // Notify other participants
    socket.to(`conversation_${conversationId}`).emit('user_left', {
      userId: socket.userId,
      userName: socket.userName,
      conversationId
    });
  }

  /**
   * Handle sending messages
   */
  private async handleSendMessage(socket: AuthenticatedSocket, data: MessageData): Promise<void> {
    try {
      const { conversationId, content, messageType = 'text', filePath } = data;

      // Verify conversation exists and user is participant
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { participants: true }
      });

      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const participants = conversation.participants as string[];
      if (!participants.includes(socket.userId!)) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Create message in database
      const message = await prisma.message.create({
        data: {
          conversation_id: conversationId,
          sender_id: socket.userId!,
          content,
          message_type: messageType,
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
          }
        }
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updated_at: new Date() }
      });

      // Emit message to conversation room
      this.io.to(`conversation_${conversationId}`).emit('new_message', {
        id: message.id,
        conversationId,
        sender: message.sender,
        content: message.content,
        messageType: message.message_type,
        filePath: message.file_path,
        sentAt: message.sent_at
      });

      // Also emit to individual user rooms for notifications
      participants.forEach(participantId => {
        if (participantId !== socket.userId) {
          this.io.to(`user_${participantId}`).emit('message_notification', {
            conversationId,
            sender: message.sender,
            content: message.content,
            messageType: message.message_type
          });
        }
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle sending notifications
   */
  private async handleSendNotification(socket: AuthenticatedSocket, data: NotificationData): Promise<void> {
    try {
      const { recipientId, title, message, type = 'general' } = data;

      // Create notification in database
      const notification = await prisma.notification.create({
        data: {
          sender_id: socket.userId!,
          recipient_type: 'user', // For now, only user notifications
          recipient_id: recipientId,
          title,
          message: message
        }
      });

      // Emit notification to recipient
      this.io.to(`user_${recipientId}`).emit('new_notification', {
        id: notification.id,
        senderId: socket.userId,
        senderName: socket.userName,
        title: notification.title,
        message: notification.message,
        readStatus: notification.read_status,
        createdAt: notification.created_at
      });

    } catch (error) {
      console.error('Send notification error:', error);
      socket.emit('error', { message: 'Failed to send notification' });
    }
  }

  /**
   * Handle typing start
   */
  private handleTypingStart(socket: AuthenticatedSocket, conversationId: string): void {
    socket.to(`conversation_${conversationId}`).emit('typing_start', {
      userId: socket.userId,
      userName: socket.userName,
      conversationId
    });
  }

  /**
   * Handle typing stop
   */
  private handleTypingStop(socket: AuthenticatedSocket, conversationId: string): void {
    socket.to(`conversation_${conversationId}`).emit('typing_stop', {
      userId: socket.userId,
      userName: socket.userName,
      conversationId
    });
  }

  /**
   * Handle user online status
   */
  private handleUserOnline(socket: AuthenticatedSocket): void {
    // Broadcast online status to relevant users
    // This could be enhanced with Redis for multi-server setups
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      userName: socket.userName
    });
  }

  /**
   * Handle user disconnection
   */
  private handleDisconnect(socket: AuthenticatedSocket): void {
    console.log(`User ${socket.userId} (${socket.userName}) disconnected`);

    // Broadcast offline status
    socket.broadcast.emit('user_offline', {
      userId: socket.userId,
      userName: socket.userName
    });
  }

  /**
   * Get Socket.io instance for external use
   */
  public getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Emit event to specific user
   */
  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  /**
   * Emit event to specific conversation
   */
  public emitToConversation(conversationId: string, event: string, data: any): void {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  /**
   * Emit event to all users with specific role
   */
  public emitToRole(role: string, event: string, data: any): void {
    this.io.to(`role_${role}`).emit(event, data);
  }
}