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
        res.status(401).json({
          success: false,
          message: 'Access token is required',
        });
        return;
      }

      // Verify token
      const decoded = JWTUtils.verifyToken(token);

      // Check if user still exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, role: true, name: true },
      });

      if (!user) {
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
      };

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  };

  /**
   * Middleware to check if user has required role
   */
  static authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
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
export const requireManager = AuthMiddleware.authorize('manager', 'director');
export const requireMentor = AuthMiddleware.authorize('mentor', 'manager', 'director');
export const requireIncubator = AuthMiddleware.authorize('incubator', 'mentor', 'manager', 'director');