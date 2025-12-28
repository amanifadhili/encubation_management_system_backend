import { Request, Response } from 'express';
import { MaterialRequest, Prisma, RequestPriority, RequestStatus, DeliveryStatus } from '@prisma/client';
import prisma from '../config/database';
import emailService from '../services/emailService';
import { getManagerEmails, getTeamNotificationRecipients } from '../utils/emailHelpers';

interface RequestItemInput {
  inventory_item_id?: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  is_consumable?: boolean;
}

interface CreateRequestRequest {
  title: string;
  description?: string;
  priority?: RequestPriority;
  urgency_reason?: string;
  project_id?: string;
  required_by?: string;
  is_consumable_request?: boolean;
  requires_quick_approval?: boolean;
  delivery_address?: string;
  delivery_notes?: string;
  expected_delivery?: string;
  notes?: string;
  internal_notes?: string;
  items: RequestItemInput[];
  approval_chain?: string[]; // Array of approver user IDs
}

interface UpdateRequestRequest {
  title?: string;
  description?: string;
  priority?: RequestPriority;
  urgency_reason?: string;
  project_id?: string;
  required_by?: string;
  delivery_address?: string;
  delivery_notes?: string;
  expected_delivery?: string;
  notes?: string;
  internal_notes?: string;
  items?: RequestItemInput[];
}

