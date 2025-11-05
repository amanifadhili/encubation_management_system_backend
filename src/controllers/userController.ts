import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PasswordUtils } from '../utils/password';
import emailService from '../services/emailService';

const prisma = new PrismaClient();

export class UserController {
  // Get all users (for messaging - select user to message)
  static async getUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search, role, sortBy = 'created_at', sortOrder = 'desc' } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: any = {};

      // Role filter
      if (role && role !== 'all') {
        where.role = role;
      }

      // Search filter
      if (search) {
        where.OR = [
          { name: { contains: search as string } },
          { email: { contains: search as string } }
        ];
      }

      // Build orderBy clause
      const validSortFields = ['created_at', 'updated_at', 'name', 'email', 'role'];
      const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'created_at';
      const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';
      const orderBy: any = { [sortField]: orderDirection };

      // Get total count
      const total = await prisma.user.count({ where });

      // Get users with pagination
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true
        },
        orderBy,
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        data: users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch users'
      });
    }
  }

  // Get user by ID
  static async getUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user'
      });
    }
  }

  // Create new user (Director only)
  static async createUser(req: Request, res: Response) {
    try {
      const { name, email, password, role } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hash(password);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          role
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true
        }
      });

      // Send welcome email
      try {
        await emailService.sendEmail({
          to: newUser.email,
          subject: 'Welcome to Incubation Management System',
          template: 'user/user-created',
          emailType: 'user_created',
          userId: newUser.id,
          templateData: {
            userName: newUser.name,
            userEmail: newUser.email,
            role: newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1),
            password: password, // Send password only in email for new users
            appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
            currentYear: new Date().getFullYear(),
            subject: 'Welcome to Incubation Management System'
          }
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail user creation if email fails
      }

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  }

  // Update user (Director only)
  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, email, password, role } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if email is being changed and if it's already taken
      if (email && email.toLowerCase() !== existingUser.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email: email.toLowerCase() }
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: 'Email is already taken'
          });
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email.toLowerCase();
      if (role) updateData.role = role;
      if (password) {
        updateData.password_hash = await PasswordUtils.hash(password);
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          created_at: true,
          updated_at: true
        }
      });

      // Send update notification email
      try {
        const updateDataForEmail: any = {};
        if (name && name !== existingUser.name) updateDataForEmail.updatedName = name;
        if (email && email.toLowerCase() !== existingUser.email) updateDataForEmail.updatedEmail = email.toLowerCase();
        if (role && role !== existingUser.role) updateDataForEmail.updatedRole = role.charAt(0).toUpperCase() + role.slice(1);
        if (password) updateDataForEmail.passwordChanged = true;

                  // Only send email if something actually changed
          if (Object.keys(updateDataForEmail).length > 0) {
            await emailService.sendEmail({
              to: updatedUser.email,
              subject: 'Account Information Updated',
              template: 'user/user-updated',
              emailType: 'user_updated',
              userId: updatedUser.id,
              templateData: {
                userName: updatedUser.name,
                ...updateDataForEmail,
                appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
                currentYear: new Date().getFullYear(),
                subject: 'Account Information Updated'
              }
            });
          }
      } catch (emailError) {
        console.error('Failed to send update email:', emailError);
        // Don't fail user update if email fails
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  }

  // Delete user (Director only)
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent deleting director users
      if (existingUser.role === 'director') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete director users'
        });
      }

      // Delete user
      await prisma.user.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  }
}