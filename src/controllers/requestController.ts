import { Request, Response } from 'express';
import { MaterialRequest, Prisma } from '@prisma/client';
import prisma from '../config/database';
import emailService from '../services/emailService';
import { getManagerEmails, getTeamNotificationRecipients } from '../utils/emailHelpers';

interface CreateRequestRequest {
  item_name: string;
  description?: string;
}

interface UpdateRequestStatusRequest {
  status: 'approved' | 'declined';
  notes?: string;
}

interface RequestResponse {
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

export class RequestController {
  /**
   * Get all material requests with role-based filtering
   */
  static async getAllRequests(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause based on user role
      const where: Prisma.MaterialRequestWhereInput = {};

      // Role-based filtering
      if (req.user?.role === 'manager' || req.user?.role === 'director') {
        // Managers and Directors can see all requests
      } else if (req.user?.role === 'incubator') {
        // Incubators can only see their team's requests
        where.team = {
          team_members: {
            some: {
              user_id: req.user.userId
            }
          }
        };
      }

      // Status filter
      if (status && status !== 'all') {
        where.status = status as any;
      }

      // Get total count
      const total = await prisma.materialRequest.count({ where });

      // Get requests with pagination
      const requests = await prisma.materialRequest.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { requested_at: 'desc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Material requests retrieved successfully',
        data: { requests },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as RequestResponse);

    } catch (error) {
      console.error('Get all requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Get request by ID
   */
  static async getRequestById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const request = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true,
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
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Check permissions
      if (!RequestController.canAccessRequest(req.user, request)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Material request retrieved successfully',
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Get request by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Create new material request (Incubator only)
   */
  static async createRequest(req: Request, res: Response): Promise<void> {
    try {
      const { item_name, description }: CreateRequestRequest = req.body;

      // Validate required fields
      if (!item_name) {
        res.status(400).json({
          success: false,
          message: 'Item name is required'
        } as RequestResponse);
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
          message: 'Only team leaders can create material requests'
        } as RequestResponse);
        return;
      }

      // Create request
      const request = await prisma.materialRequest.create({
        data: {
          team_id: teamMember.team_id,
          item_name,
          description,
          requested_by: req.user!.userId
        },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Send request created emails
      try {
        const managerEmails = await getManagerEmails();
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

        const emailPromises = managerEmails.map(managerEmail =>
          emailService.sendEmail({
            to: managerEmail,
            subject: 'New Material Request Created',
            template: 'request/request-created',
            templateData: {
              itemName: request.item_name,
              description: request.description || '',
              requesterName: request.requester.name,
              requesterEmail: request.requester.email,
              teamName: request.team.team_name,
              companyName: request.team.company_name || '',
              requestedDate: new Date(request.requested_at).toLocaleDateString(),
              requestId: request.id,
              appUrl,
              currentYear: new Date().getFullYear(),
              subject: 'New Material Request Created'
            }
          })
        );

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Failed to send request created emails:', emailError);
        // Don't fail request creation if email fails
      }

      res.status(201).json({
        success: true,
        message: 'Material request created successfully',
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Create request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Update request status (Manager/Director only)
   */
  static async updateRequestStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes }: UpdateRequestStatusRequest = req.body;

      // Validate status
      if (!status || !['approved', 'declined'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Valid status (approved or declined) is required'
        } as RequestResponse);
        return;
      }

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Check if request is still pending
      if (existingRequest.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: 'Request has already been reviewed'
        } as RequestResponse);
        return;
      }

      // Update request
      const request = await prisma.materialRequest.update({
        where: { id },
        data: {
          status,
          reviewed_by: req.user?.userId,
          reviewed_at: new Date()
        },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Send request status update emails
      try {
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
        const templateName = status === 'approved' ? 'request/request-approved' : 'request/request-declined';

        // Email to requester
        await emailService.sendEmail({
          to: request.requester.email,
          subject: `Material Request ${status === 'approved' ? 'Approved' : 'Declined'}`,
          template: templateName,
          templateData: {
            requesterName: request.requester.name,
            itemName: request.item_name,
            description: request.description || '',
            teamName: request.team.team_name,
            requestedDate: new Date(request.requested_at).toLocaleDateString(),
            reviewedDate: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : '',
            reviewerName: request.reviewer?.name || 'Manager',
            notes: notes || '',
            requestId: request.id,
            appUrl,
            currentYear: new Date().getFullYear(),
            subject: `Material Request ${status === 'approved' ? 'Approved' : 'Declined'}`
          }
        });

        // Also notify team members if approved
        if (status === 'approved') {
          const teamRecipients = await getTeamNotificationRecipients(request.team_id, false);
          const teamEmailPromises = teamRecipients
            .filter(email => email !== request.requester.email) // Don't email requester again
            .map(recipient =>
              emailService.sendEmail({
                to: recipient,
                subject: 'Material Request Approved for Your Team',
                template: 'request/request-approved',
                templateData: {
                  requesterName: request.requester.name,
                  itemName: request.item_name,
                  description: request.description || '',
                  teamName: request.team.team_name,
                  requestedDate: new Date(request.requested_at).toLocaleDateString(),
                  reviewedDate: request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : '',
                  reviewerName: request.reviewer?.name || 'Manager',
                  notes: notes || '',
                  requestId: request.id,
                  appUrl,
                  currentYear: new Date().getFullYear(),
                  subject: 'Material Request Approved for Your Team'
                }
              })
            );

          await Promise.all(teamEmailPromises);
        }
      } catch (emailError) {
        console.error('Failed to send request status update emails:', emailError);
        // Don't fail request update if email fails
      }

      // If approved, we could trigger inventory assignment here
      // For now, just update the status

      res.json({
        success: true,
        message: `Material request ${status} successfully`,
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Update request status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Delete request (Manager/Director only, or team leader for their own pending requests)
   */
  static async deleteRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if request exists
      const request = await prisma.materialRequest.findUnique({
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

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Check permissions
      const canDelete = req.user?.role === 'manager' || req.user?.role === 'director' ||
        (req.user?.role === 'incubator' &&
         request.status === 'pending' &&
         request.team.team_members.some(member => member.user_id === req.user?.userId && member.role === 'team_leader'));

      if (!canDelete) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      // Delete request
      await prisma.materialRequest.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Material request deleted successfully'
      } as RequestResponse);

    } catch (error) {
      console.error('Delete request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Get requests for a specific team
   */
  static async getTeamRequests(req: Request, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if team exists
      const team = await prisma.team.findUnique({
        where: { id: teamId }
      });

      if (!team) {
        res.status(404).json({
          success: false,
          message: 'Team not found'
        } as RequestResponse);
        return;
      }

      // Check permissions
      if (!RequestController.canAccessTeamRequests(req.user, teamId)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      // Get team requests
      const requests = await prisma.materialRequest.findMany({
        where: { team_id: teamId },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { requested_at: 'desc' }
      });

      res.json({
        success: true,
        message: 'Team material requests retrieved successfully',
        data: { requests }
      });

    } catch (error) {
      console.error('Get team requests error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Helper method to check if user can access a request
   */
  private static canAccessRequest(user: any, request: any): boolean {
    if (!user) return false;

    switch (user.role) {
      case 'director':
        return true;
      case 'manager':
        return true;
      case 'incubator':
        // Check if user is member of the requesting team
        return request.team?.team_members?.some((member: any) =>
          member.user_id === user.userId
        ) || false;
      default:
        return false;
    }
  }

  /**
   * Helper method to check if user can access team requests
   */
  private static canAccessTeamRequests(user: any, teamId: string): boolean {
    if (!user) return false;

    switch (user.role) {
      case 'director':
        return true;
      case 'manager':
        return true;
      case 'incubator':
        // Check if user is member of the team
        // This would need to be checked against the database
        return true; // Simplified for now
      default:
        return false;
    }
  }
}