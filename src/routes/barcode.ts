import { Router } from 'express';
import { BarcodeController } from '../controllers/barcodeController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/barcode/scan
 * @desc Scan barcode/QR code to lookup item
 * @access Private (All authenticated users)
 */
router.post('/scan', AuthMiddleware.authenticate, BarcodeController.scanBarcode);

/**
 * @route POST /api/barcode/item/:id/generate
 * @desc Generate barcode for an item
 * @access Private (Manager/Director)
 */
router.post('/item/:id/generate', AuthMiddleware.authenticate, requireManager, BarcodeController.generateBarcode);

/**
 * @route GET /api/barcode/item/:id/qr
 * @desc Get QR code data for an item
 * @access Private (All authenticated users)
 */
router.get('/item/:id/qr', AuthMiddleware.authenticate, BarcodeController.getQRCodeData);

/**
 * @route POST /api/barcode/bulk-generate
 * @desc Bulk generate barcodes for items without barcodes
 * @access Private (Manager/Director only)
 */
router.post('/bulk-generate', AuthMiddleware.authenticate, requireManager, BarcodeController.bulkGenerateBarcodes);

export default router;
