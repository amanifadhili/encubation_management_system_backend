import { Request, Response } from 'express';
import { RequestTemplate, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateTemplateRequest {
  name: string;
  description?: string;
  category?: string;
  items: any[]; // Array of template items
  is_public?: boolean;
}

interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  items?: any[];
  is_public?: boolean;
}

interface TemplateResponse {
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

export class RequestTemplateController {
  /**
   * Get all request templates with pagination and filters
   */
  static async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const {
        category,
        search,
        is_public,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.RequestTemplateWhereInput = {};

      // Public/private filter
      if (is_public === 'true') {
        where.is_public = true;
      } else if (is_public === 'false') {
        // Show user's private templates
        where.is_public = false;
        where.created_by = req.user!.userId;
      } else {
        // Show public templates and user's own templates
        where.OR = [
          { is_public: true },
          { created_by: req.user!.userId }
        ];
      }

      // Category filter
      if (category) {
        where.category = category as string;
      }

      // Search filter
      if (search) {
        where.OR = [
          { name: { contains: search as string } },
          { description: { contains: search as string } },
          { category: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.requestTemplate.count({ where });

      // Get templates with pagination
      const templates = await prisma.requestTemplate.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
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
        message: 'Request templates retrieved successfully',
        data: { templates },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as TemplateResponse);

    } catch (error) {
      console.error('Get all templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TemplateResponse);
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const template = await prisma.requestTemplate.findUnique({
        where: { id },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Request template not found'
        } as TemplateResponse);
        return;
      }

      // Check permissions - can view if public or if creator
      if (!template.is_public && template.created_by !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TemplateResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Request template retrieved successfully',
        data: { template }
      } as TemplateResponse);

    } catch (error) {
      console.error('Get template by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TemplateResponse);
    }
  }

  /**
   * Create new request template
   */
  static async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        category,
        items,
        is_public
      }: CreateTemplateRequest = req.body;

      // Validate required fields
      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Name is required'
        } as TemplateResponse);
        return;
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one item is required'
        } as TemplateResponse);
        return;
      }

      // Validate items structure
      for (const item of items) {
        if (!item.item_name || item.quantity === undefined || item.quantity <= 0) {
          res.status(400).json({
            success: false,
            message: 'Each item must have a name and valid quantity'
          } as TemplateResponse);
          return;
        }
      }

      // Check if template with same name already exists for this user
      const existingTemplate = await prisma.requestTemplate.findFirst({
        where: {
          name,
          created_by: req.user!.userId
        }
      });

      if (existingTemplate) {
        res.status(400).json({
          success: false,
          message: 'You already have a template with this name'
        } as TemplateResponse);
        return;
      }

      // Create template
      const template = await prisma.requestTemplate.create({
        data: {
          name,
          description,
          category,
          items: items as any, // Store as JSON
          is_public: is_public || false,
          created_by: req.user!.userId
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Request template created successfully',
        data: { template }
      } as TemplateResponse);

    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TemplateResponse);
    }
  }

  /**
   * Update request template (only by creator or manager/director)
   */
  static async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        category,
        items,
        is_public
      }: UpdateTemplateRequest = req.body;

      // Check if template exists
      const existingTemplate = await prisma.requestTemplate.findUnique({
        where: { id }
      });

      if (!existingTemplate) {
        res.status(404).json({
          success: false,
          message: 'Request template not found'
        } as TemplateResponse);
        return;
      }

      // Check permissions - only creator or manager/director can update
      if (existingTemplate.created_by !== req.user?.userId &&
          req.user?.role !== 'manager' &&
          req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TemplateResponse);
        return;
      }

      // Validate items if provided
      if (items !== undefined) {
        if (!Array.isArray(items) || items.length === 0) {
          res.status(400).json({
            success: false,
            message: 'At least one item is required'
          } as TemplateResponse);
          return;
        }

        for (const item of items) {
          if (!item.item_name || item.quantity === undefined || item.quantity <= 0) {
            res.status(400).json({
              success: false,
              message: 'Each item must have a name and valid quantity'
            } as TemplateResponse);
            return;
          }
        }
      }

      // Check if new name conflicts (if updating name)
      if (name && name !== existingTemplate.name) {
        const nameConflict = await prisma.requestTemplate.findFirst({
          where: {
            name,
            created_by: existingTemplate.created_by,
            id: { not: id }
          }
        });

        if (nameConflict) {
          res.status(400).json({
            success: false,
            message: 'You already have a template with this name'
          } as TemplateResponse);
          return;
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (items !== undefined) updateData.items = items as any;
      if (is_public !== undefined) updateData.is_public = is_public;

      // Update template
      const template = await prisma.requestTemplate.update({
        where: { id },
        data: updateData,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Request template updated successfully',
        data: { template }
      } as TemplateResponse);

    } catch (error) {
      console.error('Update template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TemplateResponse);
    }
  }

  /**
   * Delete request template (only by creator or manager/director)
   */
  static async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if template exists
      const template = await prisma.requestTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Request template not found'
        } as TemplateResponse);
        return;
      }

      // Check permissions - only creator or manager/director can delete
      if (template.created_by !== req.user?.userId &&
          req.user?.role !== 'manager' &&
          req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TemplateResponse);
        return;
      }

      // Delete template
      await prisma.requestTemplate.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Request template deleted successfully'
      } as TemplateResponse);

    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TemplateResponse);
    }
  }

  /**
   * Create request from template
   */
  static async createRequestFromTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        team_id,
        project_id,
        priority,
        urgency_reason,
        required_by,
        delivery_address,
        delivery_notes,
        expected_delivery,
        notes,
        approval_chain
      } = req.body;

      // Get template
      const template = await prisma.requestTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        res.status(404).json({
          success: false,
          message: 'Request template not found'
        } as TemplateResponse);
        return;
      }

      // Check permissions - can use if public or if creator
      if (!template.is_public && template.created_by !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as TemplateResponse);
        return;
      }

      // Get user's team if team_id not provided
      let finalTeamId = team_id;
      if (!finalTeamId) {
        const teamMember = await prisma.teamMember.findFirst({
          where: {
            user_id: req.user?.userId,
            role: 'team_leader'
          }
        });

        if (!teamMember) {
          res.status(403).json({
            success: false,
            message: 'Only team leaders can create requests. Please provide a team_id or ensure you are a team leader.'
          } as TemplateResponse);
          return;
        }

        finalTeamId = teamMember.team_id;
      }

      // Import RequestController to use its createRequest logic
      // For now, we'll return the template data so the frontend can create the request
      // In a full implementation, we could call the createRequest logic here

      res.json({
        success: true,
        message: 'Template data retrieved successfully',
        data: {
          template,
          requestData: {
            title: template.name,
            description: template.description,
            priority: priority || 'Medium',
            urgency_reason,
            project_id,
            required_by,
            delivery_address,
            delivery_notes,
            expected_delivery,
            notes,
            approval_chain,
            items: template.items
          }
        }
      } as TemplateResponse);

    } catch (error) {
      console.error('Create request from template error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as TemplateResponse);
    }
  }
}
