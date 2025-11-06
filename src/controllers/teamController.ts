import { Request, Response } from 'express';
import { Team, TeamMember, User, Prisma } from '@prisma/client';
import prisma from '../config/database';
import emailService from '../services/emailService';
import { getTeamNotificationRecipients, getTeamLeaderEmail, getTeamMentorEmails } from '../utils/emailHelpers';

interface CreateTeamRequest {
  team_name: string;
  company_name?: string;
  credentials?: {
    email: string;
    password: string;
  };
}

interface TeamResponse {
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

export class TeamController {
  /**
   * Get all teams with role-based filtering
   */
  static async getAllTeams(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        search,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause based on user role and filters
      const where: Prisma.TeamWhereInput = {};

      // Role-based filtering
      if (req.user?.role === 'manager' || req.user?.role === 'director') {
        // Managers and Directors can see all teams
      } else if (req.user?.role === 'mentor') {
        // Mentors can only see teams assigned to them
        where.mentor_assignments = {
          some: {
            mentor: {
              user_id: req.user.userId
            }
          }
        };
      } else if (req.user?.role === 'incubator') {
        // Incubators can only see their own team
        where.team_members = {
          some: {
            user_id: req.user.userId
          }
        };
      }

      // Status filter
      if (status && status !== 'all') {
        where.status = status as any;
      }

      // Search filter
      if (search) {
        where.OR = [
          { team_name: { contains: search as string } },
          { company_name: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.team.count({ where });

      // Get teams with pagination
      const teams = await prisma.team.findMany({
        where,
        include: {
          team_members: {
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
          },
          mentor_assignments: {
            include: {
              mentor: {
                select: {
                  id: true,
                  expertise: true,
                  phone: true,
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
          },
          _count: {
            select: {
              team_members: true,
              projects: true
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
        message: 'Teams retrieved successfully',
        data: { teams },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as TeamResponse);

    } catch (error) {
      console.error('Get all teams error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TeamResponse);
    }
  }

  /**
   * Get team by ID
   */
  static async getTeamById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if user has permission to view this team
      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          team_members: {
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
          },
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
              progress: true,
              category: true
            }
          },
          mentor_assignments: {
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
              }
            }
          },
          _count: {
            select: {
              team_members: true,
              projects: true
            }
          }
        }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as TeamResponse);
        return;
      }

      // Check permissions
      if (!TeamController.canAccessTeam(req.user, team)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TeamResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Team retrieved successfully',
        data: { team }
      } as any);

    } catch (error) {
      console.error('Get team by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TeamResponse);
    }
  }

  /**
   * Create new team (Manager/Director only)
   */
  static async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const { team_name, company_name, credentials }: CreateTeamRequest = req.body;

      // Validate required fields
      if (!team_name) {
        res.status(400).json({
          success: false,
          message: 'Team name is required'
        } as TeamResponse);
        return;
      }

      // Check if team name already exists
      const existingTeam = await prisma.team.findFirst({
        where: { team_name }
      });

      if (existingTeam) {
        res.status(400).json({
          success: false,
          message: 'Team name already exists'
        } as TeamResponse);
        return;
      }

      // Create team
      const team = await prisma.team.create({
        data: {
          team_name,
          company_name,
          status: 'pending'
        },
        include: {
          team_members: {
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
          },
          _count: {
            select: {
              team_members: true,
              projects: true
            }
          }
        }
      });

      // Send team created emails
      try {
        const recipients = await getTeamNotificationRecipients(team.id, true);
        const teamLeader = team.team_members.find(m => m.role === 'team_leader');
        
        const emailPromises = recipients.map(recipient => 
          emailService.sendEmail({
            to: recipient,
            subject: 'New Team Created',
            template: 'team/team-created',
            templateData: {
              teamName: team.team_name,
              companyName: team.company_name || '',
              status: team.status.charAt(0).toUpperCase() + team.status.slice(1),
              createdDate: new Date(team.created_at).toLocaleDateString(),
              teamLeaderName: teamLeader?.user.name || '',
              teamLeaderEmail: teamLeader?.user.email || '',
              teamId: team.id,
              appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
              currentYear: new Date().getFullYear(),
              subject: 'New Team Created'
            }
          })
        );

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Failed to send team created emails:', emailError);
        // Don't fail team creation if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Team created successfully',
        data: { team }
      } as TeamResponse);

    } catch (error) {
      console.error('Create team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TeamResponse);
    }
  }

