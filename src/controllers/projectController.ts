import { Request, Response } from 'express';
import { Project, ProjectFile, User, Prisma } from '@prisma/client';
import prisma from '../config/database';
import emailService from '../services/emailService';
import { getTeamNotificationRecipients, getTeamMentorEmails } from '../utils/emailHelpers';

interface CreateProjectRequest {
  name: string;
  description: string; // Required
  category: string;
  status?: string;
  startup_company_name?: string; // Optional
  status_at_enrollment: string; // Required
  challenge_description: string; // Required
}

interface UpdateProjectRequest {
  name?: string;
  description?: string;
  category?: string;
  status?: string;
  progress?: number;
  startup_company_name?: string;
  status_at_enrollment?: string;
  challenge_description?: string;
}

interface ProjectResponse {
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

export class ProjectController {
  /**
   * Get all projects with role-based filtering
   */
  static async getAllProjects(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        status,
        team_id,
        search,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause based on user role and filters
      const where: Prisma.ProjectWhereInput = {};

      // Role-based filtering
      if (req.user?.role === 'manager') {
        // Managers can see all projects
      } else if (req.user?.role === 'mentor') {
        // Mentors can only see projects from teams assigned to them
        where.team = {
          mentor_assignments: {
            some: {
              mentor: {
                user_id: req.user.userId
              }
            }
          }
        };
      } else if (req.user?.role === 'incubator') {
        // Incubators can only see their own team's projects
        where.team = {
          team_members: {
            some: {
              user_id: req.user.userId
            }
          }
        };
      }

      // Additional filters
      if (category && category !== 'all') {
        where.category = category as any;
      }

      if (status && status !== 'all') {
        where.status = status as any;
      }

      if (team_id) {
        where.team_id = team_id as string;
      }

      // Search filter - include new fields in search
      if (search) {
        where.OR = [
          { name: { contains: search as string } },
          { description: { contains: search as string } },
          { startup_company_name: { contains: search as string } },
          { challenge_description: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.project.count({ where });

      // Get projects with pagination
      const projects = await prisma.project.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true,
              status: true
            }
          },
          _count: {
            select: {
              project_files: true
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
        message: 'Projects retrieved successfully',
        data: { projects },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as ProjectResponse);

    } catch (error) {
      console.error('Get all projects error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ProjectResponse);
    }
  }

  /**
   * Get project by ID
   */
  static async getProjectById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true,
              status: true,
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
              }
            }
          },
          project_files: {
            orderBy: { uploaded_at: 'desc' }
          },
          _count: {
            select: {
              project_files: true
            }
          }
        }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        } as ProjectResponse);
        return;
      }

      // Check permissions
      if (!ProjectController.canAccessProject(req.user, project)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as ProjectResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Project retrieved successfully',
        data: { project }
      } as ProjectResponse);

    } catch (error) {
      console.error('Get project by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ProjectResponse);
    }
  }

  /**
   * Create new project (Incubator only)
   */
  static async createProject(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, category, status, startup_company_name, status_at_enrollment, challenge_description }: CreateProjectRequest = req.body;

      // Validate required fields
      if (!name || !category || !status_at_enrollment || !description || !challenge_description) {
        res.status(400).json({
          success: false,
          message: 'Project name, category, status at enrollment, description, and challenge description are required',
          code: 'MISSING_REQUIRED_FIELDS',
          errors: [
            !name && { field: 'name', message: 'Project name is required' },
            !category && { field: 'category', message: 'Category is required' },
            !status_at_enrollment && { field: 'status_at_enrollment', message: 'Status at enrollment is required' },
            !description && { field: 'description', message: 'Project description is required' },
            !challenge_description && { field: 'challenge_description', message: 'Challenge/problem description is required' }
          ].filter(Boolean)
        } as ProjectResponse);
        return;
      }

      // Check if user is incubator and get their team
      const teamMember = await prisma.teamMember.findFirst({
        where: {
          user_id: req.user?.userId,
          role: 'team_leader'
        }
      });

      if (!teamMember) {
        res.status(403).json({
          success: false,
          message: 'Only team leaders can create projects',
          code: 'INSUFFICIENT_PERMISSIONS'
        } as ProjectResponse);
        return;
      }

      // Create project
      const project = await prisma.project.create({
        data: {
          name,
          description,
          category: category as any,
          status: (status as any) || 'pending',
          progress: 0,
          team_id: teamMember.team_id,
          startup_company_name: startup_company_name || null,
          status_at_enrollment: status_at_enrollment ? (status_at_enrollment as any) : null,
          challenge_description: challenge_description || null
        },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          }
        }
      });

      // Send project created emails
      try {
        const recipients = await getTeamNotificationRecipients(project.team_id, true);
        const mentors = await getTeamMentorEmails(project.team_id);
        
        // Get mentor info if exists
        let mentorName = '';
        let mentorEmail = '';
        if (mentors.length > 0) {
          const mentorUser = await prisma.user.findUnique({
            where: { email: mentors[0] },
            select: { name: true, email: true }
          });
          if (mentorUser) {
            mentorName = mentorUser.name;
            mentorEmail = mentorUser.email;
          }
        }

        const statusColors: Record<string, string> = {
          active: '#4CAF50',
          pending: '#ff9800',
          completed: '#2196F3',
          on_hold: '#f44336'
        };

        const emailPromises = recipients.map(recipient =>
          emailService.sendEmail({
            to: recipient,
            subject: 'New Project Created',
            template: 'project/project-created',
            templateData: {
              projectName: project.name,
              description: project.description || '',
              category: project.category,
              status: project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' '),
              teamName: project.team.team_name,
              mentorName: mentorName || '',
              mentorEmail: mentorEmail || '',
              createdDate: new Date(project.created_at).toLocaleDateString(),
              projectId: project.id,
              appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
              currentYear: new Date().getFullYear(),
              subject: 'New Project Created'
            }
          })
        );

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Failed to send project created emails:', emailError);
        // Don't fail project creation if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: { project }
      } as ProjectResponse);

    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      } as ProjectResponse);
    }
  }

  /**
   * Update project
   */
  static async updateProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, category, status, progress, startup_company_name, status_at_enrollment, challenge_description }: UpdateProjectRequest = req.body;

      // Check if project exists
      const existingProject = await prisma.project.findUnique({
        where: { id },
        include: {
          team: {
            select: {
              team_members: {
                where: {
                  user_id: req.user?.userId
                }
              }
            }
          }
        }
      });

      if (!existingProject) {
        res.status(404).json({
          success: false,
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        } as ProjectResponse);
        return;
      }

      // Check permissions
      if (!ProjectController.canModifyProject(req.user, existingProject)) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        } as ProjectResponse);
        return;
      }

      // Validate progress
      if (progress !== undefined && (progress < 0 || progress > 100)) {
        res.status(422).json({
          success: false,
          message: 'Progress must be between 0 and 100',
          code: 'INVALID_PROGRESS_VALUE'
        } as ProjectResponse);
        return;
      }

      // Update project
      const project = await prisma.project.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(category && { category: category as any }),
          ...(status && { status: status as any }),
          ...(progress !== undefined && { progress }),
          ...(startup_company_name !== undefined && { startup_company_name: startup_company_name || null }),
          ...(status_at_enrollment !== undefined && { status_at_enrollment: status_at_enrollment ? (status_at_enrollment as any) : null }),
          ...(challenge_description !== undefined && { challenge_description: challenge_description || null })
        },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          }
        }
      });

      // Send project update emails if any significant changes
      const hasSignificantChange = name || status || progress !== undefined || description !== undefined || category;
      if (hasSignificantChange) {
        try {
          const recipients = await getTeamNotificationRecipients(project.team_id, true);
          const statusColors: Record<string, string> = {
            active: '#4CAF50',
            pending: '#ff9800',
            completed: '#2196F3',
            on_hold: '#f44336'
          };

          const emailPromises = recipients.map(recipient =>
            emailService.sendEmail({
              to: recipient,
              subject: 'Project Updated',
              template: 'project/project-updated',
              templateData: {
                projectName: project.name,
                updatedName: name || project.name,
                updatedDescription: description !== undefined ? description : project.description || '',
                updatedCategory: category ? category : project.category,
                updatedStatus: status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' '),
                updatedProgress: progress !== undefined ? progress : project.progress,
                statusColor: statusColors[project.status] || '#333',
                projectId: project.id,
                appUrl: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
                currentYear: new Date().getFullYear(),
                subject: 'Project Updated'
              }
            })
          );

          await Promise.all(emailPromises);
        } catch (emailError) {
          console.error('Failed to send project update emails:', emailError);
          // Don't fail project update if email fails
        }
      }

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: { project }
      } as ProjectResponse);

    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      } as ProjectResponse);
    }
  }

  /**
   * Delete project
   */
  static async deleteProject(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if project exists
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          team: {
            select: {
              team_members: {
                where: {
                  user_id: req.user?.userId
                }
              }
            }
          },
          _count: {
            select: {
              project_files: true
            }
          }
        }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        } as ProjectResponse);
        return;
      }

      // Check permissions
      if (!ProjectController.canModifyProject(req.user, project)) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        } as ProjectResponse);
        return;
      }

      // Delete associated files first (if any cleanup needed)
      // Note: File cleanup would be handled by a separate service

      // Delete project
      await prisma.project.delete({
        where: { id }
      });

      res.status(204).send();

    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      } as ProjectResponse);
    }
  }

  /**
   * Get project files
   */
  static async getProjectFiles(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if project exists and user has permission
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          team: {
            select: {
              team_members: {
                where: {
                  user_id: req.user?.userId
                }
              }
            }
          }
        }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        } as ProjectResponse);
        return;
      }

      // Check permissions
      if (!ProjectController.canAccessProject(req.user, project)) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        } as ProjectResponse);
        return;
      }

      // Get project files
      const files = await prisma.projectFile.findMany({
        where: { project_id: id },
        orderBy: { uploaded_at: 'desc' }
      });

      res.json({
        success: true,
        message: 'Project files retrieved successfully',
        data: { files }
      });

    } catch (error) {
      console.error('Get project files error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Upload project file
   */
  static async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const file = (req as any).file;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded',
          code: 'NO_FILE_UPLOADED'
        } as ProjectResponse);
        return;
      }

      // Check if project exists and user has permission
      const project = await prisma.project.findUnique({
        where: { id },
        include: {
          team: {
            select: {
              team_members: {
                where: {
                  user_id: req.user?.userId
                }
              }
            }
          }
        }
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found',
          code: 'PROJECT_NOT_FOUND'
        } as ProjectResponse);
        return;
      }

      // Check permissions
      if (!ProjectController.canModifyProject(req.user, project)) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'INSUFFICIENT_PERMISSIONS'
        } as ProjectResponse);
        return;
      }

      // Create file record
      const projectFile = await prisma.projectFile.create({
        data: {
          project_id: id,
          file_name: file.originalname,
          file_path: file.path, // This would be the actual file path after upload
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_by: req.user!.userId
        }
      });

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: { file: projectFile }
      });

    } catch (error) {
      console.error('Upload file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Delete project file
   */
  static async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const { id, fileId } = req.params;

      // Check if file exists and belongs to project
      const file = await prisma.projectFile.findFirst({
        where: {
          id: fileId,
          project_id: id
        },
        include: {
          project: {
            include: {
              team: {
                select: {
                  team_members: {
                    where: {
                      user_id: req.user?.userId
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!file) {
        res.status(404).json({
          success: false,
          message: 'File not found',
          code: 'FILE_NOT_FOUND'
        } as ProjectResponse);
        return;
      }

      // Check permissions
      if (!ProjectController.canModifyProject(req.user, file.project)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as ProjectResponse);
        return;
      }

      // Delete file record
      await prisma.projectFile.delete({
        where: { id: fileId }
      });

      // TODO: Delete actual file from storage

      res.status(204).send();

    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Helper method to check if user can access a project
   */
  private static canAccessProject(user: any, project: any): boolean {
    if (!user) return false;

    switch (user.role) {
      case 'director':
        return true;
      case 'manager':
        return true;
      case 'mentor':
        // Check if mentor is assigned to the project's team
        return project.team?.mentor_assignments?.some((assignment: any) =>
          assignment.mentor.user_id === user.userId
        ) || false;
      case 'incubator':
        // Check if user is member of the project's team
        return project.team?.team_members?.some((member: any) =>
          member.user_id === user.userId
        ) || false;
      default:
        return false;
    }
  }

  /**
   * Helper method to check if user can modify a project
   */
  private static canModifyProject(user: any, project: any): boolean {
    if (!user) return false;

    switch (user.role) {
      case 'director':
        return true;
      case 'manager':
        return true;
      case 'incubator':
        // Check if user is team leader of the project's team
        return project.team?.team_members?.some((member: any) =>
          member.user_id === user.userId && member.role === 'team_leader'
        ) || false;
      default:
        return false;
    }
  }
}