import { Router } from 'express';
import { ReservationController } from '../controllers/reservationController';
import { AuthMiddleware, requireManager } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/reservations
 * @desc Get all reservations
 * @access Private (Director, Manager, Incubator)
 */
router.get('/', AuthMiddleware.authenticate, ReservationController.getAllReservations);

/**
 * @route POST /api/reservations
 * @desc Create new reservation
 * @access Private (Director, Manager, Incubator)
 */
router.post('/', AuthMiddleware.authenticate, ReservationController.createReservation);

/**
 * @route GET /api/reservations/:id
 * @desc Get reservation details
 * @access Private (Director, Manager, Incubator)
 */
router.get('/:id', AuthMiddleware.authenticate, ReservationController.getReservationById);

/**
 * @route PUT /api/reservations/:id
 * @desc Update reservation
 * @access Private (Director, Manager, Incubator - own reservations only)
 */
router.put('/:id', AuthMiddleware.authenticate, ReservationController.updateReservation);

/**
 * @route PATCH /api/reservations/:id/cancel
 * @desc Cancel reservation
 * @access Private (Director, Manager, Incubator - own reservations only)
 */
router.patch('/:id/cancel', AuthMiddleware.authenticate, ReservationController.cancelReservation);

/**
 * @route PATCH /api/reservations/:id/confirm
 * @desc Confirm reservation (convert to assignment)
 * @access Private (Manager, Director)
 */
router.patch('/:id/confirm', AuthMiddleware.authenticate, requireManager, ReservationController.confirmReservation);

/**
 * @route DELETE /api/reservations/:id
 * @desc Delete reservation
 * @access Private (Manager, Director)
 */
router.delete('/:id', AuthMiddleware.authenticate, requireManager, ReservationController.deleteReservation);

export default router;
