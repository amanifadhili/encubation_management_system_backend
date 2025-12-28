import { Request, Response } from 'express';
import { InventoryItem, InventoryAssignment, Prisma, ItemCategory, ItemType, ItemCondition, InventoryStatus } from '@prisma/client';
import prisma from '../config/database';
import emailService from '../services/emailService';
import { getTeamNotificationRecipients } from '../utils/emailHelpers';

interface CreateInventoryItemRequest {
  name: string;
  description?: string;
  category?: ItemCategory;
  item_type?: ItemType;
  tags?: string[];
  sku?: string;
  barcode?: string;
  serial_number?: string;
  total_quantity: number;
  condition?: ItemCondition;
  status?: InventoryStatus;
  location_id?: string;
  supplier_id?: string;
  purchase_date?: string;
  expiration_date?: string;
  batch_number?: string;
  warranty_start?: string;
  warranty_end?: string;
  warranty_provider?: string;
  maintenance_interval?: number;
  is_frequently_distributed?: boolean;
  distribution_unit?: string;
  typical_consumption_rate?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  custom_fields?: any;
  notes?: string;
}

interface UpdateInventoryItemRequest {
  name?: string;
  description?: string;
  category?: ItemCategory;
  item_type?: ItemType;
  tags?: string[];
  sku?: string;
  barcode?: string;
  serial_number?: string;
  total_quantity?: number;
  condition?: ItemCondition;
  status?: InventoryStatus;
  location_id?: string;
  supplier_id?: string;
  purchase_date?: string;
  expiration_date?: string;
  batch_number?: string;
  warranty_start?: string;
  warranty_end?: string;
  warranty_provider?: string;
  maintenance_interval?: number;
  is_frequently_distributed?: boolean;
  distribution_unit?: string;
  typical_consumption_rate?: number;
  min_stock_level?: number;
  reorder_quantity?: number;
  custom_fields?: any;
  notes?: string;
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
          { description: { contains: search as string } },
          { sku: { contains: search as string } },
          { barcode: { contains: search as string } },
          { serial_number: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.inventoryItem.count({ where });

      // Get inventory items with pagination
      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contact_person: true
            }
          },
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
              inventory_assignments: true,
              consumption_logs: true
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
          location: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contact_person: true,
              email: true,
              phone: true
            }
          },
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
              inventory_assignments: true,
              consumption_logs: true
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
   * Create new inventory item (Manager/Director only)
   */
  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        category,
        item_type,
        tags,
        sku,
        barcode,
        serial_number,
        total_quantity,
        condition,
        status,
        location_id,
        supplier_id,
        purchase_date,
        expiration_date,
        batch_number,
        warranty_start,
        warranty_end,
        warranty_provider,
        maintenance_interval,
        is_frequently_distributed,
        distribution_unit,
        typical_consumption_rate,
        min_stock_level,
        reorder_quantity,
        custom_fields,
        notes
      }: CreateInventoryItemRequest = req.body;

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

      // Check for unique fields conflicts
      if (sku) {
        const existingSku = await prisma.inventoryItem.findUnique({ where: { sku } });
        if (existingSku) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this SKU already exists'
          } as InventoryResponse);
          return;
        }
      }

      if (barcode) {
        const existingBarcode = await prisma.inventoryItem.findUnique({ where: { barcode } });
        if (existingBarcode) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this barcode already exists'
          } as InventoryResponse);
          return;
        }
      }

      if (serial_number) {
        const existingSerial = await prisma.inventoryItem.findUnique({ where: { serial_number } });
        if (existingSerial) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this serial number already exists'
          } as InventoryResponse);
          return;
        }
      }

      // Validate location if provided
      if (location_id) {
        const location = await prisma.storageLocation.findUnique({ where: { id: location_id } });
        if (!location) {
          res.status(400).json({
            success: false,
            message: 'Storage location not found'
          } as InventoryResponse);
          return;
        }
      }

      // Validate supplier if provided
      if (supplier_id) {
        const supplier = await prisma.supplier.findUnique({ where: { id: supplier_id } });
        if (!supplier) {
          res.status(400).json({
            success: false,
            message: 'Supplier not found'
          } as InventoryResponse);
          return;
        }
      }

      // Prepare data object
      const itemData: any = {
          name,
          description,
        category: category || 'Other',
        item_type: item_type || 'Consumable',
          total_quantity,
        available_quantity: total_quantity,
        condition: condition || 'Good',
        status: status || 'available'
      };

      // Add optional fields if provided
      if (tags) itemData.tags = tags;
      if (sku) itemData.sku = sku;
      if (barcode) itemData.barcode = barcode;
      if (serial_number) itemData.serial_number = serial_number;
      if (location_id) itemData.location_id = location_id;
      if (supplier_id) itemData.supplier_id = supplier_id;
      if (purchase_date) itemData.purchase_date = new Date(purchase_date);
      if (expiration_date) itemData.expiration_date = new Date(expiration_date);
      if (batch_number) itemData.batch_number = batch_number;
      if (warranty_start) itemData.warranty_start = new Date(warranty_start);
      if (warranty_end) itemData.warranty_end = new Date(warranty_end);
      if (warranty_provider) itemData.warranty_provider = warranty_provider;
      if (maintenance_interval !== undefined) itemData.maintenance_interval = maintenance_interval;
      if (is_frequently_distributed !== undefined) itemData.is_frequently_distributed = is_frequently_distributed;
      if (distribution_unit) itemData.distribution_unit = distribution_unit;
      if (typical_consumption_rate !== undefined) itemData.typical_consumption_rate = typical_consumption_rate;
      if (min_stock_level !== undefined) itemData.min_stock_level = min_stock_level;
      if (reorder_quantity !== undefined) itemData.reorder_quantity = reorder_quantity;
      if (custom_fields) itemData.custom_fields = custom_fields;
      if (notes) itemData.notes = notes;

      // Create inventory item
      const item = await prisma.inventoryItem.create({
        data: itemData,
        include: {
          location: true,
          supplier: true,
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
   * Update inventory item (Manager/Director only)
   */
  static async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        category,
        item_type,
        tags,
        sku,
        barcode,
        serial_number,
        total_quantity,
        condition,
        status,
        location_id,
        supplier_id,
        purchase_date,
        expiration_date,
        batch_number,
        warranty_start,
        warranty_end,
        warranty_provider,
        maintenance_interval,
        is_frequently_distributed,
        distribution_unit,
        typical_consumption_rate,
        min_stock_level,
        reorder_quantity,
        custom_fields,
        notes
      }: UpdateInventoryItemRequest = req.body;

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

      // Check for unique fields conflicts
      if (sku && sku !== existingItem.sku) {
        const existingSku = await prisma.inventoryItem.findUnique({ where: { sku } });
        if (existingSku) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this SKU already exists'
          } as InventoryResponse);
          return;
        }
      }

      if (barcode && barcode !== existingItem.barcode) {
        const existingBarcode = await prisma.inventoryItem.findUnique({ where: { barcode } });
        if (existingBarcode) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this barcode already exists'
          } as InventoryResponse);
          return;
        }
      }

      if (serial_number && serial_number !== existingItem.serial_number) {
        const existingSerial = await prisma.inventoryItem.findUnique({ where: { serial_number } });
        if (existingSerial) {
          res.status(400).json({
            success: false,
            message: 'Inventory item with this serial number already exists'
          } as InventoryResponse);
          return;
        }
      }

      // Validate location if provided
      if (location_id !== undefined) {
        if (location_id) {
          const location = await prisma.storageLocation.findUnique({ where: { id: location_id } });
          if (!location) {
            res.status(400).json({
              success: false,
              message: 'Storage location not found'
            } as InventoryResponse);
            return;
          }
        }
      }

      // Validate supplier if provided
      if (supplier_id !== undefined) {
        if (supplier_id) {
          const supplier = await prisma.supplier.findUnique({ where: { id: supplier_id } });
          if (!supplier) {
            res.status(400).json({
              success: false,
              message: 'Supplier not found'
            } as InventoryResponse);
            return;
          }
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

      // Prepare update data object
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (item_type !== undefined) updateData.item_type = item_type;
      if (tags !== undefined) updateData.tags = tags;
      if (sku !== undefined) updateData.sku = sku;
      if (barcode !== undefined) updateData.barcode = barcode;
      if (serial_number !== undefined) updateData.serial_number = serial_number;
      if (total_quantity !== undefined) {
        updateData.total_quantity = total_quantity;
        updateData.available_quantity = total_quantity - assignedQuantity;
      }
      if (condition !== undefined) updateData.condition = condition;
      if (status !== undefined) updateData.status = status;
      if (location_id !== undefined) updateData.location_id = location_id;
      if (supplier_id !== undefined) updateData.supplier_id = supplier_id;
      if (purchase_date !== undefined) updateData.purchase_date = purchase_date ? new Date(purchase_date) : null;
      if (expiration_date !== undefined) updateData.expiration_date = expiration_date ? new Date(expiration_date) : null;
      if (batch_number !== undefined) updateData.batch_number = batch_number;
      if (warranty_start !== undefined) updateData.warranty_start = warranty_start ? new Date(warranty_start) : null;
      if (warranty_end !== undefined) updateData.warranty_end = warranty_end ? new Date(warranty_end) : null;
      if (warranty_provider !== undefined) updateData.warranty_provider = warranty_provider;
      if (maintenance_interval !== undefined) updateData.maintenance_interval = maintenance_interval;
      if (is_frequently_distributed !== undefined) updateData.is_frequently_distributed = is_frequently_distributed;
      if (distribution_unit !== undefined) updateData.distribution_unit = distribution_unit;
      if (typical_consumption_rate !== undefined) updateData.typical_consumption_rate = typical_consumption_rate;
      if (min_stock_level !== undefined) updateData.min_stock_level = min_stock_level;
      if (reorder_quantity !== undefined) updateData.reorder_quantity = reorder_quantity;
      if (custom_fields !== undefined) updateData.custom_fields = custom_fields;
      if (notes !== undefined) updateData.notes = notes;

      // Update item
      const item = await prisma.inventoryItem.update({
        where: { id },
        data: updateData,
        include: {
          location: true,
          supplier: true,
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
   * Delete inventory item (Manager/Director only)
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
   * Assign inventory item to team (Manager/Director only)
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
          quantity,
          assigned_by: req.user!.userId
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              description: true,
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

      // Send inventory assignment emails
      try {
        const recipients = await getTeamNotificationRecipients(team_id, false);
        const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
        
        // Get assigned by user info
        const assignedByUser = await prisma.user.findUnique({
          where: { id: req.user!.userId },
          select: { name: true }
        });

        const emailPromises = recipients.map(recipient =>
          emailService.sendEmail({
            to: recipient,
            subject: 'Inventory Item Assigned to Your Team',
            template: 'inventory/inventory-assigned',
            templateData: {
              itemName: assignment.item.name,
              itemDescription: assignment.item.description || '',
              quantity: quantity.toString(),
              teamName: assignment.team.team_name,
              companyName: assignment.team.company_name || '',
              assignedDate: new Date(assignment.assigned_at).toLocaleDateString(),
              assignedBy: assignedByUser?.name || 'Manager',
              appUrl,
              currentYear: new Date().getFullYear(),
              subject: 'Inventory Item Assigned to Your Team'
            }
          })
        );

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Failed to send inventory assignment emails:', emailError);
        // Don't fail assignment if email fails
      }

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
   * Unassign inventory item from team (Manager/Director only)
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