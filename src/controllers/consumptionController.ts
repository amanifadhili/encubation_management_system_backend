import { Request, Response } from 'express';
import { ConsumptionLog, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateConsumptionLogRequest {
  item_id: string;
  team_id?: string;
  quantity: number;
  unit?: string;
  distributed_to?: string;
  consumption_date?: string;
  consumption_type?: string;
  notes?: string;
}

interface UpdateConsumptionLogRequest {
  quantity?: number;
  unit?: string;
  distributed_to?: string;
  consumption_date?: string;
  consumption_type?: string;
  notes?: string;
}

interface ConsumptionLogResponse {
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

export class ConsumptionController {
  /**
   * Get all consumption logs with pagination and filters
   */
  static async getAllConsumptionLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        consumption_type,
        start_date,
        end_date,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.ConsumptionLogWhereInput = {};

      // Item filter
      if (item_id) {
        where.item_id = item_id as string;
      }

      // Team filter
      if (team_id) {
        where.team_id = team_id as string;
      }

      // Consumption type filter
      if (consumption_type) {
        where.consumption_type = consumption_type as string;
      }

      // Date range filter
      if (start_date || end_date) {
        where.consumption_date = {};
        if (start_date) {
          where.consumption_date.gte = new Date(start_date as string);
        }
        if (end_date) {
          where.consumption_date.lte = new Date(end_date as string);
        }
      }

      // Get total count
      const total = await prisma.consumptionLog.count({ where });

      // Get consumption logs with pagination
      const logs = await prisma.consumptionLog.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              distribution_unit: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          distributor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { consumption_date: 'desc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Consumption logs retrieved successfully',
        data: { logs },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as ConsumptionLogResponse);

    } catch (error) {
      console.error('Get all consumption logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ConsumptionLogResponse);
    }
  }

  /**
   * Get consumption log by ID
   */
  static async getConsumptionLogById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const log = await prisma.consumptionLog.findUnique({
        where: { id },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              distribution_unit: true,
              available_quantity: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          distributor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!log) {
        res.status(404).json({
          success: false,
          message: 'Consumption log not found'
        } as ConsumptionLogResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Consumption log retrieved successfully',
        data: { log }
      } as ConsumptionLogResponse);

    } catch (error) {
      console.error('Get consumption log by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ConsumptionLogResponse);
    }
  }

  /**
   * Create new consumption log (Manager/Director only)
   */
  static async createConsumptionLog(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        quantity,
        unit,
        distributed_to,
        consumption_date,
        consumption_type,
        notes
      }: CreateConsumptionLogRequest = req.body;

      // Validate required fields
      if (!item_id || quantity === undefined) {
        res.status(400).json({
          success: false,
          message: 'Item ID and quantity are required'
        } as ConsumptionLogResponse);
        return;
      }

      // Validate quantity
      if (quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be greater than 0'
        } as ConsumptionLogResponse);
        return;
      }

      // Check if item exists and is a consumable/refreshment
      const item = await prisma.inventoryItem.findUnique({
        where: { id: item_id }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as ConsumptionLogResponse);
        return;
      }

      // Validate team if provided
      if (team_id) {
        const team = await prisma.team.findUnique({
          where: { id: team_id }
        });

        if (!team) {
          res.status(404).json({
            success: false,
            message: 'Team not found'
          } as ConsumptionLogResponse);
          return;
        }
      }

      // Check if sufficient quantity is available
      if (quantity > item.available_quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient quantity available. Only ${item.available_quantity} items available.`
        } as ConsumptionLogResponse);
        return;
      }

      // Create consumption log and update item quantities in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create consumption log
        const log = await tx.consumptionLog.create({
          data: {
            item_id,
            team_id: team_id || null,
            quantity,
            unit,
            distributed_to,
            consumption_date: consumption_date ? new Date(consumption_date) : new Date(),
            consumption_type,
            notes,
            distributed_by: req.user!.userId
          },
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true
              }
            },
            team: team_id ? {
              select: {
                id: true,
                team_name: true
              }
            } : undefined,
            distributor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        // Update item quantities
        const updatedItem = await tx.inventoryItem.update({
          where: { id: item_id },
          data: {
            available_quantity: {
              decrement: quantity
            },
            consumed_quantity: {
              increment: quantity
            }
          }
        });

        // Create transaction record
        await tx.inventoryTransaction.create({
          data: {
            item_id,
            transaction_type: 'consume',
            quantity,
            previous_quantity: item.available_quantity,
            new_quantity: updatedItem.available_quantity,
            performed_by: req.user!.userId,
            notes: `Consumption logged: ${quantity} ${unit || 'units'} ${team_id ? `to team ${team_id}` : ''}`
          }
        });

        return log;
      });

      res.status(201).json({
        success: true,
        message: 'Consumption log created successfully',
        data: { log: result }
      } as ConsumptionLogResponse);

    } catch (error) {
      console.error('Create consumption log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ConsumptionLogResponse);
    }
  }

  /**
   * Update consumption log (Manager/Director only)
   */
  static async updateConsumptionLog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        quantity,
        unit,
        distributed_to,
        consumption_date,
        consumption_type,
        notes
      }: UpdateConsumptionLogRequest = req.body;

      // Check if log exists
      const existingLog = await prisma.consumptionLog.findUnique({
        where: { id },
        include: {
          item: true
        }
      });

      if (!existingLog) {
        res.status(404).json({
          success: false,
          message: 'Consumption log not found'
        } as ConsumptionLogResponse);
        return;
      }

      // If quantity is being updated, adjust item quantities
      let quantityDifference = 0;
      if (quantity !== undefined && quantity !== existingLog.quantity) {
        if (quantity <= 0) {
          res.status(400).json({
            success: false,
            message: 'Quantity must be greater than 0'
          } as ConsumptionLogResponse);
          return;
        }

        quantityDifference = quantity - existingLog.quantity;

        // Check if sufficient quantity is available for increase
        if (quantityDifference > 0 && quantityDifference > existingLog.item.available_quantity) {
          res.status(400).json({
            success: false,
            message: `Insufficient quantity available. Only ${existingLog.item.available_quantity} items available.`
          } as ConsumptionLogResponse);
          return;
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (unit !== undefined) updateData.unit = unit;
      if (distributed_to !== undefined) updateData.distributed_to = distributed_to;
      if (consumption_date !== undefined) updateData.consumption_date = new Date(consumption_date);
      if (consumption_type !== undefined) updateData.consumption_type = consumption_type;
      if (notes !== undefined) updateData.notes = notes;

      // Update log and adjust item quantities if needed
      const result = await prisma.$transaction(async (tx) => {
        // Update consumption log
        const log = await tx.consumptionLog.update({
          where: { id },
          data: updateData,
          include: {
            item: {
              select: {
                id: true,
                name: true
              }
            },
            team: {
              select: {
                id: true,
                team_name: true
              }
            },
            distributor: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        // Adjust item quantities if quantity changed
        if (quantityDifference !== 0) {
          const updatedItem = await tx.inventoryItem.update({
            where: { id: existingLog.item_id },
            data: {
              available_quantity: {
                increment: -quantityDifference // Negative because we're consuming
              },
              consumed_quantity: {
                increment: quantityDifference
              }
            }
          });

          // Create transaction record
          await tx.inventoryTransaction.create({
            data: {
              item_id: existingLog.item_id,
              transaction_type: 'adjust',
              quantity: Math.abs(quantityDifference),
              previous_quantity: existingLog.item.available_quantity,
              new_quantity: updatedItem.available_quantity,
              performed_by: req.user!.userId,
              notes: `Consumption log updated: quantity adjusted by ${quantityDifference > 0 ? '+' : ''}${quantityDifference}`
            }
          });
        }

        return log;
      });

      res.json({
        success: true,
        message: 'Consumption log updated successfully',
        data: { log: result }
      } as ConsumptionLogResponse);

    } catch (error) {
      console.error('Update consumption log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ConsumptionLogResponse);
    }
  }

  /**
   * Delete consumption log (Manager/Director only)
   */
  static async deleteConsumptionLog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if log exists
      const log = await prisma.consumptionLog.findUnique({
        where: { id },
        include: {
          item: true
        }
      });

      if (!log) {
        res.status(404).json({
          success: false,
          message: 'Consumption log not found'
        } as ConsumptionLogResponse);
        return;
      }

      // Delete log and restore item quantities in a transaction
      await prisma.$transaction(async (tx) => {
        // Delete consumption log
        await tx.consumptionLog.delete({
          where: { id }
        });

        // Restore item quantities
        const updatedItem = await tx.inventoryItem.update({
          where: { id: log.item_id },
          data: {
            available_quantity: {
              increment: log.quantity
            },
            consumed_quantity: {
              decrement: log.quantity
            }
          }
        });

        // Create transaction record
        await tx.inventoryTransaction.create({
          data: {
            item_id: log.item_id,
            transaction_type: 'adjust',
            quantity: log.quantity,
            previous_quantity: log.item.available_quantity,
            new_quantity: updatedItem.available_quantity,
            performed_by: req.user!.userId,
            notes: `Consumption log deleted: restored ${log.quantity} units`
          }
        });
      });

      res.json({
        success: true,
        message: 'Consumption log deleted successfully'
      } as ConsumptionLogResponse);

    } catch (error) {
      console.error('Delete consumption log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ConsumptionLogResponse);
    }
  }

  /**
   * Get consumption statistics for an item
   */
  static async getItemConsumptionStats(req: Request, res: Response): Promise<void> {
    try {
      const { item_id } = req.params;
      const { start_date, end_date } = req.query;

      // Build where clause
      const where: Prisma.ConsumptionLogWhereInput = {
        item_id
      };

      // Date range filter
      if (start_date || end_date) {
        where.consumption_date = {};
        if (start_date) {
          where.consumption_date.gte = new Date(start_date as string);
        }
        if (end_date) {
          where.consumption_date.lte = new Date(end_date as string);
        }
      }

      // Get consumption logs
      const logs = await prisma.consumptionLog.findMany({
        where,
        include: {
          team: {
            select: {
              id: true,
              team_name: true
            }
          }
        },
        orderBy: { consumption_date: 'desc' }
      });

      // Calculate statistics
      const totalConsumed = logs.reduce((sum, log) => sum + log.quantity, 0);
      const byTeam = logs.reduce((acc, log) => {
        const teamId = log.team_id || 'unassigned';
        const teamName = log.team?.team_name || 'Unassigned';
        if (!acc[teamId]) {
          acc[teamId] = { team_id: teamId, team_name: teamName, quantity: 0, count: 0 };
        }
        acc[teamId].quantity += log.quantity;
        acc[teamId].count += 1;
        return acc;
      }, {} as Record<string, { team_id: string; team_name: string; quantity: number; count: number }>);

      const byType = logs.reduce((acc, log) => {
        const type = log.consumption_type || 'unspecified';
        if (!acc[type]) {
          acc[type] = { type, quantity: 0, count: 0 };
        }
        acc[type].quantity += log.quantity;
        acc[type].count += 1;
        return acc;
      }, {} as Record<string, { type: string; quantity: number; count: number }>);

      res.json({
        success: true,
        message: 'Consumption statistics retrieved successfully',
        data: {
          item_id,
          period: {
            start_date: start_date || null,
            end_date: end_date || null
          },
          total_consumed: totalConsumed,
          total_logs: logs.length,
          by_team: Object.values(byTeam),
          by_type: Object.values(byType),
          recent_logs: logs.slice(0, 10)
        }
      } as ConsumptionLogResponse);

    } catch (error) {
      console.error('Get consumption statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ConsumptionLogResponse);
    }
  }
}