interface UpdateRequestStatusRequest {
  status: RequestStatus;
  notes?: string;
  comments?: string;
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
          project: {
            select: {
              id: true,
              name: true
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
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          items: {
            include: {
              inventory_item: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  available_quantity: true
                }
              }
            }
          },
          _count: {
            select: {
              items: true,
              comments: true,
              attachments: true
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
          project: {
            select: {
              id: true,
              name: true
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
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          items: {
            include: {
              inventory_item: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  available_quantity: true,
                  status: true
                }
              }
            }
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { created_at: 'asc' }
          },
          attachments: {
            include: {
              uploader: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: { uploaded_at: 'desc' }
          },
          history: {
            include: {
              performer: {
                select: {
                  id: true,
                  name: true
                }
              }
            },
            orderBy: { performed_at: 'desc' }
          },
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              delegate: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { approval_level: 'asc' }
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
      const {
        title,
        description,
        priority,
        urgency_reason,
        project_id,
        required_by,
        is_consumable_request,
        requires_quick_approval,
        delivery_address,
        delivery_notes,
        expected_delivery,
        notes,
        internal_notes,
        items,
        approval_chain
      }: CreateRequestRequest = req.body;

      // Validate required fields
      if (!title) {
        res.status(400).json({
          success: false,
          message: 'Title is required'
        } as RequestResponse);
        return;
      }

      if (!items || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one item is required'
        } as RequestResponse);
        return;
      }

      // Validate items
      for (const item of items) {
        if (!item.item_name || item.quantity === undefined || item.quantity <= 0) {
          res.status(400).json({
            success: false,
            message: 'Each item must have a name and valid quantity'
          } as RequestResponse);
          return;
        }

        // If inventory_item_id is provided, verify it exists
        if (item.inventory_item_id) {
          const inventoryItem = await prisma.inventoryItem.findUnique({
            where: { id: item.inventory_item_id }
          });
          if (!inventoryItem) {
            res.status(400).json({
              success: false,
              message: `Inventory item ${item.inventory_item_id} not found`
            } as RequestResponse);
            return;
          }
        }
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

      // Validate project if provided
      if (project_id) {
        const project = await prisma.project.findUnique({
          where: { id: project_id }
        });
        if (!project || project.team_id !== teamMember.team_id) {
          res.status(400).json({
            success: false,
            message: 'Project not found or does not belong to your team'
          } as RequestResponse);
          return;
        }
      }

      // Generate request number
      const requestNumber = await RequestController.generateRequestNumber();

      // Determine initial status - if requires_quick_approval, go directly to pending_review
      const initialStatus: RequestStatus = requires_quick_approval ? 'submitted' : 'draft';

      // Create request with items in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create request
        const request = await tx.materialRequest.create({
          data: {
            request_number: requestNumber,
            approval_chain: approval_chain ? approval_chain as any : null,
            team_id: teamMember.team_id,
            project_id: project_id || null,
            title,
            description,
            priority: priority || 'Medium',
            urgency_reason,
            status: initialStatus,
            is_consumable_request: is_consumable_request || false,
            requires_quick_approval: requires_quick_approval || false,
            required_by: required_by ? new Date(required_by) : null,
            delivery_address,
            delivery_notes,
            expected_delivery: expected_delivery ? new Date(expected_delivery) : null,
            notes,
            internal_notes,
            requested_by: req.user!.userId,
            delivery_status: 'not_ordered'
          },
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            team: {
              select: {
                id: true,
                team_name: true,
                company_name: true
              }
            },
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        // Create request items
        const requestItems = await Promise.all(
          items.map(item =>
            tx.requestItem.create({
              data: {
                request_id: request.id,
                inventory_item_id: item.inventory_item_id || null,
                item_name: item.item_name,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                notes: item.notes,
                is_consumable: item.is_consumable || false,
                status: 'pending'
              },
              include: {
                inventory_item: {
                  select: {
                    id: true,
                    name: true,
                    category: true,
                    available_quantity: true
                  }
                }
              }
            })
          )
        );

        // Create request history entry
        await RequestController.createRequestHistory(
          request.id,
          'created',
          req.user!.userId,
          null,
          { status: initialStatus, title, items_count: items.length }
        );

        // Create approval chain entries if provided
        if (approval_chain && approval_chain.length > 0) {
          await Promise.all(
            approval_chain.map((approverId, index) =>
              tx.requestApproval.create({
                data: {
                  request_id: request.id,
                  approver_id: approverId,
                  approval_level: index + 1,
                  status: index === 0 ? 'pending' : 'pending'
                }
              })
            )
          );
        }

        return { request, items: requestItems };
      });

      const request = result.request;

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
              requestNumber: request.request_number,
              title: request.title,
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

      // Return full request with items
      const fullRequest = await prisma.materialRequest.findUnique({
        where: { id: request.id },
        include: {
          team: true,
          project: true,
          requester: true,
          items: {
            include: {
              inventory_item: true
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
              requestNumber: request.request_number,
              title: request.title,
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
        data: { request: fullRequest }
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
      const validStatuses: RequestStatus[] = ['submitted', 'pending_review', 'approved', 'partially_approved', 'declined', 'cancelled', 'ordered', 'in_transit', 'delivered', 'completed', 'returned'];
      if (!status || !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Valid status is required'
        } as RequestResponse);
        return;
      }

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          items: true
        }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Store old status for history
      const oldStatus = existingRequest.status;

      // Determine which timestamp fields to update based on status
      const updateData: any = {
        status,
        reviewed_by: req.user?.userId
      };

      // Update appropriate timestamp based on status
      if (status === 'approved' || status === 'partially_approved') {
        updateData.approved_at = new Date();
        updateData.approved_by = req.user?.userId;
        if (!existingRequest.reviewed_at) {
          updateData.reviewed_at = new Date();
        }
      } else if (status === 'declined') {
        if (!existingRequest.reviewed_at) {
          updateData.reviewed_at = new Date();
        }
      } else if (status === 'ordered') {
        updateData.ordered_at = new Date();
        updateData.delivery_status = 'ordered';
      } else if (status === 'in_transit') {
        updateData.delivery_status = 'in_transit';
      } else if (status === 'delivered') {
        updateData.delivered_at = new Date();
        updateData.delivery_status = 'delivered';
      } else if (status === 'completed') {
        updateData.completed_at = new Date();
      }

      // Update request
      const request = await prisma.materialRequest.update({
        where: { id },
        data: updateData,
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
            requestNumber: request.request_number,
            title: request.title,
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
                  requestNumber: request.request_number,
                  title: request.title,
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

      // If approved, trigger auto-assignment and consumption recording
      if (status === 'approved' || status === 'partially_approved') {
        await RequestController.processApprovedRequest(request.id, request.team_id, req.user!.userId);
      }

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
         (request.status === 'draft' || request.status === 'submitted') &&
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

  /**
   * Generate unique request number: REQ-YYYY-XXXX
   */
  private static async generateRequestNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REQ-${year}-`;

    // Get the last request number for this year
    const lastRequest = await prisma.materialRequest.findFirst({
      where: {
        request_number: {
          startsWith: prefix
        }
      },
      orderBy: {
        request_number: 'desc'
      }
    });

    let sequence = 1;
    if (lastRequest && lastRequest.request_number) {
      const lastSequence = parseInt(lastRequest.request_number.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    // Format with leading zeros (4 digits)
    const sequenceStr = sequence.toString().padStart(4, '0');
    return `${prefix}${sequenceStr}`;
  }

  /**
   * Create request history entry for audit trail
   */
  private static async createRequestHistory(
    requestId: string,
    action: string,
    performedBy: string,
    oldValue?: any,
    newValue?: any,
    notes?: string
  ): Promise<void> {
    try {
      await prisma.requestHistory.create({
        data: {
          request_id: requestId,
          action,
          performed_by: performedBy,
          old_value: oldValue ? oldValue : null,
          new_value: newValue ? newValue : null,
          notes
        }
      });
    } catch (error) {
      console.error('Failed to create request history:', error);
      // Don't throw - history is not critical for request operations
    }
  }

  /**
   * Add comment to request
   */
  static async addComment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { comment, is_internal } = req.body;

      if (!comment) {
        res.status(400).json({
          success: false,
          message: 'Comment is required'
        } as RequestResponse);
        return;
      }

      // Check if request exists
      const request = await prisma.materialRequest.findUnique({
        where: { id }
      });

      if (!request) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Check permissions - internal comments only for managers/directors
      if (is_internal && req.user?.role !== 'manager' && req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Only managers and directors can add internal comments'
        } as RequestResponse);
        return;
      }

      // Create comment
      const requestComment = await prisma.requestComment.create({
        data: {
          request_id: id,
          user_id: req.user!.userId,
          comment,
          is_internal: is_internal || false
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'commented',
        req.user!.userId,
        null,
        { comment_id: requestComment.id, is_internal: is_internal || false }
      );

      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: { comment: requestComment }
      } as RequestResponse);

    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Get comments for a request
   */
  static async getComments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if request exists
      const request = await prisma.materialRequest.findUnique({
        where: { id }
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

      // Get comments - filter internal comments based on role
      const where: Prisma.RequestCommentWhereInput = {
        request_id: id
      };

      // Non-managers/directors can't see internal comments
      if (req.user?.role !== 'manager' && req.user?.role !== 'director') {
        where.is_internal = false;
      }

      const comments = await prisma.requestComment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { created_at: 'asc' }
      });

      res.json({
        success: true,
        message: 'Comments retrieved successfully',
        data: { comments }
      } as RequestResponse);

    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Update comment (only by author or manager/director)
   */
  static async updateComment(req: Request, res: Response): Promise<void> {
    try {
      const { id, commentId } = req.params;
      const { comment } = req.body;

      if (!comment) {
        res.status(400).json({
          success: false,
          message: 'Comment is required'
        } as RequestResponse);
        return;
      }

      // Check if comment exists
      const existingComment = await prisma.requestComment.findUnique({
        where: { id: commentId },
        include: {
          request: true
        }
      });

      if (!existingComment || existingComment.request_id !== id) {
        res.status(404).json({
          success: false,
          message: 'Comment not found'
        } as RequestResponse);
        return;
      }

      // Check permissions - only author or manager/director can update
      if (existingComment.user_id !== req.user?.userId && 
          req.user?.role !== 'manager' && 
          req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      // Update comment
      const updatedComment = await prisma.requestComment.update({
        where: { id: commentId },
        data: { comment },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'comment_updated',
        req.user!.userId,
        { comment_id: commentId, old_comment: existingComment.comment },
        { comment_id: commentId, new_comment: comment }
      );

      res.json({
        success: true,
        message: 'Comment updated successfully',
        data: { comment: updatedComment }
      } as RequestResponse);

    } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Delete comment (only by author or manager/director)
   */
  static async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const { id, commentId } = req.params;

      // Check if comment exists
      const existingComment = await prisma.requestComment.findUnique({
        where: { id: commentId }
      });

      if (!existingComment || existingComment.request_id !== id) {
        res.status(404).json({
          success: false,
          message: 'Comment not found'
        } as RequestResponse);
        return;
      }

      // Check permissions - only author or manager/director can delete
      if (existingComment.user_id !== req.user?.userId && 
          req.user?.role !== 'manager' && 
          req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      // Delete comment
      await prisma.requestComment.delete({
        where: { id: commentId }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'comment_deleted',
        req.user!.userId,
        { comment_id: commentId },
        null
      );

      res.json({
        success: true,
        message: 'Comment deleted successfully'
      } as RequestResponse);

    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Submit request (change status from draft to submitted)
   */
  static async submitRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          items: true,
          approvals: true
        }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Check permissions - only requester can submit
      if (existingRequest.requested_by !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'Only the requester can submit the request'
        } as RequestResponse);
        return;
      }

      // Check if request is in draft status
      if (existingRequest.status !== 'draft') {
        res.status(400).json({
          success: false,
          message: 'Only draft requests can be submitted'
        } as RequestResponse);
        return;
      }

      // Validate request has items
      if (!existingRequest.items || existingRequest.items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Request must have at least one item before submission'
        } as RequestResponse);
        return;
      }

      // Determine next status based on approval chain
      let nextStatus: RequestStatus = 'pending_review';
      if (existingRequest.requires_quick_approval) {
        nextStatus = 'submitted';
      } else if (existingRequest.approvals && existingRequest.approvals.length > 0) {
        nextStatus = 'pending_review';
      }

      // Update request status
      const request = await prisma.materialRequest.update({
        where: { id },
        data: {
          status: nextStatus
        },
        include: {
          team: true,
          requester: true,
          items: {
            include: {
              inventory_item: true
            }
          }
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'submitted',
        req.user!.userId,
        { status: 'draft' },
        { status: nextStatus }
      );

      // Send notification emails
      try {
        const managerEmails = await getManagerEmails();
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

        const emailPromises = managerEmails.map(managerEmail =>
          emailService.sendEmail({
            to: managerEmail,
            subject: 'Material Request Submitted',
            template: 'request/request-submitted',
            templateData: {
              requestNumber: request.request_number,
              title: request.title,
              requesterName: request.requester.name,
              teamName: request.team.team_name,
              appUrl,
              currentYear: new Date().getFullYear(),
              subject: 'Material Request Submitted'
            }
          })
        );

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Failed to send submission emails:', emailError);
      }

      res.json({
        success: true,
        message: 'Request submitted successfully',
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Submit request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Cancel request (by requester or manager/director)
   */
  static async cancelRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

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

      // Check permissions - requester or manager/director can cancel
      const canCancel = existingRequest.requested_by === req.user?.userId ||
                        req.user?.role === 'manager' ||
                        req.user?.role === 'director';

      if (!canCancel) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      // Check if request can be cancelled (not already completed/delivered)
      const nonCancellableStatuses: RequestStatus[] = ['completed', 'delivered', 'cancelled'];
      if (nonCancellableStatuses.includes(existingRequest.status)) {
        res.status(400).json({
          success: false,
          message: `Cannot cancel request with status: ${existingRequest.status}`
        } as RequestResponse);
        return;
      }

      // Update request status
      const request = await prisma.materialRequest.update({
        where: { id },
        data: {
          status: 'cancelled'
        },
        include: {
          team: true,
          requester: true
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'cancelled',
        req.user!.userId,
        { status: existingRequest.status },
        { status: 'cancelled' },
        reason
      );

      res.json({
        success: true,
        message: 'Request cancelled successfully',
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Cancel request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Approve request at a specific approval level
   */
  static async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approval_level, comments } = req.body;

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          approvals: {
            orderBy: { approval_level: 'asc' }
          },
          items: true
        }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Find the approval entry for this level
      const approvalLevel = approval_level || 1;
      const approval = existingRequest.approvals.find(a => a.approval_level === approvalLevel);

      if (!approval) {
        res.status(400).json({
          success: false,
          message: `Approval level ${approvalLevel} not found for this request`
        } as RequestResponse);
        return;
      }

      // Check if this user is the approver or delegate
      if (approval.approver_id !== req.user?.userId && approval.delegated_to !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to approve at this level'
        } as RequestResponse);
        return;
      }

      // Check if approval is already processed
      if (approval.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: `Approval level ${approvalLevel} has already been processed`
        } as RequestResponse);
        return;
      }

      // Check if previous levels are approved (if not first level)
      if (approvalLevel > 1) {
        const previousApprovals = existingRequest.approvals.filter(
          a => a.approval_level < approvalLevel
        );
        const allPreviousApproved = previousApprovals.every(a => a.status === 'approved');
        
        if (!allPreviousApproved) {
          res.status(400).json({
            success: false,
            message: 'Previous approval levels must be approved first'
          } as RequestResponse);
          return;
        }
      }

      // Update approval status
      await prisma.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
          approved_at: new Date(),
          comments
        }
      });

      // Check if this is the last approval level
      const totalLevels = existingRequest.approvals.length;
      const isLastLevel = approvalLevel === totalLevels;

      // Determine new request status
      let newStatus: RequestStatus = existingRequest.status;
      if (isLastLevel) {
        // All approvals complete - mark as approved
        newStatus = 'approved';
      } else {
        // Move to next approval level
        newStatus = 'pending_review';
      }

      // Update request status and set current approver
      const nextApproval = existingRequest.approvals.find(a => a.approval_level === approvalLevel + 1);
      const updateData: any = {
        status: newStatus,
        approved_by: req.user!.userId,
        approved_at: isLastLevel ? new Date() : undefined
      };

      if (nextApproval) {
        updateData.current_approver = nextApproval.approver_id;
      }

      const request = await prisma.materialRequest.update({
        where: { id },
        data: updateData,
        include: {
          team: true,
          requester: true,
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { approval_level: 'asc' }
          },
          items: {
            include: {
              inventory_item: true
            }
          }
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'approval_approved',
        req.user!.userId,
        { approval_level, status: 'pending' },
        { approval_level, status: 'approved', request_status: newStatus },
        comments
      );

      // If fully approved, auto-assign inventory items and handle consumables
      if (isLastLevel && newStatus === 'approved') {
        await RequestController.processApprovedRequest(request.id, request.team_id, req.user!.userId);
      }

      // Send notification emails
      try {
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
        
        // Email to requester
        await emailService.sendEmail({
          to: request.requester.email,
          subject: isLastLevel ? 'Material Request Approved' : `Material Request - Approval Level ${approvalLevel} Approved`,
          template: 'request/request-approved',
          templateData: {
            requesterName: request.requester.name,
            requestNumber: request.request_number,
            title: request.title,
            teamName: request.team.team_name,
            approvalLevel,
            isFinalApproval: isLastLevel,
            appUrl,
            currentYear: new Date().getFullYear(),
            subject: isLastLevel ? 'Material Request Approved' : `Approval Level ${approvalLevel} Approved`
          }
        });

        // If not last level, notify next approver
        if (!isLastLevel && nextApproval) {
          const nextApprover = await prisma.user.findUnique({
            where: { id: nextApproval.approver_id }
          });

          if (nextApprover) {
            await emailService.sendEmail({
              to: nextApprover.email,
              subject: 'Material Request Pending Your Approval',
              template: 'request/request-pending-approval',
              templateData: {
                approverName: nextApprover.name,
                requestNumber: request.request_number,
                title: request.title,
                approvalLevel: approvalLevel + 1,
                appUrl,
                currentYear: new Date().getFullYear(),
                subject: 'Material Request Pending Your Approval'
              }
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send approval emails:', emailError);
      }

      res.json({
        success: true,
        message: isLastLevel ? 'Request fully approved' : `Approval level ${approvalLevel} approved`,
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Approve request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Decline request at a specific approval level
   */
  static async declineRequest(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approval_level, comments } = req.body;

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          approvals: {
            orderBy: { approval_level: 'asc' }
          }
        }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Find the approval entry for this level
      const approvalLevel = approval_level || 1;
      const approval = existingRequest.approvals.find(a => a.approval_level === approvalLevel);

      if (!approval) {
        res.status(400).json({
          success: false,
          message: `Approval level ${approvalLevel} not found for this request`
        } as RequestResponse);
        return;
      }

      // Check if this user is the approver or delegate
      if (approval.approver_id !== req.user?.userId && approval.delegated_to !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to decline at this level'
        } as RequestResponse);
        return;
      }

      // Check if approval is already processed
      if (approval.status !== 'pending') {
        res.status(400).json({
          success: false,
          message: `Approval level ${approvalLevel} has already been processed`
        } as RequestResponse);
        return;
      }

      // Update approval status
      await prisma.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: 'declined',
          approved_at: new Date(),
          comments
        }
      });

      // Update request status to declined
      const request = await prisma.materialRequest.update({
        where: { id },
        data: {
          status: 'declined',
          reviewed_by: req.user!.userId,
          reviewed_at: new Date()
        },
        include: {
          team: true,
          requester: true,
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            },
            orderBy: { approval_level: 'asc' }
          }
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'approval_declined',
        req.user!.userId,
        { approval_level, status: 'pending' },
        { approval_level, status: 'declined', request_status: 'declined' },
        comments
      );

      // Send notification emails
      try {
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
        
        // Email to requester
        await emailService.sendEmail({
          to: request.requester.email,
          subject: 'Material Request Declined',
          template: 'request/request-declined',
          templateData: {
            requesterName: request.requester.name,
            requestNumber: request.request_number,
            title: request.title,
            teamName: request.team.team_name,
            approvalLevel,
            comments: comments || '',
            appUrl,
            currentYear: new Date().getFullYear(),
            subject: 'Material Request Declined'
          }
        });
      } catch (emailError) {
        console.error('Failed to send decline emails:', emailError);
      }

      res.json({
        success: true,
        message: 'Request declined',
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Decline request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Delegate approval to another user
   */
  static async delegateApproval(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approval_level, delegate_to, comments } = req.body;

      if (!delegate_to) {
        res.status(400).json({
          success: false,
          message: 'Delegate user ID is required'
        } as RequestResponse);
        return;
      }

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          approvals: {
            orderBy: { approval_level: 'asc' }
          }
        }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Find the approval entry for this level
      const approvalLevel = approval_level || 1;
      const approval = existingRequest.approvals.find(a => a.approval_level === approvalLevel);

      if (!approval) {
        res.status(400).json({
          success: false,
          message: `Approval level ${approvalLevel} not found for this request`
        } as RequestResponse);
        return;
      }

      // Check if this user is the approver
      if (approval.approver_id !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to delegate this approval'
        } as RequestResponse);
        return;
      }

      // Verify delegate exists and is a manager/director
      const delegate = await prisma.user.findUnique({
        where: { id: delegate_to }
      });

      if (!delegate || (delegate.role !== 'manager' && delegate.role !== 'director')) {
        res.status(400).json({
          success: false,
          message: 'Delegate must be a manager or director'
        } as RequestResponse);
        return;
      }

      // Update approval with delegate
      await prisma.requestApproval.update({
        where: { id: approval.id },
        data: {
          status: 'delegated',
          delegated_to: delegate_to,
          comments
        }
      });

      // Update request current_approver
      await prisma.materialRequest.update({
        where: { id },
        data: {
          current_approver: delegate_to
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'approval_delegated',
        req.user!.userId,
        { approval_level, approver_id: approval.approver_id },
        { approval_level, delegated_to: delegate_to },
        comments
      );

      // Send notification to delegate
      try {
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
        
        await emailService.sendEmail({
          to: delegate.email,
          subject: 'Approval Delegated to You',
          template: 'request/approval-delegated',
          templateData: {
            delegateName: delegate.name,
            requestNumber: existingRequest.request_number,
            title: existingRequest.title,
            approvalLevel,
            appUrl,
            currentYear: new Date().getFullYear(),
            subject: 'Approval Delegated to You'
          }
        });
      } catch (emailError) {
        console.error('Failed to send delegation email:', emailError);
      }

      res.json({
        success: true,
        message: 'Approval delegated successfully',
        data: { 
          approval_level,
          delegated_to: delegate_to,
          delegate_name: delegate.name
        }
      } as RequestResponse);

    } catch (error) {
      console.error('Delegate approval error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }

  /**
   * Process approved request: auto-assign inventory items and record consumption
   */
  private static async processApprovedRequest(
    requestId: string,
    teamId: string,
    performedBy: string
  ): Promise<void> {
    try {
      // Get the full request with items
      const request = await prisma.materialRequest.findUnique({
        where: { id: requestId },
        include: {
          items: {
            include: {
              inventory_item: true
            }
          },
          team: true
        }
      });

      if (!request || !request.items) {
        return;
      }

      // Process each approved item
      for (const requestItem of request.items) {
        if (requestItem.inventory_item_id && requestItem.status === 'pending') {
          const inventoryItem = requestItem.inventory_item;
          if (!inventoryItem) continue;

          // Check if item is a consumable/refreshment
          const isConsumable = request.is_consumable_request || 
                               requestItem.is_consumable ||
                               inventoryItem.category === 'Refreshments' ||
                               inventoryItem.category === 'Consumables' ||
                               inventoryItem.is_frequently_distributed;

          if (isConsumable) {
            // For consumables: record consumption instead of assignment
            try {
              await prisma.$transaction(async (tx) => {
                // Get current item state
                const currentItem = await tx.inventoryItem.findUnique({
                  where: { id: inventoryItem.id }
                });
                if (!currentItem) return;

                // Create consumption log
                await tx.consumptionLog.create({
                  data: {
                    item_id: inventoryItem.id,
                    team_id: teamId,
                    quantity: requestItem.quantity,
                    unit: requestItem.unit || inventoryItem.distribution_unit,
                    distributed_by: performedBy,
                    distributed_to: request.team.team_name,
                    consumption_type: request.requires_quick_approval ? 'quick_request' : 'standard_request',
                    notes: `Auto-recorded from approved request ${request.request_number}`
                  }
                });

                // Update item quantities
                const newAvailable = currentItem.available_quantity - requestItem.quantity;
                await tx.inventoryItem.update({
                  where: { id: inventoryItem.id },
                  data: {
                    available_quantity: newAvailable,
                    consumed_quantity: {
                      increment: requestItem.quantity
                    }
                  }
                });

                // Create transaction record
                await tx.inventoryTransaction.create({
                  data: {
                    item_id: inventoryItem.id,
                    transaction_type: 'consume',
                    quantity: requestItem.quantity,
                    previous_quantity: currentItem.available_quantity,
                    new_quantity: newAvailable,
                    performed_by: performedBy,
                    notes: `Auto-consumption from approved request ${request.request_number}`
                  }
                });

                // Update request item status
                await tx.requestItem.update({
                  where: { id: requestItem.id },
                  data: {
                    status: 'distributed',
                    distributed_quantity: requestItem.quantity,
                    distribution_date: new Date()
                  }
                });
              });
            } catch (consumptionError) {
              console.error(`Failed to record consumption for item ${inventoryItem.id}:`, consumptionError);
              // Continue with other items
            }
          } else {
            // For non-consumables: create inventory assignment
            try {
              // Get current item state with assignments
              const currentItem = await prisma.inventoryItem.findUnique({
                where: { id: inventoryItem.id },
                include: {
                  inventory_assignments: true
                }
              });
              if (!currentItem) continue;

              // Check availability using available_quantity field (which should be maintained)
              const availableQuantity = currentItem.available_quantity;

              if (availableQuantity >= requestItem.quantity) {
                await prisma.$transaction(async (tx) => {
                  // Get fresh item state within transaction
                  const itemInTx = await tx.inventoryItem.findUnique({
                    where: { id: inventoryItem.id }
                  });
                  if (!itemInTx) return;

                  // Create assignment
                  await tx.inventoryAssignment.create({
                    data: {
                      item_id: inventoryItem.id,
                      team_id: teamId,
                      quantity: requestItem.quantity,
                      assigned_by: performedBy,
                      status: 'active'
                    }
                  });

                  // Update item quantities
                  const newAvailable = itemInTx.available_quantity - requestItem.quantity;
                  await tx.inventoryItem.update({
                    where: { id: inventoryItem.id },
                    data: {
                      available_quantity: newAvailable
                    }
                  });

                  // Create transaction record
                  await tx.inventoryTransaction.create({
                    data: {
                      item_id: inventoryItem.id,
                      transaction_type: 'assign',
                      quantity: requestItem.quantity,
                      previous_quantity: itemInTx.available_quantity,
                      new_quantity: newAvailable,
                      performed_by: performedBy,
                      notes: `Auto-assignment from approved request ${request.request_number}`
                    }
                  });

                  // Update request item status
                  await tx.requestItem.update({
                    where: { id: requestItem.id },
                    data: {
                      status: 'approved',
                      approved_quantity: requestItem.quantity
                    }
                  });
                });
              } else {
                // Insufficient quantity - mark as partially approved if possible
                if (availableQuantity > 0) {
                  await prisma.requestItem.update({
                    where: { id: requestItem.id },
                    data: {
                      status: 'approved',
                      approved_quantity: availableQuantity,
                      notes: `Partially approved: Only ${availableQuantity} available (requested ${requestItem.quantity})`
                    }
                  });
                } else {
                  await prisma.requestItem.update({
                    where: { id: requestItem.id },
                    data: {
                      status: 'declined',
                      notes: 'Insufficient quantity available'
                    }
                  });
                }
              }
            } catch (assignmentError) {
              console.error(`Failed to assign item ${inventoryItem.id}:`, assignmentError);
              // Continue with other items
            }
          }
        } else if (!requestItem.inventory_item_id) {
          // Item not in inventory - just update status to approved
          await prisma.requestItem.update({
            where: { id: requestItem.id },
            data: {
              status: 'approved',
              approved_quantity: requestItem.quantity
            }
          });
        }
      }

      // Update request item statuses if all processed
      const updatedRequest = await prisma.materialRequest.findUnique({
        where: { id: requestId },
        include: { items: true }
      });

      if (updatedRequest) {
        const allItemsProcessed = updatedRequest.items.every(
          item => item.status !== 'pending'
        );

        if (allItemsProcessed) {
          await prisma.materialRequest.update({
            where: { id: requestId },
            data: {
              status: updatedRequest.items.some(item => item.status === 'declined') 
                ? 'partially_approved' 
                : 'approved'
            }
          });
        }
      }

    } catch (error) {
      console.error('Error processing approved request:', error);
      // Don't throw - we don't want to fail the approval if auto-assignment fails
    }
  }

  /**
   * Update delivery status and confirm delivery
   */
  static async updateDeliveryStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { delivery_status, delivered_at, delivery_notes } = req.body;

      // Validate delivery status
      const validStatuses: DeliveryStatus[] = ['not_ordered', 'ordered', 'in_transit', 'delivered', 'delayed', 'cancelled'];
      if (!delivery_status || !validStatuses.includes(delivery_status)) {
        res.status(400).json({
          success: false,
          message: 'Valid delivery status is required'
        } as RequestResponse);
        return;
      }

      // Check if request exists
      const existingRequest = await prisma.materialRequest.findUnique({
        where: { id },
        include: {
          team: true,
          requester: true
        }
      });

      if (!existingRequest) {
        res.status(404).json({
          success: false,
          message: 'Material request not found'
        } as RequestResponse);
        return;
      }

      // Only managers/directors can update delivery status
      if (req.user?.role !== 'manager' && req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as RequestResponse);
        return;
      }

      // Prepare update data
      const updateData: any = {
        delivery_status
      };

      // Update delivery timestamp if delivered
      if (delivery_status === 'delivered') {
        updateData.delivered_at = delivered_at ? new Date(delivered_at) : new Date();
        updateData.status = 'delivered';
        
        // Update request items status to delivered
        await prisma.requestItem.updateMany({
          where: { request_id: id },
          data: { status: 'delivered' }
        });
      } else if (delivery_status === 'ordered') {
        updateData.ordered_at = new Date();
        updateData.status = 'ordered';
      } else if (delivery_status === 'in_transit') {
        updateData.status = 'in_transit';
      }

      // Update delivery notes if provided
      if (delivery_notes !== undefined) {
        updateData.delivery_notes = delivery_notes;
      }

      // Update request
      const request = await prisma.materialRequest.update({
        where: { id },
        data: updateData,
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
          items: {
            include: {
              inventory_item: {
                select: {
                  id: true,
                  name: true,
                  category: true
                }
              }
            }
          }
        }
      });

      // Create history entry
      await RequestController.createRequestHistory(
        id,
        'delivery_status_changed',
        req.user!.userId,
        existingRequest.delivery_status,
        delivery_status,
        `Delivery status updated to ${delivery_status}${delivery_notes ? ': ' + delivery_notes : ''}`
      );

      // Send notification email if delivered
      if (delivery_status === 'delivered') {
        try {
          const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
          await emailService.sendEmail({
            to: request.requester.email,
            subject: 'Material Request Delivered',
            template: 'request/request-delivered',
            templateData: {
              requesterName: request.requester.name,
              requestNumber: request.request_number,
              title: request.title,
              teamName: request.team.team_name,
              deliveredDate: updateData.delivered_at ? new Date(updateData.delivered_at).toLocaleDateString() : new Date().toLocaleDateString(),
              deliveryNotes: delivery_notes || '',
              appUrl,
              currentYear: new Date().getFullYear(),
              subject: 'Material Request Delivered'
            }
          });
        } catch (emailError) {
          console.error('Failed to send delivery email:', emailError);
        }
      }

      res.json({
        success: true,
        message: 'Delivery status updated successfully',
        data: { request }
      } as RequestResponse);

    } catch (error) {
      console.error('Update delivery status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as RequestResponse);
    }
  }
}