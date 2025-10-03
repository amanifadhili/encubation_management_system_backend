import { Request, Response } from 'express';
import { InventoryItem, InventoryAssignment, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateInventoryItemRequest {
  name: string;
  description?: string;
  total_quantity: number;
  status?: string;
}

interface UpdateInventoryItemRequest {
  name?: string;
  description?: string;
  total_quantity?: number;
  status?: string;
}

interface AssignInventoryRequest {
  team_id: string;
  quantity: number;
}

interface InventoryResponse {
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

export class InventoryController {
  /**
   * Get all inventory items with role-based filtering
   */
  static async getAllItems(req: Request, res: Response): Promise<void> {
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

      // Build where clause
      const where: Prisma.InventoryItemWhereInput = {};

      // Status filter
      if (status && status !== 'all') {
        where.status = status as any;
      }

      // Search filter
      if (search) {
        where.OR = [
          { name: { contains: search as string } },
          { description: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.inventoryItem.count({ where });

      // Get inventory items with pagination
      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          inventory_assignments: {
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true
                }
              }
            }
          },
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum
      });

      // Calculate available quantity for each item
      const itemsWithAvailability = items.map(item => {
        const assignedQuantity = item.inventory_assignments.reduce(
          (total, assignment) => total + assignment.quantity, 0
        );
        const availableQuantity = item.total_quantity - assignedQuantity;

        return {
          ...item,
          available_quantity: availableQuantity,
          assigned_quantity: assignedQuantity
        };
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Inventory items retrieved successfully',
        data: { items: itemsWithAvailability },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as InventoryResponse);

    } catch (error) {
      console.error('Get all inventory items error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Get inventory item by ID
   */
  static async getItemById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
          inventory_assignments: {
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true,
                  status: true
                }
              }
            },
            orderBy: { assigned_at: 'desc' }
          },
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as InventoryResponse);
        return;
      }

      // Calculate available quantity
      const assignedQuantity = item.inventory_assignments.reduce(
        (total, assignment) => total + assignment.quantity, 0
      );
      const availableQuantity = item.total_quantity - assignedQuantity;

      const itemWithAvailability = {
        ...item,
        available_quantity: availableQuantity,
        assigned_quantity: assignedQuantity
      };

      res.json({
        success: true,
        message: 'Inventory item retrieved successfully',
        data: { item: itemWithAvailability }
      } as InventoryResponse);

    } catch (error) {
      console.error('Get inventory item by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Create new inventory item (Manager only)
   */
  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, total_quantity, status }: CreateInventoryItemRequest = req.body;

      // Validate required fields
      if (!name || total_quantity === undefined) {
        res.status(400).json({
          success: false,
          message: 'Name and total quantity are required'
        } as InventoryResponse);
        return;
      }

      // Validate quantity
      if (total_quantity < 0) {
        res.status(400).json({
          success: false,
          message: 'Total quantity cannot be negative'
        } as InventoryResponse);
        return;
      }

      // Check if item name already exists
      const existingItem = await prisma.inventoryItem.findFirst({
        where: { name }
      });

      if (existingItem) {
        res.status(400).json({
          success: false,
          message: 'Inventory item with this name already exists'
        } as InventoryResponse);
        return;
      }

      // Create inventory item
      const item = await prisma.inventoryItem.create({
        data: {
          name,
          description,
          total_quantity,
          available_quantity: total_quantity, // Initially all available
          status: (status as any) || 'available'
        },
        include: {
          inventory_assignments: true,
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: { item }
      } as InventoryResponse);

    } catch (error) {
      console.error('Create inventory item error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Update inventory item (Manager only)
   */
  static async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, total_quantity, status }: UpdateInventoryItemRequest = req.body;

      // Check if item exists
      const existingItem = await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
          inventory_assignments: true
        }
      });

      if (!existingItem) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as InventoryResponse);
        return;
      }

      // Check if new name conflicts (if updating name)
      if (name && name !== existingItem.name) {
        const nameConflict = await prisma.inventoryItem.findFirst({
          where: {
            name,
            id: { not: id }
          }
        });

        if (nameConflict) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this name already exists'
          } as InventoryResponse);
          return;
        }
      }

      // Calculate current assigned quantity
      const assignedQuantity = existingItem.inventory_assignments.reduce(
        (total, assignment) => total + assignment.quantity, 0
      );

      // Validate new total quantity
      if (total_quantity !== undefined) {
        if (total_quantity < 0) {
          res.status(400).json({
            success: false,
            message: 'Total quantity cannot be negative'
          } as InventoryResponse);
          return;
        }

        if (total_quantity < assignedQuantity) {
          res.status(400).json({
            success: false,
            message: `Cannot reduce total quantity below currently assigned amount (${assignedQuantity})`
          } as InventoryResponse);
          return;
        }
      }

      // Update item
      const item = await prisma.inventoryItem.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(total_quantity !== undefined && { total_quantity }),
          ...(status && { status: status as any })
        },
        include: {
          inventory_assignments: {
            include: {
              team: {
                select: {
                  id: true,
                  team_name: true,
                  company_name: true
                }
              }
            }
          },
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        }
      });

      // Recalculate available quantity
      const newAssignedQuantity = item.inventory_assignments.reduce(
        (total, assignment) => total + assignment.quantity, 0
      );
      const availableQuantity = item.total_quantity - newAssignedQuantity;

      const itemWithAvailability = {
        ...item,
        available_quantity: availableQuantity,
        assigned_quantity: newAssignedQuantity
      };

      res.json({
        success: true,
        message: 'Inventory item updated successfully',
        data: { item: itemWithAvailability }
      } as InventoryResponse);

    } catch (error) {
      console.error('Update inventory item error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Delete inventory item (Manager only)
   */
  static async deleteItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if item exists
      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              inventory_assignments: true
            }
          }
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as InventoryResponse);
        return;
      }

      // Check if item has active assignments
      if (item._count.inventory_assignments > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete item with active assignments'
        } as InventoryResponse);
        return;
      }

      // Delete item
      await prisma.inventoryItem.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Inventory item deleted successfully'
      } as InventoryResponse);

    } catch (error) {
      console.error('Delete inventory item error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Assign inventory item to team (Manager only)
   */
  static async assignToTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { team_id, quantity }: AssignInventoryRequest = req.body;

      // Validate input
      if (!team_id || quantity === undefined) {
        res.status(400).json({
          success: false,
          message: 'Team ID and quantity are required'
        } as InventoryResponse);
        return;
      }

      if (quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be greater than 0'
        } as InventoryResponse);
        return;
      }

      // Check if item exists
      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
          inventory_assignments: true
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as InventoryResponse);
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
        } as InventoryResponse);
        return;
      }

      // Calculate current assigned quantity
      const currentAssigned = item.inventory_assignments.reduce(
        (total, assignment) => total + assignment.quantity, 0
      );

      // Check if enough quantity is available
      const availableQuantity = item.total_quantity - currentAssigned;
      if (quantity > availableQuantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient quantity available. Only ${availableQuantity} items available.`
        } as InventoryResponse);
        return;
      }

      // Create assignment
      const assignment = await prisma.inventoryAssignment.create({
        data: {
          item_id: id,
          team_id,
          quantity
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              total_quantity: true
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
        message: 'Inventory item assigned to team successfully',
        data: { assignment }
      } as InventoryResponse);

    } catch (error) {
      console.error('Assign inventory to team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Unassign inventory item from team (Manager only)
   */
  static async unassignFromTeam(req: Request, res: Response): Promise<void> {
    try {
      const { id, teamId } = req.params;

      // Find the assignment
      const assignment = await prisma.inventoryAssignment.findFirst({
        where: {
          item_id: id,
          team_id: teamId
        }
      });

      if (!assignment) {
        res.status(404).json({
          success: false,
          message: 'Assignment not found'
        } as InventoryResponse);
        return;
      }

      // Delete assignment
      await prisma.inventoryAssignment.delete({
        where: { id: assignment.id }
      });

      res.json({
        success: true,
        message: 'Inventory item unassigned from team successfully'
      } as InventoryResponse);

    } catch (error) {
      console.error('Unassign inventory from team error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as InventoryResponse);
    }
  }

  /**
   * Get inventory assignments for an item
   */
  static async getItemAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if item exists
      const item = await prisma.inventoryItem.findUnique({
        where: { id }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as InventoryResponse);
        return;
      }

      // Get assignments
      const assignments = await prisma.inventoryAssignment.findMany({
        where: { item_id: id },
        include: {
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true,
              status: true
            }
          }
        },
        orderBy: { assigned_at: 'desc' }
      });

      res.json({
        success: true,
        message: 'Inventory assignments retrieved successfully',
        data: { assignments }
      });

    } catch (error) {
      console.error('Get inventory assignments error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}