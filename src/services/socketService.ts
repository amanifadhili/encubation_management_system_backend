import { SocketHandler } from '../socket/socketHandler';

let socketHandler: SocketHandler | null = null;

/**
 * Set the socket handler instance
 */
export const setSocketHandler = (handler: SocketHandler): void => {
  socketHandler = handler;
};

/**
 * Get the socket handler instance
 */
export const getSocketHandler = (): SocketHandler | null => {
  return socketHandler;
};

/**
 * Emit event to specific user
 */
export const emitToUser = (userId: string, event: string, data: any): void => {
  if (socketHandler) {
    socketHandler.emitToUser(userId, event, data);
  }
};

/**
 * Emit event to specific conversation
 */
export const emitToConversation = (conversationId: string, event: string, data: any): void => {
  if (socketHandler) {
    socketHandler.emitToConversation(conversationId, event, data);
  }
};

/**
 * Emit event to all users with specific role
 */
export const emitToRole = (role: string, event: string, data: any): void => {
  if (socketHandler) {
    socketHandler.emitToRole(role, event, data);
  }
};