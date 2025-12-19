import { Request, Response } from 'express';
import { Supplier, Prisma } from '@prisma/client';
import prisma from '../config/database';

interface CreateSupplierRequest {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  rating?: number;
}

interface UpdateSupplierRequest {
  name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  rating?: number;
}

interface SupplierResponse {
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

export class SupplierController {
  /**
   * Get all suppliers with pagination and search
   */
  static async getAllSuppliers(req: Request, res: Response): Promise<void> {
    try {
      const {
        search,
        page = 1,
        limit = 10
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause
      const where: Prisma.SupplierWhereInput = {};

      // Search filter
      if (search) {
        where.OR = [
          { name: { contains: search as string } },
          { contact_person: { contains: search as string } },
          { email: { contains: search as string } },
          { phone: { contains: search as string } },
          { address: { contains: search as string } }
        ];
      }

      // Get total count
      const total = await prisma.supplier.count({ where });

      // Get suppliers with pagination
      const suppliers = await prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              items: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limitNum
      });

      const totalPages = Math.ceil(total / limitNum);

      res.json({
        success: true,
        message: 'Suppliers retrieved successfully',
        data: { suppliers },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: totalPages
        }
      } as SupplierResponse);

    } catch (error) {
      console.error('Get all suppliers error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as SupplierResponse);
    }
  }

  /**
   * Get supplier by ID
   */
  static async getSupplierById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          items: {
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              total_quantity: true,
              purchase_date: true
            },
            orderBy: { purchase_date: 'desc' }
          },
          _count: {
            select: {
              items: true
            }
          }
        }
      });

      if (!supplier) {
        res.status(404).json({
          success: false,
          message: 'Supplier not found'
        } as SupplierResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Supplier retrieved successfully',
        data: { supplier }
      } as SupplierResponse);

    } catch (error) {
      console.error('Get supplier by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as SupplierResponse);
    }
  }

  /**
   * Create new supplier (Manager/Director only)
   */
  static async createSupplier(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        contact_person,
        email,
        phone,
        address,
        notes,
        rating
      }: CreateSupplierRequest = req.body;

      // Validate required fields
      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Name is required'
        } as SupplierResponse);
        return;
      }

      // Validate rating if provided (should be between 1 and 5)
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        } as SupplierResponse);
        return;
      }

      // Validate email format if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format'
        } as SupplierResponse);
        return;
      }

      // Check if supplier with same name already exists
      const existingSupplier = await prisma.supplier.findFirst({
        where: { name }
      });

      if (existingSupplier) {
        res.status(400).json({
          success: false,
          message: 'Supplier with this name already exists'
        } as SupplierResponse);
        return;
      }

      // Create supplier
      const supplier = await prisma.supplier.create({
        data: {
          name,
          contact_person,
          email,
          phone,
          address,
          notes,
          rating: rating ? new Prisma.Decimal(rating) : null
        },
        include: {
          _count: {
            select: {
              items: true
            }
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: { supplier }
      } as SupplierResponse);

    } catch (error) {
      console.error('Create supplier error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as SupplierResponse);
    }
  }

  /**
   * Update supplier (Manager/Director only)
   */
  static async updateSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        name,
        contact_person,
        email,
        phone,
        address,
        notes,
        rating
      }: UpdateSupplierRequest = req.body;

      // Check if supplier exists
      const existingSupplier = await prisma.supplier.findUnique({
        where: { id }
      });

      if (!existingSupplier) {
        res.status(404).json({
          success: false,
          message: 'Supplier not found'
        } as SupplierResponse);
        return;
      }

      // Validate rating if provided
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        } as SupplierResponse);
        return;
      }

      // Validate email format if provided
      if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format'
        } as SupplierResponse);
        return;
      }

      // Check if new name conflicts (if updating name)
      if (name && name !== existingSupplier.name) {
        const nameConflict = await prisma.supplier.findFirst({
          where: {
            name,
            id: { not: id }
          }
        });

        if (nameConflict) {
          res.status(400).json({
            success: false,
            message: 'Supplier with this name already exists'
          } as SupplierResponse);
          return;
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (contact_person !== undefined) updateData.contact_person = contact_person;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (notes !== undefined) updateData.notes = notes;
      if (rating !== undefined) updateData.rating = rating ? new Prisma.Decimal(rating) : null;

      // Update supplier
      const supplier = await prisma.supplier.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              items: true
            }
          }
        }
      });

      res.json({
        success: true,
        message: 'Supplier updated successfully',
        data: { supplier }
      } as SupplierResponse);

    } catch (error) {
      console.error('Update supplier error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as SupplierResponse);
    }
  }

  /**
   * Delete supplier (Manager/Director only)
   */
  static async deleteSupplier(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Check if supplier exists
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              items: true
            }
          }
        }
      });

      if (!supplier) {
        res.status(404).json({
          success: false,
          message: 'Supplier not found'
        } as SupplierResponse);
        return;
      }

      // Check if supplier has associated items
      if (supplier._count.items > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete supplier with associated inventory items. Please update or remove the items first.'
        } as SupplierResponse);
        return;
      }

      // Delete supplier
      await prisma.supplier.delete({
        where: { id }
      });

      res.json({
        success: true,
        message: 'Supplier deleted successfully'
      } as SupplierResponse);

    } catch (error) {
      console.error('Delete supplier error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as SupplierResponse);
    }
  }
}
