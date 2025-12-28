import { Request, Response } from 'express';
import { StorageLocation, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateLocationRequest {
  name: string;
  building?: string;
  floor?: string;
  room?: string;
  shelf?: string;
  bin?: string;
  parent_location_id?: string;
  notes?: string;
}

interface UpdateLocationRequest {
  name?: string;
  building?: string;
  floor?: string;
  room?: string;
  shelf?: string;
  bin?: string;
  parent_location_id?: string;
  notes?: string;
}

interface LocationResponse {
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

export class LocationController {
  /**
   * Get all storage locations with pagination and search
   */
  static async getAllLocations(req: Request, res: Response): Promise<void> {
    try {
      const {
        search,
        parent_id,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.StorageLocationWhereInput = {};

      // Parent location filter
      if (parent_id === 'root' || parent_id === 'null') {
        where.parent_location_id = null;
      } else if (parent_id) {
        where.parent_location_id = parent_id as string;
      }

      // Search filter
      if (search) {
        where.OR = [
          { name: { contains: search as string } },
          { building: { contains: search as string } },
          { floor: { contains: search as string } },
          { room: { contains: search as string } },
          { shelf: { contains: search as string } },
          { bin: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.storageLocation.count({ where });

      // Get locations with pagination
      const locations = await prisma.storageLocation.findMany({
        where,
        include: {
          parent_location: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          child_locations: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          _count: {
            select: {
              items: true,
              child_locations: true
            }
          }
        },
        orderBy: [
          { building: 'asc' },
          { floor: 'asc' },
          { room: 'asc' },
          { shelf: 'asc' },
          { bin: 'asc' },
          { name: 'asc' }
        ],
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Storage locations retrieved successfully',
        data: { locations },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as LocationResponse);

    } catch (error) {
      console.error('Get all locations error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as LocationResponse);
    }
  }

  /**
   * Get location by ID
   */
  static async getLocationById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const location = await prisma.storageLocation.findUnique({
        where: { id },
        include: {
          parent_location: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true,
              shelf: true,
              bin: true
            }
          },
          child_locations: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true,
              shelf: true,
              bin: true,
              _count: {
                select: {
                  items: true,
                  child_locations: true
                }
              }
            }
          },
          items: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              total_quantity: true,
              available_quantity: true
            }
          },
          _count: {
            select: {
              items: true,
              child_locations: true
            }
          }
        }
      });

      if (!location) {
        res.status(404).json({
          success: false,
          message: 'Storage location not found'
        } as LocationResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Storage location retrieved successfully',
        data: { location }
      } as LocationResponse);

    } catch (error) {
      console.error('Get location by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as LocationResponse);
    }
  }

  /**
   * Create new storage location (Manager/Director only)
   */
  static async createLocation(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        building,
        floor,
        room,
        shelf,
        bin,
        parent_location_id,
        notes
      }: CreateLocationRequest = req.body;

      // Validate required fields
      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Name is required'
        } as LocationResponse);
        return;
      }

      // Validate parent location if provided
      if (parent_location_id) {
        const parentLocation = await prisma.storageLocation.findUnique({
          where: { id: parent_location_id }
        });

        if (!parentLocation) {
          res.status(400).json({
            success: false,
            message: 'Parent location not found'
          } as LocationResponse);
          return;
        }

        // Prevent circular references (check if parent_location_id is a descendant of this location)
        // This is a simple check; for deeper hierarchies, you might need a recursive check
      }

      // Check if location with same name and parent already exists
      const existingLocation = await prisma.storageLocation.findFirst({
        where: {
          name,
          parent_location_id: parent_location_id || null
        }
      });

      if (existingLocation) {
        res.status(400).json({
          success: false,
          message: 'Storage location with this name already exists in this parent location'
        } as LocationResponse);
        return;
      }

      // Create location
      const location = await prisma.storageLocation.create({
        data: {
          name,
          building,
          floor,
          room,
          shelf,
          bin,
          parent_location_id,
          notes
        },
        include: {
          parent_location: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          _count: {
            select: {
              items: true,
              child_locations: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Storage location created successfully',
        data: { location }
      } as LocationResponse);

    } catch (error) {
      console.error('Create location error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as LocationResponse);
    }
  }

  /**
   * Update storage location (Manager/Director only)
   */
  static async updateLocation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        building,
        floor,
        room,
        shelf,
        bin,
        parent_location_id,
        notes
      }: UpdateLocationRequest = req.body;

      // Check if location exists
      const existingLocation = await prisma.storageLocation.findUnique({
        where: { id }
      });

      if (!existingLocation) {
        res.status(404).json({
          success: false,
          message: 'Storage location not found'
        } as LocationResponse);
        return;
      }

      // Validate parent location if provided
      if (parent_location_id !== undefined) {
        if (parent_location_id) {
          // Prevent setting parent to self
          if (parent_location_id === id) {
            res.status(400).json({
              success: false,
              message: 'Location cannot be its own parent'
            } as LocationResponse);
            return;
          }

          // Prevent circular references - check if parent is a descendant
          const checkCircular = async (locationId: string, targetId: string): Promise<boolean> => {
            const location = await prisma.storageLocation.findUnique({
              where: { id: locationId },
              select: { parent_location_id: true }
            });

            if (!location || !location.parent_location_id) {
              return false;
            }

            if (location.parent_location_id === targetId) {
              return true;
            }

            return checkCircular(location.parent_location_id, targetId);
          };

          const isCircular = await checkCircular(parent_location_id, id);
          if (isCircular) {
            res.status(400).json({
              success: false,
              message: 'Cannot set parent location: would create circular reference'
            } as LocationResponse);
            return;
          }

          const parentLocation = await prisma.storageLocation.findUnique({
            where: { id: parent_location_id }
          });

          if (!parentLocation) {
            res.status(400).json({
              success: false,
              message: 'Parent location not found'
            } as LocationResponse);
            return;
          }
        }
      }

      // Check if new name conflicts (if updating name)
      if (name && name !== existingLocation.name) {
        const nameConflict = await prisma.storageLocation.findFirst({
          where: {
            name,
            parent_location_id: parent_location_id !== undefined 
              ? (parent_location_id || null)
              : existingLocation.parent_location_id,
            id: { not: id }
          }
        });

        if (nameConflict) {
          res.status(400).json({
            success: false,
            message: 'Storage location with this name already exists in this parent location'
          } as LocationResponse);
          return;
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (building !== undefined) updateData.building = building;
      if (floor !== undefined) updateData.floor = floor;
      if (room !== undefined) updateData.room = room;
      if (shelf !== undefined) updateData.shelf = shelf;
      if (bin !== undefined) updateData.bin = bin;
      if (parent_location_id !== undefined) updateData.parent_location_id = parent_location_id;
      if (notes !== undefined) updateData.notes = notes;

      // Update location
      const location = await prisma.storageLocation.update({
        where: { id },
        data: updateData,
        include: {
          parent_location: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          child_locations: {
            select: {
              id: true,
              name: true,
              building: true,
              floor: true,
              room: true
            }
          },
          _count: {
            select: {
              items: true,
              child_locations: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Storage location updated successfully',
        data: { location }
      } as LocationResponse);

    } catch (error) {
      console.error('Update location error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as LocationResponse);
    }
  }

  /**
   * Delete storage location (Manager/Director only)
   */
  static async deleteLocation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if location exists
      const location = await prisma.storageLocation.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              items: true,
              child_locations: true
            }
          }
        }
      });

      if (!location) {
        res.status(404).json({
          success: false,
          message: 'Storage location not found'
        } as LocationResponse);
        return;
      }

      // Check if location has items
      if (location._count.items > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete location with associated inventory items'
        } as LocationResponse);
        return;
      }

      // Check if location has child locations
      if (location._count.child_locations > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete location with child locations. Please delete or move child locations first.'
        } as LocationResponse);
        return;
      }

      // Delete location
      await prisma.storageLocation.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Storage location deleted successfully'
      } as LocationResponse);

    } catch (error) {
      console.error('Delete location error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as LocationResponse);
    }
  }

  /**
   * Get location hierarchy (tree structure)
   */
  static async getLocationHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const rootLocations = await prisma.storageLocation.findMany({
        where: {
          parent_location_id: null
        },
        include: {
          child_locations: {
            include: {
              child_locations: {
                select: {
                  id: true,
                  name: true
                }
              },
              _count: {
                select: {
                  items: true,
                  child_locations: true
                }
              }
            }
          },
          _count: {
            select: {
              items: true,
              child_locations: true
            }
          }
        },
        orderBy: [
          { building: 'asc' },
          { floor: 'asc' },
          { room: 'asc' },
          { name: 'asc' }
        ]
      });

      res.json({
        success: true,
        message: 'Location hierarchy retrieved successfully',
        data: { locations: rootLocations }
      } as LocationResponse);

    } catch (error) {
      console.error('Get location hierarchy error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as LocationResponse);
    }
  }
}
