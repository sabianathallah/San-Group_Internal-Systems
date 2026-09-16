import { Prisma } from '@prisma/client';
import { ParsedQs } from 'qs';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true } as const;

const BOOKING_SELECT = {
  id: true, title: true, notes: true, attendees: true,
  startTime: true, endTime: true, status: true,
  createdAt: true, updatedAt: true,
  room: { select: { id: true, name: true, building: true, floor: true, capacity: true } },
  bookedBy: { select: USER_SELECT },
  cancelledAt: true,
  cancelledBy: { select: USER_SELECT },
} as const;

// ── Rooms ────────────────────────────────────────────────────────────────

export async function listRoomsService(query: ParsedQs) {
  const where: Prisma.RoomWhereInput = {};
  if (query.search) where.name = { contains: String(query.search), mode: 'insensitive' };
  // validate() middleware coerces this to a real boolean via z.coerce.boolean()
  // and merges it back onto req.query, so by the time it lands here it's no
  // longer the raw string the ParsedQs type claims — check both shapes.
  if (query.isActive !== undefined) where.isActive = (query.isActive as unknown) === true || query.isActive === 'true';

  return prisma.room.findMany({ where, orderBy: { name: 'asc' } });
}

export async function createRoomService(data: Prisma.RoomCreateInput) {
  return prisma.room.create({ data });
}

export async function updateRoomService(id: string, data: Prisma.RoomUpdateInput) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new AppError('Room not found', 404);
  return prisma.room.update({ where: { id }, data });
}

export async function deleteRoomService(id: string) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) throw new AppError('Room not found', 404);
  // Soft-delete via isActive — bookings keep their historical room reference,
  // and an inactive room simply drops out of the booking form's room picker.
  return prisma.room.update({ where: { id }, data: { isActive: false } });
}

// ── Bookings ─────────────────────────────────────────────────────────────

// `view` is a plain boolean on this module (checked by checkPerm before the
// controller ever calls this), not a Scope — so unlike Work Order's listing
// there is no own/division/all narrowing here: everyone who can see the
// calendar at all sees every booking, or the shared room calendar can't be
// used to tell what's free.
export async function listBookingsService(query: ParsedQs) {
  const where: Prisma.MeetingRoomBookingWhereInput = {};
  if (query.roomId) where.roomId = String(query.roomId);
  if (query.status) where.status = String(query.status) as 'CONFIRMED' | 'CANCELLED';
  else where.status = 'CONFIRMED';
  if (query.from || query.to) {
    where.startTime = {};
    if (query.from) where.startTime.gte = new Date(String(query.from));
    if (query.to) where.startTime.lte = new Date(String(query.to));
  }

  return prisma.meetingRoomBooking.findMany({ where, select: BOOKING_SELECT, orderBy: { startTime: 'asc' } });
}

async function assertNoConflict(roomId: string, start: Date, end: Date, excludeId?: string): Promise<void> {
  const conflict = await prisma.meetingRoomBooking.findFirst({
    where: {
      roomId,
      status: 'CONFIRMED',
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  if (conflict) throw new AppError('Ruang sudah dibooking pada rentang waktu ini', 409);
}

export async function createBookingService(
  userId: string,
  data: { roomId: string; title: string; notes?: string | null; attendees?: string[]; startTime: string; endTime: string },
) {
  const room = await prisma.room.findUnique({ where: { id: data.roomId } });
  if (!room || !room.isActive) throw new AppError('Room not found', 404);

  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  await assertNoConflict(data.roomId, start, end);

  return prisma.meetingRoomBooking.create({
    data: {
      roomId: data.roomId,
      title: data.title,
      notes: data.notes ?? null,
      attendees: data.attendees ?? [],
      startTime: start,
      endTime: end,
      bookedById: userId,
    },
    select: BOOKING_SELECT,
  });
}

export async function updateBookingService(
  id: string,
  userId: string,
  editScope: string,
  data: { roomId?: string; title?: string; notes?: string | null; attendees?: string[]; startTime?: string; endTime?: string },
) {
  const booking = await prisma.meetingRoomBooking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status === 'CANCELLED') throw new AppError('Cannot edit a cancelled booking', 400);
  if (editScope === 'own' && booking.bookedById !== userId) {
    throw new AppError('Access denied', 403);
  }

  const roomId = data.roomId ?? booking.roomId;
  const start = data.startTime ? new Date(data.startTime) : booking.startTime;
  const end = data.endTime ? new Date(data.endTime) : booking.endTime;
  if (data.roomId || data.startTime || data.endTime) {
    await assertNoConflict(roomId, start, end, id);
  }

  return prisma.meetingRoomBooking.update({
    where: { id },
    data: {
      roomId,
      title: data.title ?? booking.title,
      notes: data.notes !== undefined ? data.notes : booking.notes,
      attendees: data.attendees ?? booking.attendees,
      startTime: start,
      endTime: end,
    },
    select: BOOKING_SELECT,
  });
}

export async function cancelBookingService(id: string, userId: string, deleteScope: string) {
  const booking = await prisma.meetingRoomBooking.findUnique({ where: { id } });
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status === 'CANCELLED') throw new AppError('Booking already cancelled', 400);
  if (deleteScope === 'own' && booking.bookedById !== userId) {
    throw new AppError('Access denied', 403);
  }

  return prisma.meetingRoomBooking.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: userId },
    select: BOOKING_SELECT,
  });
}
