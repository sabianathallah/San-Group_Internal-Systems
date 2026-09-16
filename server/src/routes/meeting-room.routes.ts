import { Router } from 'express';
import {
  listRooms, createRoom, updateRoom, deleteRoom,
  listBookings, createBooking, updateBooking, cancelBooking,
} from '@/controllers/meeting-room.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPerm } from '@/middlewares/permission.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uuidParamSchema } from '@/validations/common.validation';
import {
  createRoomSchema, updateRoomSchema, roomFilterSchema,
  createBookingSchema, updateBookingSchema, bookingFilterSchema,
} from '@/validations/meeting-room.validation';

const router = Router();
router.use(authenticate);

// Rooms (master data)
router.get('/rooms', checkPerm('meeting_room', 'view'), validate(roomFilterSchema, ['query']), listRooms);
router.post('/rooms', checkPerm('meeting_room', 'manageRooms'), validate(createRoomSchema), createRoom);
router.patch('/rooms/:id', checkPerm('meeting_room', 'manageRooms'), validate(uuidParamSchema, ['params']), validate(updateRoomSchema), updateRoom);
router.delete('/rooms/:id', checkPerm('meeting_room', 'manageRooms'), validate(uuidParamSchema, ['params']), deleteRoom);

// Bookings
router.get('/bookings', checkPerm('meeting_room', 'view'), validate(bookingFilterSchema, ['query']), listBookings);
router.post('/bookings', checkPerm('meeting_room', 'create'), validate(createBookingSchema), createBooking);
router.patch('/bookings/:id', checkPerm('meeting_room', 'edit'), validate(uuidParamSchema, ['params']), validate(updateBookingSchema), updateBooking);
router.patch('/bookings/:id/cancel', checkPerm('meeting_room', 'delete'), validate(uuidParamSchema, ['params']), cancelBooking);

export default router;
