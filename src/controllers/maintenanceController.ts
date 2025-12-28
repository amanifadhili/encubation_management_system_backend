import { Request, Response } from 'express';
import { MaintenanceLog, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateMaintenanceLogRequest {
  item_id: string;
  maintenance_type: string;
  performed_by?: string;
  performed_at: string;
  notes?: string;
  next_maintenance?: string;
}

interface UpdateMaintenanceLogRequest {
  maintenance_type?: string;
  performed_by?: string;
  performed_at?: string;
  notes?: string;
  next_maintenance?: string;
}

interface MaintenanceLogResponse {
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

export class MaintenanceController {
  /**
   * Get all maintenance logs with pagination and filters
   */
  static async getAllMaintenanceLogs(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        maintenance_type,
        start_date,
        end_date,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.MaintenanceLogWhereInput = {};

      // Item filter
      if (item_id) {
        where.item_id = item_id as string;
      }

      // Maintenance type filter
      if (maintenance_type) {
        where.maintenance_type = maintenance_type as string;
      }

      // Date range filter
      if (start_date || end_date) {
        where.performed_at = {};
        if (start_date) {
          where.performed_at.gte = new Date(start_date as string);
        }
        if (end_date) {
          where.performed_at.lte = new Date(end_date as string);
        }
      }

      // Get total count
      const total = await prisma.maintenanceLog.count({ where });

      // Get maintenance logs with pagination
      const logs = await prisma.maintenanceLog.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true
            }
          },
          technician: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { performed_at: 'desc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Maintenance logs retrieved successfully',
        data: { logs },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Get all maintenance logs error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Get maintenance log by ID
   */
  static async getMaintenanceLogById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const log = await prisma.maintenanceLog.findUnique({
        where: { id },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              last_maintenance: true,
              next_maintenance: true,
              maintenance_interval: true
            }
          },
          technician: {
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
          message: 'Maintenance log not found'
        } as MaintenanceLogResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Maintenance log retrieved successfully',
        data: { log }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Get maintenance log by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Create new maintenance log (Manager/Director only)
   */
  static async createMaintenanceLog(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        maintenance_type,
        performed_by,
        performed_at,
        notes,
        next_maintenance
      }: CreateMaintenanceLogRequest = req.body;

      // Validate required fields
      if (!item_id || !maintenance_type || !performed_at) {
        res.status(400).json({
          success: false,
          message: 'Item ID, maintenance type, and performed at date are required'
        } as MaintenanceLogResponse);
        return;
      }

      // Validate maintenance type
      const validTypes = ['scheduled', 'repair', 'inspection', 'cleaning'];
      if (!validTypes.includes(maintenance_type)) {
        res.status(400).json({
          success: false,
          message: `Invalid maintenance type. Must be one of: ${validTypes.join(', ')}`
        } as MaintenanceLogResponse);
        return;
      }

      // Validate performed_at date
      const performedAtDate = new Date(performed_at);
      if (isNaN(performedAtDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid performed at date'
        } as MaintenanceLogResponse);
        return;
      }

      // Validate next_maintenance date if provided
      let nextMaintenanceDate: Date | null = null;
      if (next_maintenance) {
        nextMaintenanceDate = new Date(next_maintenance);
        if (isNaN(nextMaintenanceDate.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Invalid next maintenance date'
          } as MaintenanceLogResponse);
          return;
        }
      }

      // Check if item exists
      const item = await prisma.inventoryItem.findUnique({
        where: { id: item_id }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as MaintenanceLogResponse);
        return;
      }

      // Validate technician if provided
      if (performed_by) {
        const technician = await prisma.user.findUnique({
          where: { id: performed_by }
        });

        if (!technician) {
          res.status(404).json({
            success: false,
            message: 'Technician not found'
          } as MaintenanceLogResponse);
          return;
        }
      }

      // Create maintenance log and update item maintenance dates in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create maintenance log
        const log = await tx.maintenanceLog.create({
          data: {
            item_id,
            maintenance_type,
            performed_by: performed_by || null,
            performed_at: performedAtDate,
            notes,
            next_maintenance: nextMaintenanceDate
          },
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true
              }
            },
            technician: performed_by ? {
              select: {
                id: true,
                name: true,
                email: true
              }
            } : undefined
          }
        });

        // Update item maintenance dates
        await tx.inventoryItem.update({
          where: { id: item_id },
          data: {
            last_maintenance: performedAtDate,
            next_maintenance: nextMaintenanceDate || (item.maintenance_interval 
              ? new Date(performedAtDate.getTime() + item.maintenance_interval * 24 * 60 * 60 * 1000)
              : null)
          }
        });

        return log;
      });

      res.status(201).json({
        success: true,
        message: 'Maintenance log created successfully',
        data: { log: result }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Create maintenance log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Update maintenance log (Manager/Director only)
   */
  static async updateMaintenanceLog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        maintenance_type,
        performed_by,
        performed_at,
        notes,
        next_maintenance
      }: UpdateMaintenanceLogRequest = req.body;

      // Check if log exists
      const existingLog = await prisma.maintenanceLog.findUnique({
        where: { id },
        include: {
          item: true
        }
      });

      if (!existingLog) {
        res.status(404).json({
          success: false,
          message: 'Maintenance log not found'
        } as MaintenanceLogResponse);
        return;
      }

      // Validate maintenance type if provided
      if (maintenance_type) {
        const validTypes = ['scheduled', 'repair', 'inspection', 'cleaning'];
        if (!validTypes.includes(maintenance_type)) {
          res.status(400).json({
            success: false,
            message: `Invalid maintenance type. Must be one of: ${validTypes.join(', ')}`
          } as MaintenanceLogResponse);
          return;
        }
      }

      // Validate performed_at date if provided
      let performedAtDate: Date | undefined;
      if (performed_at) {
        performedAtDate = new Date(performed_at);
        if (isNaN(performedAtDate.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Invalid performed at date'
          } as MaintenanceLogResponse);
          return;
        }
      }

      // Validate next_maintenance date if provided
      let nextMaintenanceDate: Date | null | undefined;
      if (next_maintenance !== undefined) {
        if (next_maintenance) {
          nextMaintenanceDate = new Date(next_maintenance);
          if (isNaN(nextMaintenanceDate.getTime())) {
            res.status(400).json({
              success: false,
              message: 'Invalid next maintenance date'
            } as MaintenanceLogResponse);
            return;
          }
        } else {
          nextMaintenanceDate = null;
        }
      }

      // Validate technician if provided
      if (performed_by !== undefined) {
        if (performed_by) {
          const technician = await prisma.user.findUnique({
            where: { id: performed_by }
          });

          if (!technician) {
            res.status(404).json({
              success: false,
              message: 'Technician not found'
            } as MaintenanceLogResponse);
            return;
          }
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (maintenance_type !== undefined) updateData.maintenance_type = maintenance_type;
      if (performed_by !== undefined) updateData.performed_by = performed_by || null;
      if (performed_at !== undefined) updateData.performed_at = performedAtDate;
      if (notes !== undefined) updateData.notes = notes;
      if (next_maintenance !== undefined) updateData.next_maintenance = nextMaintenanceDate;

      // Update maintenance log and item maintenance dates if performed_at changed
      const result = await prisma.$transaction(async (tx) => {
        // Update maintenance log
        const log = await tx.maintenanceLog.update({
          where: { id },
          data: updateData,
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true
              }
            },
            technician: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        });

        // Update item maintenance dates if performed_at changed
        if (performed_at !== undefined) {
          const newNextMaintenance = nextMaintenanceDate !== undefined 
            ? nextMaintenanceDate 
            : (existingLog.item.maintenance_interval && performedAtDate
              ? new Date(performedAtDate.getTime() + existingLog.item.maintenance_interval * 24 * 60 * 60 * 1000)
              : existingLog.item.next_maintenance);

          await tx.inventoryItem.update({
            where: { id: existingLog.item_id },
            data: {
              last_maintenance: performedAtDate,
              next_maintenance: newNextMaintenance
            }
          });
        } else if (next_maintenance !== undefined) {
          // Only update next_maintenance if performed_at didn't change
          await tx.inventoryItem.update({
            where: { id: existingLog.item_id },
            data: {
              next_maintenance: nextMaintenanceDate
            }
          });
        }

        return log;
      });

      res.json({
        success: true,
        message: 'Maintenance log updated successfully',
        data: { log: result }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Update maintenance log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Get items due for maintenance
   */
  static async getItemsDueForMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const { days_ahead = 30, overdue_only = false } = req.query;

      const daysAhead = parseInt(days_ahead as string, 10);
      const overdueOnly = overdue_only === 'true';

      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + daysAhead);

      // Build where clause
      const where: any = {
        next_maintenance: {
          not: null
        }
      };

      if (overdueOnly) {
        // Only items that are overdue (past due date)
        where.next_maintenance = {
          lte: now
        };
      } else {
        // Items due within the specified days (including overdue)
        where.next_maintenance = {
          lte: futureDate
        };
      }

      // Get items due for maintenance
      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              building: true,
              room: true
            }
          },
          maintenance_logs: {
            take: 1,
            orderBy: { performed_at: 'desc' },
            select: {
              id: true,
              maintenance_type: true,
              performed_at: true,
              technician: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              maintenance_logs: true
            }
          }
        },
        orderBy: { next_maintenance: 'asc' }
      });

      // Categorize items
      const overdue = items.filter(item => 
        item.next_maintenance && item.next_maintenance < now
      );
      const dueSoon = items.filter(item => 
        item.next_maintenance && item.next_maintenance >= now && item.next_maintenance <= futureDate
      );

      res.json({
        success: true,
        message: 'Items due for maintenance retrieved successfully',
        data: {
          items,
          summary: {
            total: items.length,
            overdue: overdue.length,
            due_soon: dueSoon.length
          },
          overdue_items: overdue,
          due_soon_items: dueSoon
        }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Get items due for maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Auto-schedule next maintenance based on maintenance interval
   */
  static async autoScheduleMaintenance(req: Request, res: Response): Promise<void> {
    try {
      // Only managers/directors can trigger this
      if (req.user?.role !== 'manager' && req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as MaintenanceLogResponse);
        return;
      }

      // Find items with maintenance_interval set but no next_maintenance
      const itemsNeedingSchedule = await prisma.inventoryItem.findMany({
        where: {
          maintenance_interval: {
            not: null
          },
          OR: [
            { next_maintenance: null },
            { last_maintenance: { not: null } }
          ]
        },
        select: {
          id: true,
          name: true,
          maintenance_interval: true,
          last_maintenance: true,
          next_maintenance: true
        }
      });

      const scheduled = [];
      const errors = [];

      for (const item of itemsNeedingSchedule) {
        try {
          let nextMaintenanceDate: Date | null = null;

          if (item.last_maintenance && item.maintenance_interval) {
            // Calculate next maintenance from last maintenance date
            nextMaintenanceDate = new Date(item.last_maintenance);
            nextMaintenanceDate.setDate(
              nextMaintenanceDate.getDate() + item.maintenance_interval
            );
          } else if (!item.next_maintenance && item.maintenance_interval) {
            // No last maintenance - schedule from now
            nextMaintenanceDate = new Date();
            nextMaintenanceDate.setDate(
              nextMaintenanceDate.getDate() + item.maintenance_interval
            );
          }

          if (nextMaintenanceDate) {
            await prisma.inventoryItem.update({
              where: { id: item.id },
              data: { next_maintenance: nextMaintenanceDate }
            });

            scheduled.push({
              item_id: item.id,
              item_name: item.name,
              next_maintenance: nextMaintenanceDate
            });
          }
        } catch (error) {
          errors.push({
            item_id: item.id,
            item_name: item.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        message: `Scheduled maintenance for ${scheduled.length} items`,
        data: {
          scheduled_count: scheduled.length,
          error_count: errors.length,
          scheduled,
          errors: errors.length > 0 ? errors : undefined
        }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Auto-schedule maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Delete maintenance log (Manager/Director only)
   */
  static async deleteMaintenanceLog(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if log exists
      const log = await prisma.maintenanceLog.findUnique({
        where: { id },
        include: {
          item: {
            select: {
              id: true,
              last_maintenance: true
            }
          }
        }
      });

      if (!log) {
        res.status(404).json({
          success: false,
          message: 'Maintenance log not found'
        } as MaintenanceLogResponse);
        return;
      }

      // Delete maintenance log
      await prisma.maintenanceLog.delete({
        where: { id }
      });

      // If this was the most recent maintenance, update item's last_maintenance
      // (This is a simplified approach - in production, you might want to get the most recent log)
      // For now, we'll just delete the log without updating the item

      res.json({
        success: true,
        message: 'Maintenance log deleted successfully'
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Delete maintenance log error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }

  /**
   * Get upcoming maintenance (items needing maintenance soon)
   */
  static async getUpcomingMaintenance(req: Request, res: Response): Promise<void> {
    try {
      const { days = 30 } = req.query;
      const daysNum = parseInt(days as string, 10);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysNum);

      // Get items with upcoming maintenance
      const items = await prisma.inventoryItem.findMany({
        where: {
          next_maintenance: {
            lte: futureDate,
            gte: new Date()
          }
        },
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
          maintenance_logs: {
            orderBy: { performed_at: 'desc' },
            take: 1
          }
        },
        orderBy: { next_maintenance: 'asc' }
      });

      res.json({
        success: true,
        message: 'Upcoming maintenance retrieved successfully',
        data: {
          items,
          period_days: daysNum
        }
      } as MaintenanceLogResponse);

    } catch (error) {
      console.error('Get upcoming maintenance error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as MaintenanceLogResponse);
    }
  }
}
