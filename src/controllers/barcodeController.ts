import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../config/database';

interface BarcodeResponse {
  success: boolean;
  message: string;
  data?: any;
}

export class BarcodeController {
  /**
   * Generate or get barcode for an inventory item
   */
  static async generateBarcode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { barcode } = req.body;

      // Check if item exists
      const item = await prisma.inventoryItem.findUnique({
        where: { id }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as BarcodeResponse);
        return;
      }

      // If barcode provided, validate uniqueness
      if (barcode) {
        const existing = await prisma.inventoryItem.findFirst({
          where: {
            barcode,
            id: { not: id }
          }
        });

        if (existing) {
          res.status(400).json({
            success: false,
            message: 'Barcode already exists for another item'
          } as BarcodeResponse);
          return;
        }
      }

      // Generate unique barcode if not provided
      let finalBarcode = barcode;
      if (!finalBarcode) {
        // Generate unique barcode: INV-{random}
        let unique = false;
        while (!unique) {
          const random = randomBytes(6).toString('hex').toUpperCase();
          finalBarcode = `INV-${random}`;
          const exists = await prisma.inventoryItem.findUnique({
            where: { barcode: finalBarcode }
          });
          if (!exists) unique = true;
        }
      }

      // Update item with barcode
      const updatedItem = await prisma.inventoryItem.update({
        where: { id },
        data: { barcode: finalBarcode },
        select: {
          id: true,
          name: true,
          barcode: true,
          sku: true,
          serial_number: true,
          category: true,
          status: true
        }
      });

      res.json({
        success: true,
        message: 'Barcode generated successfully',
        data: {
          item: updatedItem,
          qr_data: {
            type: 'inventory_item',
            id: updatedItem.id,
            barcode: updatedItem.barcode,
            name: updatedItem.name
          }
        }
      } as BarcodeResponse);

    } catch (error) {
      console.error('Generate barcode error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as BarcodeResponse);
    }
  }

  /**
   * Scan barcode/QR code - lookup item by barcode
   */
  static async scanBarcode(req: Request, res: Response): Promise<void> {
    try {
      const { barcode } = req.body;

      if (!barcode) {
        res.status(400).json({
          success: false,
          message: 'Barcode is required'
        } as BarcodeResponse);
        return;
      }

      // Lookup item by barcode
      const item = await prisma.inventoryItem.findUnique({
        where: { barcode },
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
              name: true
            }
          },
          inventory_assignments: {
            where: {
              returned_at: null // Only active assignments
            },
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
              consumption_logs: true,
              maintenance_logs: true
            }
          }
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found with this barcode'
        } as BarcodeResponse);
        return;
      }

      // Calculate available quantity
      const assignedQuantity = item.inventory_assignments.reduce(
        (sum, a) => sum + a.quantity, 0
      );
      const availableQuantity = item.total_quantity - assignedQuantity;

      res.json({
        success: true,
        message: 'Item found successfully',
        data: {
          item: {
            ...item,
            available_quantity: availableQuantity,
            assigned_quantity: assignedQuantity
          }
        }
      } as BarcodeResponse);

    } catch (error) {
      console.error('Scan barcode error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as BarcodeResponse);
    }
  }

  /**
   * Get QR code data for an item (returns data that can be encoded as QR code)
   */
  static async getQRCodeData(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const item = await prisma.inventoryItem.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          barcode: true,
          sku: true,
          serial_number: true,
          category: true,
          status: true
        }
      });

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Inventory item not found'
        } as BarcodeResponse);
        return;
      }

      // If no barcode, generate one
      if (!item.barcode) {
        let unique = false;
        let finalBarcode = '';
        while (!unique) {
          const random = randomBytes(6).toString('hex').toUpperCase();
          finalBarcode = `INV-${random}`;
          const exists = await prisma.inventoryItem.findUnique({
            where: { barcode: finalBarcode }
          });
          if (!exists) unique = true;
        }

        await prisma.inventoryItem.update({
          where: { id },
          data: { barcode: finalBarcode }
        });

        item.barcode = finalBarcode;
      }

      // QR code data structure
      const qrData = {
        type: 'inventory_item',
        id: item.id,
        barcode: item.barcode,
        name: item.name,
        sku: item.sku,
        serial_number: item.serial_number,
        // URL for web-based QR code scanning
        url: `${process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000'}/inventory/scan/${item.barcode}`
      };

      res.json({
        success: true,
        message: 'QR code data retrieved successfully',
        data: {
          qr_data: qrData,
          qr_string: JSON.stringify(qrData) // For encoding as QR code
        }
      } as BarcodeResponse);

    } catch (error) {
      console.error('Get QR code data error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as BarcodeResponse);
    }
  }

  /**
   * Bulk generate barcodes for items without barcodes
   */
  static async bulkGenerateBarcodes(req: Request, res: Response): Promise<void> {
    try {
      // Only managers/directors can do this
      if (req.user?.role !== 'manager' && req.user?.role !== 'director') {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        } as BarcodeResponse);
        return;
      }

      // Find items without barcodes
      const itemsWithoutBarcode = await prisma.inventoryItem.findMany({
        where: {
          barcode: null
        },
        select: {
          id: true,
          name: true
        }
      });

      if (itemsWithoutBarcode.length === 0) {
        res.json({
          success: true,
          message: 'All items already have barcodes',
          data: {
            generated: 0,
            items: []
          }
        } as BarcodeResponse);
        return;
      }

      // Generate barcodes for all items
      const updatedItems = [];
      for (const item of itemsWithoutBarcode) {
        let unique = false;
        let barcode = '';
        while (!unique) {
          const random = randomBytes(6).toString('hex').toUpperCase();
          barcode = `INV-${random}`;
          const exists = await prisma.inventoryItem.findUnique({
            where: { barcode }
          });
          if (!exists) unique = true;
        }

        const updated = await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { barcode },
          select: {
            id: true,
            name: true,
            barcode: true
          }
        });

        updatedItems.push(updated);
      }

      res.json({
        success: true,
        message: `Generated barcodes for ${updatedItems.length} items`,
        data: {
          generated: updatedItems.length,
          items: updatedItems
        }
      } as BarcodeResponse);

    } catch (error) {
      console.error('Bulk generate barcodes error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      } as BarcodeResponse);
    }
  }
}
