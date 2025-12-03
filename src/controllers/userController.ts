import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PasswordUtils } from '../utils/password';
import emailService from '../services/emailService';
import { ProfileCompletionCalculator } from '../utils/profileCompletion';
import { profileSchemas } from '../utils/profileValidation';

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

      // Generate password if not provided (default password based on role)
      const userPassword = password || PasswordUtils.generateDefaultPassword(role);

      // Hash password
      const hashedPassword = await PasswordUtils.hash(userPassword);

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
            password: userPassword, // Send password (generated or provided) in email for new users
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

  /**
   * Get current user's profile
   * GET /api/users/profile
   */
  static async getProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
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
        message: 'Profile retrieved successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch profile'
      });
    }
  }

  /**
   * Update current user's profile
   * PUT /api/users/profile
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      const { name, email, password, currentPassword } = req.body;

      // Get current user
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId }
      });

      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // If changing password, verify current password
      if (password) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is required to change password'
          });
        }

        const isValidPassword = await PasswordUtils.verify(
          currentPassword,
          currentUser.password_hash
        );

        if (!isValidPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
      }

      // Check if email is being changed and if it's already taken
      if (email && email.toLowerCase() !== currentUser.email) {
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
      if (password) {
        updateData.password_hash = await PasswordUtils.hash(password);
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: req.user.userId },
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

      // Send email notification if email was changed
      if (email && email.toLowerCase() !== currentUser.email) {
        try {
          await emailService.sendEmail({
            to: email.toLowerCase(),
            subject: 'Email Address Updated',
            template: 'user/user-updated',
            emailType: 'user_updated',
            userId: req.user.userId,
            templateData: {
              userName: updatedUser.name,
              userEmail: updatedUser.email,
              changes: 'Your email address has been updated',
              appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173',
              currentYear: new Date().getFullYear()
            }
          });
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't fail profile update if email fails
        }
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  // Get extended profile with all fields
  static async getExtendedProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          phone: true,
          profile_photo_url: true,
          enrollment_status: true,
          major_program: true,
          program_of_study: true,
          graduation_year: true,
          current_role: true,
          skills: true,
          support_interests: true,
          additional_notes: true,
          profile_completion_percentage: true,
          profile_phase_completion: true,
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

      // Parse JSON fields if they're strings
      const parsedUser = {
        ...user,
        skills: typeof user.skills === 'string' ? (user.skills ? JSON.parse(user.skills) : null) : user.skills,
        support_interests: typeof user.support_interests === 'string' ? (user.support_interests ? JSON.parse(user.support_interests) : null) : user.support_interests,
        profile_phase_completion: typeof user.profile_phase_completion === 'string' ? (user.profile_phase_completion ? JSON.parse(user.profile_phase_completion) : null) : user.profile_phase_completion
      };

      res.json({
        success: true,
        data: parsedUser
      });
    } catch (error) {
      console.error('Get extended profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get extended profile'
      });
    }
  }

  // Get profile completion
  static async getProfileCompletion(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const completion = await ProfileCompletionCalculator.calculateCompletion(userId, user);

      res.json({
        success: true,
        data: completion
      });
    } catch (error) {
      console.error('Get profile completion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile completion'
      });
    }
  }

  // Update Phase 1: Basic Information
  static async updateProfilePhase1(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { first_name, middle_name, last_name, phone, profile_photo_url } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateData: any = {};
      if (first_name) updateData.first_name = first_name;
      if (middle_name !== undefined) updateData.middle_name = middle_name || null;
      if (last_name) updateData.last_name = last_name;
      if (phone) updateData.phone = phone;
      if (profile_photo_url !== undefined) updateData.profile_photo_url = profile_photo_url || null;

      // Update display name if first/last name changed
      if (first_name && last_name) {
        updateData.name = `${first_name} ${last_name}`.trim();
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          name: true,
          phone: true,
          profile_photo_url: true
        }
      });

      // Recalculate completion
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const completion = await ProfileCompletionCalculator.calculateCompletion(userId, user);
        await prisma.user.update({
          where: { id: userId },
          data: { profile_completion_percentage: completion.percentage }
        });
      }

      res.json({
        success: true,
        message: 'Profile Phase 1 updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile phase 1 error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile Phase 1'
      });
    }
  }

  // Update Phase 2: Academic Profile
  static async updateProfilePhase2(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { enrollment_status, major_program, program_of_study, graduation_year } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateData: any = {};
      if (enrollment_status) updateData.enrollment_status = enrollment_status;
      if (major_program) updateData.major_program = major_program;
      if (program_of_study) updateData.program_of_study = program_of_study;
      if (graduation_year) updateData.graduation_year = parseInt(graduation_year);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          enrollment_status: true,
          major_program: true,
          program_of_study: true,
          graduation_year: true
        }
      });

      // Recalculate completion
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const completion = await ProfileCompletionCalculator.calculateCompletion(userId, user);
        await prisma.user.update({
          where: { id: userId },
          data: { profile_completion_percentage: completion.percentage }
        });
      }

      res.json({
        success: true,
        message: 'Profile Phase 2 updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile phase 2 error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile Phase 2'
      });
    }
  }

  // Update Phase 3: Professional Profile
  static async updateProfilePhase3(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { current_role, skills, support_interests } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateData: any = {};
      if (current_role) updateData.current_role = current_role;
      
      // Handle skills - convert array to JSON string if needed
      if (skills !== undefined) {
        updateData.skills = Array.isArray(skills) ? JSON.stringify(skills) : skills;
      }
      
      // Handle support_interests - convert array to JSON string if needed
      if (support_interests !== undefined) {
        updateData.support_interests = Array.isArray(support_interests) ? JSON.stringify(support_interests) : support_interests;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          current_role: true,
          skills: true,
          support_interests: true
        }
      });

      // Parse JSON fields for response
      const parsedUser = {
        ...updatedUser,
        skills: typeof updatedUser.skills === 'string' ? (updatedUser.skills ? JSON.parse(updatedUser.skills) : null) : updatedUser.skills,
        support_interests: typeof updatedUser.support_interests === 'string' ? (updatedUser.support_interests ? JSON.parse(updatedUser.support_interests) : null) : updatedUser.support_interests
      };

      // Recalculate completion
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const completion = await ProfileCompletionCalculator.calculateCompletion(userId, user);
        await prisma.user.update({
          where: { id: userId },
          data: { profile_completion_percentage: completion.percentage }
        });
      }

      res.json({
        success: true,
        message: 'Profile Phase 3 updated successfully',
        data: parsedUser
      });
    } catch (error) {
      console.error('Update profile phase 3 error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile Phase 3'
      });
    }
  }

  // Update Phase 5: Additional Information
  static async updateProfilePhase5(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { additional_notes } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateData: any = {};
      if (additional_notes !== undefined) updateData.additional_notes = additional_notes || null;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          additional_notes: true
        }
      });

      // Recalculate completion
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const completion = await ProfileCompletionCalculator.calculateCompletion(userId, user);
        await prisma.user.update({
          where: { id: userId },
          data: { profile_completion_percentage: completion.percentage }
        });
      }

      res.json({
        success: true,
        message: 'Profile Phase 5 updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile phase 5 error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile Phase 5'
      });
    }
  }

  // Get specific phase data
  static async getProfilePhase(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { phaseNumber } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      let phaseData: any = {};

      switch (parseInt(phaseNumber)) {
        case 1:
          phaseData = {
            first_name: user.first_name,
            middle_name: user.middle_name,
            last_name: user.last_name,
            phone: user.phone,
            profile_photo_url: user.profile_photo_url,
            completed: ProfileCompletionCalculator.calculatePhase1(user)
          };
          break;
        case 2:
          phaseData = {
            enrollment_status: user.enrollment_status,
            major_program: user.major_program,
            program_of_study: user.program_of_study,
            graduation_year: user.graduation_year,
            completed: ProfileCompletionCalculator.calculatePhase2(user)
          };
          break;
        case 3:
          phaseData = {
            current_role: user.current_role,
            skills: typeof user.skills === 'string' ? (user.skills ? JSON.parse(user.skills) : null) : user.skills,
            support_interests: typeof user.support_interests === 'string' ? (user.support_interests ? JSON.parse(user.support_interests) : null) : user.support_interests,
            completed: ProfileCompletionCalculator.calculatePhase3(user)
          };
          break;
        case 4:
          // Phase 4 is project-related, get user's project data
          const projects = await prisma.project.findMany({
            where: {
              team: {
                team_members: {
                  some: {
                    user_id: userId
                  }
                }
              }
            },
            select: {
              id: true,
              name: true,
              startup_company_name: true,
              status_at_enrollment: true,
              challenge_description: true
            }
          });
          phaseData = {
            projects,
            completed: await ProfileCompletionCalculator.calculatePhase4(userId)
          };
          break;
        case 5:
          phaseData = {
            additional_notes: user.additional_notes,
            completed: ProfileCompletionCalculator.calculatePhase5(user)
          };
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid phase number. Must be between 1 and 5.'
          });
      }

      res.json({
        success: true,
        data: phaseData,
        phase: parseInt(phaseNumber)
      });
    } catch (error) {
      console.error('Get profile phase error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile phase data'
      });
    }
  }

  // Upload/Update profile photo
  static async uploadProfilePhoto(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { profile_photo_url } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      if (!profile_photo_url) {
        return res.status(400).json({
          success: false,
          message: 'Profile photo URL is required'
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { profile_photo_url },
        select: {
          id: true,
          profile_photo_url: true
        }
      });

      res.json({
        success: true,
        message: 'Profile photo updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Upload profile photo error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile photo'
      });
    }
  }
}