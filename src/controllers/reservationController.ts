import { Request, Response } from 'express';
import { InventoryReservation, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateReservationRequest {
  item_id: string;
  team_id: string;
  quantity: number;
  reserved_until: string;
  notes?: string;
}

interface UpdateReservationRequest {
  quantity?: number;
  reserved_until?: string;
  status?: string;
  notes?: string;
}

interface ReservationResponse {
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

export class ReservationController {
  /**
   * Get all reservations with pagination and filters
   */
  static async getAllReservations(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        status,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.InventoryReservationWhereInput = {};

      // Item filter
      if (item_id) {
        where.item_id = item_id as string;
      }

      // Team filter
      if (team_id) {
        where.team_id = team_id as string;
      }

      // Status filter
      if (status) {
        where.status = status as string;
      }

      // Role-based filtering
      if (req.user?.role === 'incubator') {
        // Incubators can only see their team's reservations
        where.team = {
          team_members: {
            some: {
              user_id: req.user.userId
            }
          }
        };
      }

      // Get total count
      const total = await prisma.inventoryReservation.count({ where });

      // Get reservations with pagination
      const reservations = await prisma.inventoryReservation.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
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
          reserver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { reserved_at: 'desc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Reservations retrieved successfully',
        data: { reservations },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as ReservationResponse);

    } catch (error) {
      console.error('Get all reservations error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }

  /**
   * Get reservation by ID
   */
  static async getReservationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const reservation = await prisma.inventoryReservation.findUnique({
        where: { id },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              available_quantity: true,
              total_quantity: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          reserver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!reservation) {
        res.status(404).json({
          success: false,
          message: 'Reservation not found'
        } as ReservationResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Reservation retrieved successfully',
        data: { reservation }
      } as ReservationResponse);

    } catch (error) {
      console.error('Get reservation by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }

  /**
   * Create new reservation
   */
  static async createReservation(req: Request, res: Response): Promise<void> {
    try {
      const {
        item_id,
        team_id,
        quantity,
        reserved_until,
        notes
      }: CreateReservationRequest = req.body;

      // Validate required fields
      if (!item_id || !team_id || quantity === undefined || !reserved_until) {
        res.status(400).json({
          success: false,
          message: 'Item ID, team ID, quantity, and reserved until date are required'
        } as ReservationResponse);
        return;
      }

      // Validate quantity
      if (quantity <= 0) {
        res.status(400).json({
          success: false,
          message: 'Quantity must be greater than 0'
        } as ReservationResponse);
        return;
      }

      // Validate reserved_until date
      const reservedUntilDate = new Date(reserved_until);
      if (isNaN(reservedUntilDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Invalid reserved until date'
        } as ReservationResponse);
        return;
      }

      if (reservedUntilDate <= new Date()) {
        res.status(400).json({
          success: false,
          message: 'Reserved until date must be in the future'
        } as ReservationResponse);
        return;
      }

      // Check if item exists
      const item = await prisma.inventoryItem.findUnique({
        where: { id: item_id },
        include: {
          inventory_reservations: {
            where: {
              status: {
                in: ['pending', 'confirmed']
              }
            }
          }
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as ReservationResponse);
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
        } as ReservationResponse);
        return;
      }

      // Check if sufficient quantity is available (considering existing reservations)
      const reservedQuantity = item.inventory_reservations.reduce(
        (sum, res) => sum + res.quantity, 0
      );
      const availableForReservation = item.available_quantity - reservedQuantity;

      if (quantity > availableForReservation) {
        res.status(400).json({
          success: false,
          message: `Insufficient quantity available for reservation. Only ${availableForReservation} items available.`
        } as ReservationResponse);
        return;
      }

      // Create reservation
      const reservation = await prisma.inventoryReservation.create({
        data: {
          item_id,
          team_id,
          quantity,
          reserved_until: reservedUntilDate,
          notes,
          reserved_by: req.user!.userId,
          status: 'pending'
        },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              category: true
            }
          },
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          reserver: {
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
        message: 'Reservation created successfully',
        data: { reservation }
      } as ReservationResponse);

    } catch (error) {
      console.error('Create reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }

  /**
   * Update reservation (Manager/Director only, or reserver)
   */
  static async updateReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        quantity,
        reserved_until,
        status,
        notes
      }: UpdateReservationRequest = req.body;

      // Check if reservation exists
      const existingReservation = await prisma.inventoryReservation.findUnique({
        where: { id },
        include: {
          item: {
            include: {
              inventory_reservations: {
                where: {
                  status: {
                    in: ['pending', 'confirmed']
                  },
                  id: { not: id }
                }
              }
            }
          }
        }
      });

      if (!existingReservation) {
        res.status(404).json({
          success: false,
          message: 'Reservation not found'
        } as ReservationResponse);
        return;
      }

      // Check permissions - only reserver or manager/director can update
      if (req.user?.role !== 'manager' && req.user?.role !== 'director' && existingReservation.reserved_by !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to update this reservation'
        } as ReservationResponse);
        return;
      }

      // Validate reserved_until date if provided
      if (reserved_until) {
        const reservedUntilDate = new Date(reserved_until);
        if (isNaN(reservedUntilDate.getTime())) {
          res.status(400).json({
            success: false,
            message: 'Invalid reserved until date'
          } as ReservationResponse);
          return;
        }

        if (reservedUntilDate <= new Date()) {
          res.status(400).json({
            success: false,
            message: 'Reserved until date must be in the future'
          } as ReservationResponse);
          return;
        }
      }

      // If quantity is being updated, check availability
      if (quantity !== undefined && quantity !== existingReservation.quantity) {
        if (quantity <= 0) {
          res.status(400).json({
            success: false,
            message: 'Quantity must be greater than 0'
          } as ReservationResponse);
          return;
        }

        // Check if sufficient quantity is available (considering other reservations)
        const reservedQuantity = existingReservation.item.inventory_reservations.reduce(
          (sum, res) => sum + res.quantity, 0
        );
        const quantityDifference = quantity - existingReservation.quantity;
        const availableForReservation = existingReservation.item.available_quantity - reservedQuantity + existingReservation.quantity;

        if (quantityDifference > availableForReservation) {
          res.status(400).json({
            success: false,
            message: `Insufficient quantity available. Only ${availableForReservation} items available for reservation.`
          } as ReservationResponse);
          return;
        }
      }

      // Validate status if provided
      if (status && !['pending', 'confirmed', 'cancelled', 'expired'].includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: pending, confirmed, cancelled, expired'
        } as ReservationResponse);
        return;
      }

      // Prepare update data
      const updateData: any = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (reserved_until !== undefined) updateData.reserved_until = new Date(reserved_until);
      if (status !== undefined) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;

      // Update reservation
      const reservation = await prisma.inventoryReservation.update({
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
          team: {
            select: {
              id: true,
              team_name: true,
              company_name: true
            }
          },
          reserver: {
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
        message: 'Reservation updated successfully',
        data: { reservation }
      } as ReservationResponse);

    } catch (error) {
      console.error('Update reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }

  /**
   * Cancel reservation
   */
  static async cancelReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if reservation exists
      const reservation = await prisma.inventoryReservation.findUnique({
        where: { id }
      });

      if (!reservation) {
        res.status(404).json({
          success: false,
          message: 'Reservation not found'
        } as ReservationResponse);
        return;
      }

      // Check permissions
      if (req.user?.role !== 'manager' && req.user?.role !== 'director' && reservation.reserved_by !== req.user?.userId) {
        res.status(403).json({
          success: false,
          message: 'You do not have permission to cancel this reservation'
        } as ReservationResponse);
        return;
      }

      // Check if already cancelled
      if (reservation.status === 'cancelled') {
        res.status(400).json({
          success: false,
          message: 'Reservation is already cancelled'
        } as ReservationResponse);
        return;
      }

      // Update reservation status
      const updatedReservation = await prisma.inventoryReservation.update({
        where: { id },
        data: { status: 'cancelled' },
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
          }
        }
      });

      res.json({
        success: true,
        message: 'Reservation cancelled successfully',
        data: { reservation: updatedReservation }
      } as ReservationResponse);

    } catch (error) {
      console.error('Cancel reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }

  /**
   * Confirm reservation (Manager/Director only)
   */
  static async confirmReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if reservation exists
      const reservation = await prisma.inventoryReservation.findUnique({
        where: { id },
        include: {
          item: true
        }
      });

      if (!reservation) {
        res.status(404).json({
          success: false,
          message: 'Reservation not found'
        } as ReservationResponse);
        return;
      }

      // Check if already confirmed or cancelled
      if (reservation.status === 'confirmed') {
        res.status(400).json({
          success: false,
          message: 'Reservation is already confirmed'
        } as ReservationResponse);
        return;
      }

      if (reservation.status === 'cancelled') {
        res.status(400).json({
          success: false,
          message: 'Cannot confirm a cancelled reservation'
        } as ReservationResponse);
        return;
      }

      // Check if reservation has expired
      if (new Date() > reservation.reserved_until) {
        res.status(400).json({
          success: false,
          message: 'Cannot confirm an expired reservation'
        } as ReservationResponse);
        return;
      }

      // Check if sufficient quantity is still available
      if (reservation.quantity > reservation.item.available_quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient quantity available. Only ${reservation.item.available_quantity} items available.`
        } as ReservationResponse);
        return;
      }

      // Update reservation status to confirmed
      const updatedReservation = await prisma.inventoryReservation.update({
        where: { id },
        data: { status: 'confirmed' },
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
          }
        }
      });

      res.json({
        success: true,
        message: 'Reservation confirmed successfully',
        data: { reservation: updatedReservation }
      } as ReservationResponse);

    } catch (error) {
      console.error('Confirm reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }

  /**
   * Delete reservation (Manager/Director only)
   */
  static async deleteReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if reservation exists
      const reservation = await prisma.inventoryReservation.findUnique({
        where: { id }
      });

      if (!reservation) {
        res.status(404).json({
          success: false,
          message: 'Reservation not found'
        } as ReservationResponse);
        return;
      }

      // Delete reservation
      await prisma.inventoryReservation.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Reservation deleted successfully'
      } as ReservationResponse);

    } catch (error) {
      console.error('Delete reservation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as ReservationResponse);
    }
  }
}
