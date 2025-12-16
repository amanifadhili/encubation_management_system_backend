import { Request, Response } from 'express';
import { Mentor, User, Team, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { PasswordUtils } from '../utils/password';
import emailService from '../services/emailService';

interface CreateMentorRequest {
  name: string;
  email: string;
  expertise?: string;
  phone?: string;
}

interface UpdateMentorRequest {
  name?: string;
  email?: string;
  expertise?: string;
  phone?: string;
}

interface AssignMentorRequest {
  team_id: string;
}

interface MentorResponse {
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

export class MentorController {
  /**
   * Get all mentors with role-based filtering
   */
  static async getAllMentors(req: Request, res: Response): Promise<void> {
    try {
      const {
        search,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause - by default, only show active mentors
      const where: Prisma.MentorWhereInput = {
        user: {
          status: 'active' // Only show active mentors by default
        }
      };

      // Search filter
      if (search) {
        where.OR = [
          { user: { name: { contains: search as string } } },
          { user: { email: { contains: search as string } } },
          { expertise: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.mentor.count({ where });

      // Get mentors with pagination
      const mentors = await prisma.mentor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              created_at: true
            }
          },
          mentor_assignments: {
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true,
                  status: true
                }
              }
            }
          },
          _count: {
            select: {
              mentor_assignments: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Mentors retrieved successfully',
        data: { mentors },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as MentorResponse);

    } catch (error) {
      console.error('Get all mentors error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Get mentor by ID
   */
  static async getMentorById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const mentor = await prisma.mentor.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              created_at: true
            }
          },
          mentor_assignments: {
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true,
                  status: true,
                  team_members: {
                    select: {
                      id: true,
                      user: {
                        select: {
                          id: true,
                          name: true,
                          email: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          _count: {
            select: {
              mentor_assignments: true
            }
          }
        }
      });

      if (!mentor) {
        res.status(404).json({
          success: false,
          message: 'Mentor not found'
        } as MentorResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Mentor retrieved successfully',
        data: { mentor }
      } as MentorResponse);

    } catch (error) {
      console.error('Get mentor by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Create new mentor (Manager/Director only)
   */
  static async createMentor(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, expertise, phone }: CreateMentorRequest = req.body;

      // Validate required fields
      if (!name || !email) {
        res.status(400).json({
          success: false,
          message: 'Name and email are required'
        } as MentorResponse);
        return;
      }

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        } as MentorResponse);
        return;
      }

      // Generate default password for mentor
      const mentorPassword = PasswordUtils.generateDefaultPassword('mentor');
      const hashedPassword = await PasswordUtils.hash(mentorPassword);

      // Create user account for mentor
      const newUser = await prisma.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          password_hash: hashedPassword,
          role: 'mentor'
        }
      });

      // Create mentor record
      const mentor = await prisma.mentor.create({
        data: {
          user_id: newUser.id,
          expertise,
          phone
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Send welcome email with password
      try {
        await emailService.sendEmail({
          to: newUser.email,
          subject: 'Welcome to Incubation Management System - Mentor Account',
          template: 'user/user-created',
          emailType: 'user_created',
          userId: newUser.id,
          templateData: {
            userName: newUser.name,
            userEmail: newUser.email,
            role: 'Mentor',
            password: mentorPassword,
            appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
            currentYear: new Date().getFullYear(),
            subject: 'Welcome to Incubation Management System - Mentor Account'
          }
        });
      } catch (emailError) {
        console.error('Failed to send welcome email to mentor:', emailError);
        // Don't fail mentor creation if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Mentor created successfully. Password sent to email.',
        data: { mentor }
      } as MentorResponse);

    } catch (error) {
      console.error('Create mentor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Update mentor
   */
  static async updateMentor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email, expertise, phone }: UpdateMentorRequest = req.body;

      // Check if mentor exists
      const existingMentor = await prisma.mentor.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!existingMentor) {
        res.status(404).json({
          success: false,
          message: 'Mentor not found'
        } as MentorResponse);
        return;
      }

      // Check if email conflicts (if updating email)
      if (email && email !== existingMentor.user.email) {
        const emailConflict = await prisma.user.findFirst({
          where: {
            email,
            id: { not: existingMentor.user.id }
          }
        });

        if (emailConflict) {
          res.status(400).json({
            success: false,
            message: 'Email already exists'
          } as MentorResponse);
          return;
        }
      }

      // Update user data if provided
      if (name || email) {
        await prisma.user.update({
          where: { id: existingMentor.user.id },
          data: {
            ...(name && { name }),
            ...(email && { email })
          }
        });
      }

      // Update mentor data
      const mentor = await prisma.mentor.update({
        where: { id },
        data: {
          ...(expertise !== undefined && { expertise }),
          ...(phone !== undefined && { phone })
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          },
          mentor_assignments: {
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true
                }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Mentor updated successfully',
        data: { mentor }
      } as MentorResponse);

    } catch (error) {
      console.error('Update mentor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Deactivate mentor (soft delete) - Manager/Director only
   * Deactivates the associated user account instead of hard deleting
   */
  static async deleteMentor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if mentor exists
      const mentor = await prisma.mentor.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              status: true
            }
          },
          _count: {
            select: {
              mentor_assignments: true
            }
          }
        }
      });

      if (!mentor) {
        res.status(404).json({
          success: false,
          message: 'Mentor not found'
        } as MentorResponse);
        return;
      }

      // Check if user is already inactive
      if (mentor.user.status === 'inactive') {
        res.status(400).json({
          success: false,
          message: 'Mentor is already deactivated'
        } as MentorResponse);
        return;
      }

      // Soft delete: deactivate the associated user account
      await prisma.user.update({
        where: { id: mentor.user_id },
        data: {
          status: 'inactive',
          deactivated_at: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Mentor deactivated successfully'
      } as MentorResponse);

    } catch (error) {
      console.error('Deactivate mentor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Restore deactivated mentor - Manager/Director only
   */
  static async restoreMentor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if mentor exists
      const mentor = await prisma.mentor.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      if (!mentor) {
        res.status(404).json({
          success: false,
          message: 'Mentor not found'
        } as MentorResponse);
        return;
      }

      // Check if user is already active
      if (mentor.user.status === 'active') {
        res.status(400).json({
          success: false,
          message: 'Mentor is already active'
        } as MentorResponse);
        return;
      }

      // Restore: activate the associated user account
      await prisma.user.update({
        where: { id: mentor.user_id },
        data: {
          status: 'active',
          deactivated_at: null
        }
      });

      // Fetch updated mentor data
      const restoredMentor = await prisma.mentor.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true
            }
          },
          _count: {
            select: {
              mentor_assignments: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Mentor restored successfully',
        data: restoredMentor
      } as MentorResponse);

    } catch (error) {
      console.error('Restore mentor error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Get inactive mentors - Manager/Director only
   */
  static async getInactiveMentors(req: Request, res: Response): Promise<void> {
    try {
      const {
        search,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause for inactive mentors (users with status inactive and role mentor)
      const where: any = {
        user: {
          status: 'inactive',
          role: 'mentor'
        }
      };

      // Search filter
      if (search) {
        where.OR = [
          { expertise: { contains: search as string } },
          { user: { name: { contains: search as string } } },
          { user: { email: { contains: search as string } } }
        ];
      }

      // Get total count
      const total = await prisma.mentor.count({ where });

      // Get inactive mentors with pagination
      const mentors = await prisma.mentor.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true,
              deactivated_at: true
            }
          },
          _count: {
            select: {
              mentor_assignments: true
            }
          }
        },
        orderBy: {
          user: {
            deactivated_at: 'desc'
          }
        },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        data: { mentors },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as MentorResponse);

    } catch (error) {
      console.error('Get inactive mentors error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Assign mentor to team (Manager/Director only)
   */
  static async assignMentorToTeam(req: Request, res: Response): Promise<void> {
    try {
      console.log('=== ASSIGN MENTOR TO TEAM DEBUG ===');
      console.log('Request params:', req.params);
      console.log('Request body:', req.body);
      
      const { id } = req.params;
      const { team_id }: AssignMentorRequest = req.body;

      console.log('Extracted mentor ID:', id);
      console.log('Extracted team_id:', team_id);
      console.log('team_id type:', typeof team_id);
      console.log('team_id length:', team_id?.length);

      // Validate input
      if (!team_id) {
        console.log('ERROR: team_id is missing');
        res.status(400).json({
          success: false,
          message: 'Team ID is required'
        } as MentorResponse);
        return;
      }

      // Check if mentor exists
      console.log('Checking if mentor exists with ID:', id);
      const mentor = await prisma.mentor.findUnique({
        where: { id }
      });

      if (!mentor) {
        console.log('ERROR: Mentor not found');
        res.status(404).json({
          success: false,
          message: 'Mentor not found'
        } as MentorResponse);
        return;
      }
      console.log('Mentor found:', mentor.id);

      // Check if team exists
      console.log('Checking if team exists with ID:', team_id);
      const team = await prisma.team.findUnique({
        where: { id: team_id }
      });

      if (!team) {
        console.log('ERROR: Team not found with ID:', team_id);
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as MentorResponse);
        return;
      }
      console.log('Team found:', team.id);

      // Check if assignment already exists
      const existingAssignment = await prisma.mentorAssignment.findFirst({
        where: {
          mentor_id: id,
          team_id
        }
      });

      if (existingAssignment) {
        res.status(400).json({
          success: false,
          message: 'Mentor is already assigned to this team'
        } as MentorResponse);
        return;
      }

      // Check if mentor is already assigned to another team (one-to-one relationship)
      const mentorCurrentAssignment = await prisma.mentorAssignment.findFirst({
        where: {
          mentor_id: id
        },
        include: {
          team: {
            select: {
              team_name: true
            }
          }
        }
      });

      if (mentorCurrentAssignment) {
        res.status(400).json({
          success: false,
          message: `Mentor is already assigned to team "${mentorCurrentAssignment.team.team_name}". Each mentor can only be assigned to one team. Please remove the current assignment first.`
        } as MentorResponse);
        return;
      }

      // Check if team already has a mentor assigned (one-to-one relationship)
      const teamCurrentAssignment = await prisma.mentorAssignment.findFirst({
        where: {
          team_id
        },
        include: {
          mentor: {
            include: {
              user: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      if (teamCurrentAssignment) {
        res.status(400).json({
          success: false,
          message: `Team already has mentor "${teamCurrentAssignment.mentor.user.name}" assigned. Each team can only have one mentor. Please remove the current assignment first.`
        } as MentorResponse);
        return;
      }

      // Create assignment
      const assignment = await prisma.mentorAssignment.create({
        data: {
          mentor_id: id,
          team_id
        },
        include: {
          mentor: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Mentor assigned to team successfully',
        data: { assignment }
      } as MentorResponse);

    } catch (error) {
      console.error('Assign mentor to team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Remove mentor from team (Manager/Director only)
   */
  static async removeMentorFromTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id, teamId } = req.params;

      // Check if assignment exists
      const assignment = await prisma.mentorAssignment.findFirst({
        where: {
          mentor_id: id,
          team_id: teamId
        }
      });

      if (!assignment) {
        res.status(404).json({
          success: false,
          message: 'Mentor assignment not found'
        } as MentorResponse);
        return;
      }

      // Remove assignment
      await prisma.mentorAssignment.delete({
        where: { id: assignment.id }
      });

      res.json({
        success: true,
        message: 'Mentor removed from team successfully'
      } as MentorResponse);

    } catch (error) {
      console.error('Remove mentor from team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MentorResponse);
    }
  }

  /**
   * Get mentor assignments
   */
  static async getMentorAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if mentor exists
      const mentor = await prisma.mentor.findUnique({
        where: { id }
      });

      if (!mentor) {
        res.status(404).json({
          success: false,
          message: 'Mentor not found'
        } as MentorResponse);
        return;
      }

      // Get assignments
      const assignments = await prisma.mentorAssignment.findMany({
        where: { mentor_id: id },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true,
              status: true,
              team_members: {
                select: {
                  id: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                      email: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { assigned_at: 'desc' }
      });

      res.json({
        success: true,
        message: 'Mentor assignments retrieved successfully',
        data: { assignments }
      });

    } catch (error) {
      console.error('Get mentor assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}