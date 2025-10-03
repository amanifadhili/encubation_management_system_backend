import { Request, Response } from 'express';
import { Mentor, User, Team, Prisma } from '@prisma/client';
import prisma from '../config/database';

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

      // Build where clause
      const where: Prisma.MentorWhereInput = {};

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

      // Create user account for mentor
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await import('../utils/password').then(m => m.PasswordUtils.hash(tempPassword));

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
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

      res.status(201).json({
        success: true,
        message: 'Mentor created successfully',
        data: { mentor, tempPassword }
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
   * Delete mentor (Manager/Director only)
   */
  static async deleteMentor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if mentor exists
      const mentor = await prisma.mentor.findUnique({
        where: { id },
        include: {
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

      // Check if mentor has active assignments
      if (mentor._count.mentor_assignments > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete mentor with active team assignments'
        } as MentorResponse);
        return;
      }

      // Delete mentor record
      await prisma.mentor.delete({
        where: { id }
      });

      // Delete associated user account
      await prisma.user.delete({
        where: { id: mentor.user_id }
      });

      res.json({
        success: true,
        message: 'Mentor deleted successfully'
      } as MentorResponse);

    } catch (error) {
      console.error('Delete mentor error:', error);
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
      const { id } = req.params;
      const { team_id }: AssignMentorRequest = req.body;

      // Validate input
      if (!team_id) {
        res.status(400).json({
          success: false,
          message: 'Team ID is required'
        } as MentorResponse);
        return;
      }

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

      // Check if team exists
      const team = await prisma.team.findUnique({
        where: { id: team_id }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as MentorResponse);
        return;
      }

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