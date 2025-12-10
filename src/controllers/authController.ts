import { Request, Response } from 'express';
import { User } from '@prisma/client';
import prisma from '../config/database';
import { JWTUtils } from '../utils/jwt';
import { PasswordUtils } from '../utils/password';

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      password_status?: string;
      teamId?: string;
    };
    token: string;
    refreshToken?: string;
  };
}

export class AuthController {
  /**
   * User login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
          code: 'MISSING_CREDENTIALS'
        } as AuthResponse);
        return;
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        } as AuthResponse);
        return;
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.verify(password, user.password_hash);

      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        } as AuthResponse);
        return;
      }

      // Find team membership for incubators to include teamId
      // and block login if an incubator has no team assignment
      let teamId: string | undefined;
      if (user.role === 'incubator') {
        const membership = await prisma.teamMember.findFirst({
          where: { user_id: user.id },
          select: { team_id: true }
        });
        teamId = membership?.team_id;

        if (!teamId) {
          res.status(403).json({
            success: false,
            message: 'Incubator is not assigned to any team. Please contact support.',
            code: 'INCUBATOR_NO_TEAM'
          } as AuthResponse);
          return;
        }
      }

      // Generate tokens
      const token = JWTUtils.generateToken(user, teamId);
      const refreshToken = JWTUtils.generateRefreshToken(user, teamId);

      // Return success response
      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            password_status: user.password_status,
            teamId
          },
          token,
          refreshToken,
        },
      } as AuthResponse);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      } as AuthResponse);
    }
  }

  /**
   * User logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // In a stateless JWT system, logout is handled client-side
      // by removing the token from storage
      res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get current user info
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      // Get full user info from database
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          password_status: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Include team membership for incubators so the frontend can load team data
      // Block access if incubator has no team assignment
      let teamId: string | undefined;
      if (user.role === 'incubator') {
        const membership = await prisma.teamMember.findFirst({
          where: { user_id: user.id },
          select: { team_id: true },
        });
        teamId = membership?.team_id;

        if (!teamId) {
          res.status(403).json({
            success: false,
            message: 'Incubator is not assigned to any team. Please contact support.',
            code: 'INCUBATOR_NO_TEAM'
          });
          return;
        }
      }

      res.json({
        success: true,
        message: 'User info retrieved successfully',
        data: { user: { ...user, ...(teamId && { teamId }) } },
      });

    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Refresh access token (optional)
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN'
        });
        return;
      }

      // Verify refresh token
      const decoded = JWTUtils.verifyToken(refreshToken);

      // Check if user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // Generate new access token
      // Preserve teamId from refresh token if present
      const newToken = JWTUtils.generateToken(user, decoded.teamId);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: newToken,
        },
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
  }

  /**
   * Change user password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const { current_password, new_password } = req.body;

      if (!new_password) {
        res.status(400).json({
          success: false,
          message: 'New password is required',
          code: 'MISSING_NEW_PASSWORD'
        });
        return;
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
        return;
      }

      // If password_status is 'needs_change', skip current password verification
      // Otherwise, require and verify current password
      if (user.password_status !== 'needs_change') {
        if (!current_password) {
          res.status(400).json({
            success: false,
            message: 'Current password is required',
            code: 'MISSING_CURRENT_PASSWORD'
          });
          return;
        }

        // Verify current password
        const isCurrentPasswordValid = await PasswordUtils.verify(current_password, user.password_hash);

        if (!isCurrentPasswordValid) {
          res.status(401).json({
            success: false,
            message: 'Current password is incorrect',
            code: 'INVALID_CURRENT_PASSWORD'
          });
          return;
        }

        // Check if new password is different from current password
        const isSamePassword = await PasswordUtils.verify(new_password, user.password_hash);
        if (isSamePassword) {
          res.status(400).json({
            success: false,
            message: 'New password must be different from current password',
            code: 'SAME_PASSWORD'
          });
          return;
        }
      } else {
        // For forced password changes, still check if new password is different from current
        const isSamePassword = await PasswordUtils.verify(new_password, user.password_hash);
        if (isSamePassword) {
          res.status(400).json({
            success: false,
            message: 'New password must be different from your default password',
            code: 'SAME_PASSWORD'
          });
          return;
        }
      }

      // Hash new password
      const newPasswordHash = await PasswordUtils.hash(new_password);

      // Update password and set password_status to 'ok'
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password_hash: newPasswordHash,
          password_status: 'ok',
        },
      });

      res.json({
        success: true,
        message: 'Password changed successfully',
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}