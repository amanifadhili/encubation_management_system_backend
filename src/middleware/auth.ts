import { Request, Response, NextFunction } from 'express';
import { JWTUtils, JWTPayload } from '../utils/jwt';
import prisma from '../config/database';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export class AuthMiddleware {
  /**
   * Middleware to authenticate JWT tokens
   */
  static authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = JWTUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        console.error('❌ No token found in request');
        res.status(401).json({
          success: false,
          message: 'Access token is required',
        });
        return;
      }

      // Verify token
      let decoded: any;
      try {
        decoded = JWTUtils.verifyToken(token);
      } catch (tokenError: any) {
        console.error('❌ Token verification failed:', {
          error: tokenError.message,
          tokenPreview: token.substring(0, 20) + '...'
        });
        throw tokenError;
      }

      // Check if user still exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, name: true },
      });

      if (!user) {
        console.error('❌ User not found in database:', decoded.userId);
        res.status(401).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Attach user to request
      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        ...(decoded.teamId && { teamId: decoded.teamId })
      };

      next();
    } catch (error: any) {
      console.error('❌ Authentication error:', {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url
      });
      res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired token',
      });
    }
  };

  /**
   * Middleware to check if user has required role
   */
  static authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        console.error('❌ No user in request - authorization failed');
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        console.error('❌ Insufficient permissions:', {
          userRole: req.user.role,
          allowedRoles: allowedRoles
        });
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: allowedRoles,
          current: req.user.role,
        });
        return;
      }

      next();
    };
  };

  /**
   * Optional authentication (doesn't fail if no token)
   */
  static optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = JWTUtils.extractTokenFromHeader(authHeader);

      if (token) {
        const decoded = JWTUtils.verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true, role: true, name: true },
        });

        if (user) {
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
          };
        }
      }

      next();
    } catch (error) {
      // Ignore auth errors for optional auth
      next();
    }
  };
}

// Convenience middleware for specific roles
export const requireDirector = AuthMiddleware.authorize('director');
/**
 * Middleware to require Manager or Director role
 * Note: Director role has all Manager privileges, so this middleware allows both roles
 */
export const requireManager = AuthMiddleware.authorize('manager', 'director');
export const requireMentor = AuthMiddleware.authorize('mentor', 'manager', 'director');
export const requireIncubator = AuthMiddleware.authorize('incubator', 'mentor', 'manager', 'director');