  /**
   * Update team
   */
  static async updateTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { team_name, company_name, status } = req.body;

      // Check if team exists and user has permission
      const existingTeam = await prisma.team.findUnique({
        where: { id }
      });

      if (!existingTeam) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as TeamResponse);
        return;
      }

      // Check permissions
      if (!TeamController.canModifyTeam(req.user, existingTeam)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TeamResponse);
        return;
      }

      // Check if new team name conflicts (if updating name)
      if (team_name && team_name !== existingTeam.team_name) {
        const nameConflict = await prisma.team.findFirst({
          where: {
            team_name,
            id: { not: id }
          }
        });

        if (nameConflict) {
          res.status(400).json({
            success: false,
            message: 'Team name already exists'
          } as TeamResponse);
          return;
        }
      }

      // Update team
      const team = await prisma.team.update({
        where: { id },
        data: {
          ...(team_name && { team_name }),
          ...(company_name !== undefined && { company_name }),
          ...(status && { status })
        },
        include: {
          team_members: {
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
          },
          _count: {
            select: {
              team_members: true,
              projects: true
            }
          }
        }
      });

      // Send team status update emails if status changed
      if (status && status !== existingTeam.status) {
        try {
          const recipients = await getTeamNotificationRecipients(team.id, true);
          const statusColors: Record<string, string> = {
            active: '#4CAF50',
            pending: '#ff9800',
            inactive: '#f44336'
          };

          // Status-specific messages
          const statusMessages: Record<string, string> = {
            active: 'Your team is now active! You can start working on projects and requesting resources.',
            pending: 'Your team status is pending. Please wait for approval from the management.',
            inactive: 'Your team has been marked as inactive. Please contact the management if you have any questions.'
          };

          const emailPromises = recipients.map(recipient =>
            emailService.sendEmail({
              to: recipient,
              subject: 'Team Status Updated',
              template: 'team/team-status-updated',
              templateData: {
                teamName: team.team_name,
                companyName: team.company_name || '',
                previousStatus: existingTeam.status.charAt(0).toUpperCase() + existingTeam.status.slice(1),
                newStatus: team.status.charAt(0).toUpperCase() + team.status.slice(1),
                statusColor: statusColors[team.status] || '#333',
                statusMessage: statusMessages[team.status] || 'Please check the team dashboard for more information.',
                teamId: team.id,
                appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
                currentYear: new Date().getFullYear(),
                subject: 'Team Status Updated'
              }
            })
          );

          await Promise.all(emailPromises);
        } catch (emailError) {
          console.error('Failed to send team status update emails:', emailError);
          // Don't fail team update if email fails
        }
      }

      res.json({
        success: true,
        message: 'Team updated successfully',
        data: { team }
      } as TeamResponse);

    } catch (error) {
      console.error('Update team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TeamResponse);
    }
  }

  /**
   * Delete team (Manager/Director only)
   */
  static async deleteTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if team exists
      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              team_members: true,
              projects: true
            }
          }
        }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as TeamResponse);
        return;
      }

      // Check if team has members or projects
      if (team._count.team_members > 0 || team._count.projects > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete team with existing members or projects'
        } as TeamResponse);
        return;
      }

      // Delete team
      await prisma.team.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Team deleted successfully'
      } as TeamResponse);

    } catch (error) {
      console.error('Delete team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TeamResponse);
    }
  }

  /**
   * Get team members
   */
  static async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if team exists and user has permission
      const team = await prisma.team.findUnique({
        where: { id }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as TeamResponse);
        return;
      }

      // Check permissions
      if (!TeamController.canAccessTeam(req.user, team)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TeamResponse);
        return;
      }

      // Get team members
      const teamMembers = await prisma.teamMember.findMany({
        where: { team_id: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              created_at: true
            }
          }
        },
        orderBy: { joined_at: 'asc' }
      });

      res.json({
        success: true,
        message: 'Team members retrieved successfully',
        data: { teamMembers }
      });

    } catch (error) {
      console.error('Get team members error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Add member to team (Incubator only for their team)
   */
  static async addMember(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email } = req.body;

      // Validate input
      if (!name || !email) {
        res.status(400).json({
          success: false,
          message: 'Name and email are required'
        });
        return;
      }

      // Check if team exists
      const team = await prisma.team.findUnique({
        where: { id }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Check if user is team leader of this team
      const isTeamLeader = await prisma.teamMember.findFirst({
        where: {
          team_id: id,
          user_id: req.user?.userId,
          role: 'team_leader'
        }
      });

      if (!isTeamLeader) {
        res.status(403).json({
          success: false,
          message: 'Only team leaders can add members'
        });
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
        });
        return;
      }

      // Create user (temporary password, should be changed)
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await import('../utils/password').then(m => m.PasswordUtils.hash(tempPassword));

      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password_hash: hashedPassword,
          role: 'incubator'
        }
      });

      // Add to team
      const teamMember = await prisma.teamMember.create({
        data: {
          team_id: id,
          user_id: newUser.id,
          role: 'member'
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

      // Send member added emails
      try {
        const teamLeader = await getTeamLeaderEmail(id);
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

        // Email to new member
        await emailService.sendEmail({
          to: newUser.email,
          subject: `Welcome to ${team.team_name}!`,
          template: 'team/member-added',
          templateData: {
            memberName: name,
            memberEmail: email,
            memberRole: 'Member',
            teamName: team.team_name,
            companyName: team.company_name || '',
            teamLeaderName: teamLeader ? (await prisma.user.findUnique({ where: { email: teamLeader }, select: { name: true } }))?.name : '',
            teamLeaderEmail: teamLeader || '',
            password: tempPassword,
            appUrl,
            currentYear: new Date().getFullYear(),
            subject: `Welcome to ${team.team_name}!`
          }
        });

        // Email to team leader (if exists and different from new member)
        if (teamLeader && teamLeader !== email) {
          await emailService.sendEmail({
            to: teamLeader,
            subject: `New Member Added to ${team.team_name}`,
            template: 'team/member-added',
            templateData: {
              memberName: name,
              memberEmail: email,
              memberRole: 'Member',
              teamName: team.team_name,
              companyName: team.company_name || '',
              appUrl,
              currentYear: new Date().getFullYear(),
              subject: `New Member Added to ${team.team_name}`
            }
          });
        }
      } catch (emailError) {
        console.error('Failed to send member added emails:', emailError);
        // Don't fail member addition if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Team member added successfully',
        data: { teamMember, tempPassword }
      });

    } catch (error) {
      console.error('Add team member error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Remove member from team
   */
  static async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const { id, memberId } = req.params;

      // Check if team exists
      const team = await prisma.team.findUnique({
        where: { id }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        });
        return;
      }

      // Check if user is team leader
      const isTeamLeader = await prisma.teamMember.findFirst({
        where: {
          team_id: id,
          user_id: req.user?.userId,
          role: 'team_leader'
        }
      });

      if (!isTeamLeader) {
        res.status(403).json({
          success: false,
          message: 'Only team leaders can remove members'
        });
        return;
      }

      // Check if member exists in team
      const member = await prisma.teamMember.findFirst({
        where: {
          id: memberId,
          team_id: id
        }
      });

      if (!member) {
        res.status(404).json({
          success: false,
          message: 'Member not found in this team'
        });
        return;
      }

      // Cannot remove team leader
      if (member.role === 'team_leader') {
        res.status(400).json({
          success: false,
          message: 'Cannot remove team leader'
        });
        return;
      }

      // Remove member from team
      await prisma.teamMember.delete({
        where: { id: memberId }
      });

      res.json({
        success: true,
        message: 'Team member removed successfully'
      });

    } catch (error) {
      console.error('Remove team member error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Helper method to check if user can access a team
   */
  private static canAccessTeam(user: any, team: Team): boolean {
    if (!user) return false;

    switch (user.role) {
      case 'director':
        return true;
      case 'manager':
        return true;
      case 'mentor':
        // Check if mentor is assigned to this team
        return true; // This would need to be checked against mentor_assignments
      case 'incubator':
        // Check if user is member of this team
        return true; // This would need to be checked against team_members
      default:
        return false;
    }
  }

  /**
   * Helper method to check if user can modify a team
   */
  private static canModifyTeam(user: any, team: Team): boolean {
    if (!user) return false;

    switch (user.role) {
      case 'director':
        return true;
      case 'manager':
        return true;
      case 'incubator':
        // Check if user is team leader of this team
        return true; // This would need to be checked against team_members
      default:
        return false;
    }
  }
}