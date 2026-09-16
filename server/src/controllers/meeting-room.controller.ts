import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/types';
import { successResponse } from '@/helpers/response';
import {
  listRoomsService, createRoomService, updateRoomService, deleteRoomService,
  listBookingsService, createBookingService, updateBookingService, cancelBookingService,
} from '@/services/meeting-room.service';

export async function listRooms(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const rooms = await listRoomsService(req.query);
    successResponse(res, rooms, 'Rooms retrieved successfully');
  } catch (err) { next(err); }
}

export async function createRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const room = await createRoomService(req.body);
    successResponse(res, room, 'Room created successfully', 201);
  } catch (err) { next(err); }
}

export async function updateRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const room = await updateRoomService(String(req.params.id), req.body);
    successResponse(res, room, 'Room updated successfully');
  } catch (err) { next(err); }
}

export async function deleteRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteRoomService(String(req.params.id));
    successResponse(res, null, 'Room deactivated successfully');
  } catch (err) { next(err); }
}

export async function listBookings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const bookings = await listBookingsService(req.query);
    successResponse(res, bookings, 'Bookings retrieved successfully');
  } catch (err) { next(err); }
}

export async function createBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const booking = await createBookingService(req.user!.userId, req.body);
    successResponse(res, booking, 'Booking created successfully', 201);
  } catch (err) { next(err); }
}

export async function updateBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const editScope = req.permScope ?? 'all';
    const booking = await updateBookingService(String(req.params.id), req.user!.userId, editScope, req.body);
    successResponse(res, booking, 'Booking updated successfully');
  } catch (err) { next(err); }
}

export async function cancelBooking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleteScope = req.permScope ?? 'all';
    const booking = await cancelBookingService(String(req.params.id), req.user!.userId, deleteScope);
    successResponse(res, booking, 'Booking cancelled successfully');
  } catch (err) { next(err); }
}
