import { AttendanceStatus, LeaveStatus, NotificationType, OvertimeStatus, Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';
import { parsePagination, buildMeta } from '@/helpers/pagination';
import { ParsedQs } from 'qs';

const USER_SELECT = { id: true, fullName: true, username: true, avatar: true, divisionId: true } as const;
const USER_SELECT_WITH_DIV = { id: true, fullName: true, username: true, avatar: true, divisionId: true, division: { select: { name: true, color: true } } } as const;

// ── Helpers ────────────────────────────────────────────────────

function nowJakarta() {
  const now = new Date();
  const jkt = new Date(now.getTime() + 7 * 3600 * 1000);
  return { now, jkt };
}

function todayJakarta(): string {
  const { jkt } = nowJakarta();
  return jkt.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00.000Z');
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isLateForShift(shift: { startTime: string; lateThresholdMinutes: number }, jkt: Date): { isLate: boolean; lateMinutes: number } {
  const [h, m] = shift.startTime.split(':').map(Number);
  const cutoffMinutes = h * 60 + m + shift.lateThresholdMinutes;
  const nowMinutes = jkt.getUTCHours() * 60 + jkt.getUTCMinutes();
  const late = nowMinutes > cutoffMinutes;
  return { isLate: late, lateMinutes: late ? nowMinutes - cutoffMinutes : 0 };
}

async function sendHRISNotif(
  type: NotificationType,
  actorId: string,
  recipientId: string,
  title: string,
  message: string,
  link: string,
) {
  if (actorId === recipientId) return;
  await prisma.notification.create({ data: { userId: recipientId, actorId, type, title, message, link } });
}

// ── Leave Types ────────────────────────────────────────────────

export async function listLeaveTypesService() {
  return prisma.leaveType.findMany({
    where: { isActive: true },
    orderBy: { position: 'asc' },
  });
}

// ── Leave Balances ─────────────────────────────────────────────

export async function getLeaveBalancesService(userId: string, year: number) {
  const types = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } });
  const balances = await prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leaveType: true },
  });

  return types.map((lt) => {
    const bal = balances.find((b) => b.leaveTypeId === lt.id);
    return {
      leaveType: lt,
      totalDays:   bal?.totalDays   ?? lt.maxDaysPerYear,
      usedDays:    bal?.usedDays    ?? 0,
      pendingDays: bal?.pendingDays ?? 0,
      remainingDays: lt.maxDaysPerYear === 0
        ? null
        : (bal?.totalDays ?? lt.maxDaysPerYear) - (bal?.usedDays ?? 0) - (bal?.pendingDays ?? 0),
    };
  });
}

// ── Leave Requests ─────────────────────────────────────────────

export async function listLeaveRequestsService(
  callerId: string, roleLevel: number, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);
  const year   = query.year   ? Number(query.year)   : new Date().getFullYear();
  const status = query.status as LeaveStatus | undefined;

  const where: Prisma.LeaveRequestWhereInput = {};
  if (roleLevel > 4) {
    where.userId = callerId;
  } else if (query.userId) {
    where.userId = query.userId as string;
  }
  if (status) where.status = status;
  where.startDate = { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) };

  const [items, total] = await prisma.$transaction([
    prisma.leaveRequest.findMany({
      where,
      include: { user: { select: USER_SELECT }, leaveType: true, reviewedBy: { select: USER_SELECT } },
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { leaveRequests: items, meta: buildMeta(total, page, limit) };
}

export async function createLeaveRequestService(
  userId: string,
  body: { leaveTypeId: string; startDate: string; endDate: string; reason: string },
) {
  const { leaveTypeId, startDate, endDate, reason } = body;
  const start = parseDate(startDate);
  const end   = parseDate(endDate);

  if (end < start) throw new AppError('Tanggal akhir harus setelah tanggal mulai', 400);

  const totalDays = countWeekdays(start, end);
  if (totalDays === 0) throw new AppError('Tidak ada hari kerja dalam rentang tanggal tersebut', 400);

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) throw new AppError('Jenis cuti tidak ditemukan', 404);

  const year = start.getUTCFullYear();

  if (leaveType.maxDaysPerYear > 0) {
    let balance = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
    });
    if (!balance) {
      balance = await prisma.leaveBalance.create({
        data: { userId, leaveTypeId, year, totalDays: leaveType.maxDaysPerYear },
      });
    }
    const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
    if (totalDays > remaining) {
      throw new AppError(`Saldo cuti tidak cukup. Tersisa ${remaining} hari`, 400);
    }
    await prisma.leaveBalance.update({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
      data:  { pendingDays: { increment: totalDays } },
    });
  }

  const request = await prisma.leaveRequest.create({
    data: { userId, leaveTypeId, startDate: start, endDate: end, totalDays, reason },
    include: { user: { select: USER_SELECT }, leaveType: true },
  });

  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { divisionId: true, fullName: true } });
  if (requester) {
    const managers = await prisma.user.findMany({
      where: { divisionId: requester.divisionId, role: { level: { lte: 4 } }, id: { not: userId } },
      select: { id: true },
    });
    await Promise.all(managers.map((m) =>
      sendHRISNotif(
        NotificationType.LEAVE_SUBMITTED, userId, m.id,
        'Pengajuan Cuti Baru',
        `${requester.fullName} mengajukan ${leaveType.name} (${totalDays} hari) mulai ${startDate}.`,
        '/hris/leave',
      ),
    ));
  }

  return request;
}

export async function reviewLeaveRequestService(
  id: string, reviewerId: string, roleLevel: number,
  body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null },
) {
  if (roleLevel > 4) throw new AppError('Hanya manager/admin yang bisa review cuti', 403);

  const req = await prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  if (!req) throw new AppError('Pengajuan cuti tidak ditemukan', 404);
  if (req.status !== LeaveStatus.PENDING) throw new AppError('Pengajuan ini sudah diproses', 400);
  if (req.userId === reviewerId) throw new AppError('Tidak bisa mereview pengajuan cuti sendiri', 403);

  const { status, reviewNote } = body;
  const year = new Date(req.startDate).getUTCFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id },
      data: { status, reviewNote: reviewNote ?? null, reviewedById: reviewerId, reviewedAt: new Date() },
    });
    if (req.leaveType.maxDaysPerYear > 0) {
      if (status === 'APPROVED') {
        await tx.leaveBalance.update({
          where: { userId_leaveTypeId_year: { userId: req.userId, leaveTypeId: req.leaveTypeId, year } },
          data:  { pendingDays: { decrement: req.totalDays }, usedDays: { increment: req.totalDays } },
        });
      } else {
        await tx.leaveBalance.update({
          where: { userId_leaveTypeId_year: { userId: req.userId, leaveTypeId: req.leaveTypeId, year } },
          data:  { pendingDays: { decrement: req.totalDays } },
        });
      }
    }
  });

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } });
  const notifType = status === 'APPROVED' ? NotificationType.LEAVE_APPROVED : NotificationType.LEAVE_REJECTED;
  const notifMsg = status === 'APPROVED'
    ? `${reviewer?.fullName ?? 'Manager'} menyetujui pengajuan ${req.leaveType.name} kamu.`
    : `${reviewer?.fullName ?? 'Manager'} menolak pengajuan ${req.leaveType.name} kamu${reviewNote ? ': ' + reviewNote : '.'}`;

  await sendHRISNotif(notifType, reviewerId, req.userId, status === 'APPROVED' ? 'Cuti Disetujui' : 'Cuti Ditolak', notifMsg, '/hris/leave');

  return prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: USER_SELECT }, leaveType: true, reviewedBy: { select: USER_SELECT } },
  });
}

export async function cancelLeaveRequestService(id: string, userId: string) {
  const req = await prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
  if (!req) throw new AppError('Pengajuan cuti tidak ditemukan', 404);
  if (req.userId !== userId) throw new AppError('Bukan pengajuan kamu', 403);
  if (req.status !== LeaveStatus.PENDING) throw new AppError('Hanya pengajuan PENDING yang bisa dibatalkan', 400);

  const year = new Date(req.startDate).getUTCFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id }, data: { status: LeaveStatus.CANCELLED } });
    if (req.leaveType.maxDaysPerYear > 0) {
      await tx.leaveBalance.update({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId: req.leaveTypeId, year } },
        data:  { pendingDays: { decrement: req.totalDays } },
      });
    }
  });
}

// ── Attendance ─────────────────────────────────────────────────

export async function todayAttendanceService(userId: string) {
  const today = todayJakarta();
  return prisma.attendance.findUnique({
    where: { userId_date: { userId, date: parseDate(today) } },
    include: { shift: { select: { name: true, startTime: true, color: true } }, officeLocation: { select: { name: true } } },
  });
}

export async function checkInService(
  userId: string,
  body: {
    note?: string | null;
    status?: 'PRESENT' | 'WFH';
    lat?: number | null;
    lng?: number | null;
    locationName?: string | null;
    outOfAreaReason?: string | null;
    photoUrl?: string | null;
  },
) {
  const today   = todayJakarta();
  const dateVal = parseDate(today);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: dateVal } },
  });
  if (existing?.checkIn) throw new AppError('Kamu sudah check-in hari ini', 400);

  const { now, jkt } = nowJakarta();

  // Determine shift for this user
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    include: { shift: true },
  });
  let activeShift = userRecord?.shift ?? null;
  if (!activeShift) {
    activeShift = await prisma.shift.findFirst({ where: { isDefault: true, isActive: true } });
  }

  // Late detection based on shift
  let isLate = false;
  let lateMinutes = 0;
  if (activeShift) {
    const lateInfo = isLateForShift(activeShift, jkt);
    isLate = lateInfo.isLate;
    lateMinutes = lateInfo.lateMinutes;
  } else {
    // Fallback: 08:30 WIB
    const cutoff = 8 * 60 + 30;
    const nowMin = jkt.getUTCHours() * 60 + jkt.getUTCMinutes();
    isLate = nowMin > cutoff;
    lateMinutes = isLate ? nowMin - cutoff : 0;
  }

  // Geofencing check (only if GPS provided)
  let officeLocationId: string | null = null;
  const { lat, lng, locationName, outOfAreaReason } = body;
  let resolvedIsOutOfArea = false;

  if (lat != null && lng != null && body.status !== 'WFH') {
    const locations = await prisma.officeLocation.findMany({ where: { isActive: true } });
    if (locations.length > 0) {
      let nearestDist = Infinity;
      let nearestLoc = locations[0];
      let withinAny = false;

      for (const loc of locations) {
        const dist = haversineMeters(lat, lng, loc.lat, loc.lng);
        if (dist <= loc.radiusMeters) {
          withinAny = true;
          officeLocationId = loc.id;
          break;
        }
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestLoc = loc;
        }
      }

      if (!withinAny) {
        if (!outOfAreaReason) {
          throw new AppError('Di luar area kantor', 422, {
            distanceMeters: Math.round(nearestDist),
            nearestLocation: { name: nearestLoc.name, lat: nearestLoc.lat, lng: nearestLoc.lng, radiusMeters: nearestLoc.radiusMeters },
          });
        }
        resolvedIsOutOfArea = true;
      }
    }
  }

  const statusVal: AttendanceStatus =
    body.status === 'WFH' ? AttendanceStatus.WFH :
    isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

  const data = {
    checkIn:         now,
    status:          statusVal,
    isLate,
    lateMinutes,
    note:            body.note ?? null,
    lat:             lat ?? null,
    lng:             lng ?? null,
    locationName:    locationName ?? null,
    isOutOfArea:     resolvedIsOutOfArea,
    outOfAreaReason: resolvedIsOutOfArea ? (outOfAreaReason ?? null) : null,
    shiftId:         activeShift?.id ?? null,
    officeLocationId,
    photoUrl:        body.photoUrl ?? null,
  };

  const includeOpts = {
    shift:          { select: { name: true, startTime: true, color: true } },
    officeLocation: { select: { name: true } },
  };

  if (existing) {
    return prisma.attendance.update({ where: { userId_date: { userId, date: dateVal } }, data, include: includeOpts });
  }
  return prisma.attendance.create({ data: { userId, date: dateVal, ...data }, include: includeOpts });
}

export async function checkOutService(userId: string, body: { note?: string | null }) {
  const today   = todayJakarta();
  const dateVal = parseDate(today);

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: dateVal } },
  });
  if (!existing?.checkIn) throw new AppError('Kamu belum check-in hari ini', 400);
  if (existing.checkOut)  throw new AppError('Kamu sudah check-out hari ini', 400);

  const now = new Date();
  const workMinutes = Math.floor((now.getTime() - existing.checkIn.getTime()) / 60000);

  return prisma.attendance.update({
    where: { userId_date: { userId, date: dateVal } },
    data:  { checkOut: now, workMinutes, note: body.note ?? existing.note },
  });
}

export async function listAttendanceService(
  callerId: string, roleLevel: number, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);
  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();

  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const endOfMonth   = new Date(year, month, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  const where: Prisma.AttendanceWhereInput = { date: { gte: startOfMonth, lte: endOfMonth } };
  if (roleLevel > 4) { where.userId = callerId; }
  else if (query.userId) { where.userId = query.userId as string; }
  if (query.status) where.status = query.status as AttendanceStatus;

  const [items, total] = await prisma.$transaction([
    prisma.attendance.findMany({
      where,
      include: {
        user:           { select: USER_SELECT },
        shift:          { select: { name: true, color: true } },
        officeLocation: { select: { name: true } },
      },
      skip, take: limit,
      orderBy: { date: 'desc' },
    }),
    prisma.attendance.count({ where }),
  ]);

  return { attendance: items, meta: buildMeta(total, page, limit) };
}

export async function getAttendanceSummaryService(userId: string, month: number, year: number) {
  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const endOfMonth   = new Date(year, month, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  const records = await prisma.attendance.findMany({
    where:   { userId, date: { gte: startOfMonth, lte: endOfMonth } },
    include: { shift: { select: { name: true, color: true } } },
    orderBy: { date: 'asc' },
  });

  const summary = { present: 0, late: 0, wfh: 0, permission: 0, absent: 0, holiday: 0, totalWorkMinutes: 0 };

  for (const r of records) {
    if (r.status === 'PRESENT')    summary.present++;
    if (r.status === 'LATE')       { summary.late++; summary.present++; }
    if (r.status === 'WFH')        summary.wfh++;
    if (r.status === 'PERMISSION') summary.permission++;
    if (r.status === 'ABSENT')     summary.absent++;
    if (r.status === 'HOLIDAY')    summary.holiday++;
    summary.totalWorkMinutes += r.workMinutes ?? 0;
  }

  return { summary, records };
}

export async function adminUpdateAttendanceService(
  id: string, roleLevel: number,
  body: { status?: AttendanceStatus; note?: string | null; checkIn?: string | null; checkOut?: string | null },
) {
  if (roleLevel > 4) throw new AppError('Hanya admin/manager yang bisa edit absensi', 403);
  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) throw new AppError('Record absensi tidak ditemukan', 404);

  const checkIn  = body.checkIn  ? new Date(body.checkIn)  : undefined;
  const checkOut = body.checkOut ? new Date(body.checkOut) : undefined;

  let workMinutes: number | undefined;
  const ci = checkIn  ?? existing.checkIn;
  const co = checkOut ?? existing.checkOut;
  if (ci && co) workMinutes = Math.floor((co.getTime() - ci.getTime()) / 60000);

  return prisma.attendance.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.note   !== undefined && { note:   body.note }),
      ...(checkIn  && { checkIn }),
      ...(checkOut && { checkOut }),
      ...(workMinutes !== undefined && { workMinutes }),
    },
  });
}

// ── Shifts ─────────────────────────────────────────────────────

export async function listShiftsService() {
  return prisma.shift.findMany({
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { users: true } } },
  });
}

export async function createShiftService(roleLevel: number, body: {
  name: string; startTime: string; endTime: string;
  lateThresholdMinutes?: number; isDefault?: boolean; color?: string;
}) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  if (body.isDefault) {
    await prisma.shift.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  return prisma.shift.create({ data: body });
}

export async function updateShiftService(id: string, roleLevel: number, body: {
  name?: string; startTime?: string; endTime?: string;
  lateThresholdMinutes?: number; isDefault?: boolean; color?: string; isActive?: boolean;
}) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new AppError('Shift tidak ditemukan', 404);
  if (body.isDefault) {
    await prisma.shift.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
  }
  return prisma.shift.update({ where: { id }, data: body });
}

export async function deleteShiftService(id: string, roleLevel: number) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  const shift = await prisma.shift.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!shift) throw new AppError('Shift tidak ditemukan', 404);
  if (shift.isDefault) throw new AppError('Tidak bisa hapus shift default', 400);
  if (shift._count.users > 0) throw new AppError(`Shift ini masih dipakai oleh ${shift._count.users} karyawan`, 400);
  return prisma.shift.delete({ where: { id } });
}

export async function assignShiftService(roleLevel: number, userId: string, shiftId: string | null) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  return prisma.user.update({
    where: { id: userId },
    data: { shiftId },
    select: { id: true, fullName: true, username: true, avatar: true, shiftId: true },
  });
}

export async function listUsersForShiftService(roleLevel: number) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  return prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true, fullName: true, username: true, avatar: true,
      division: { select: { name: true, color: true } },
      role:     { select: { name: true } },
      shift:    { select: { id: true, name: true, color: true, startTime: true, endTime: true } },
    },
    orderBy: { fullName: 'asc' },
  });
}

// ── Office Locations ───────────────────────────────────────────

export async function listOfficeLocationsService() {
  return prisma.officeLocation.findMany({ orderBy: { name: 'asc' } });
}

export async function createOfficeLocationService(roleLevel: number, body: {
  name: string; address?: string | null; lat: number; lng: number; radiusMeters?: number;
}) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  return prisma.officeLocation.create({ data: body });
}

export async function updateOfficeLocationService(id: string, roleLevel: number, body: {
  name?: string; address?: string | null; lat?: number; lng?: number; radiusMeters?: number; isActive?: boolean;
}) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  const loc = await prisma.officeLocation.findUnique({ where: { id } });
  if (!loc) throw new AppError('Lokasi tidak ditemukan', 404);
  return prisma.officeLocation.update({ where: { id }, data: body });
}

export async function deleteOfficeLocationService(id: string, roleLevel: number) {
  if (roleLevel > 2) throw new AppError('Hanya HR Admin', 403);
  const loc = await prisma.officeLocation.findUnique({ where: { id } });
  if (!loc) throw new AppError('Lokasi tidak ditemukan', 404);
  return prisma.officeLocation.delete({ where: { id } });
}

// ── Overtime ───────────────────────────────────────────────────

export async function listOvertimeRequestsService(callerId: string, roleLevel: number, query: ParsedQs) {
  const { page, limit, skip } = parsePagination(query);
  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();

  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const endOfMonth   = new Date(year, month, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  const where: Prisma.OvertimeRequestWhereInput = { date: { gte: startOfMonth, lte: endOfMonth } };
  if (roleLevel > 4) { where.userId = callerId; }
  else if (query.userId) { where.userId = query.userId as string; }
  if (query.status) where.status = query.status as OvertimeStatus;

  const [items, total] = await prisma.$transaction([
    prisma.overtimeRequest.findMany({
      where, skip, take: limit,
      include: { user: { select: USER_SELECT }, reviewedBy: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.overtimeRequest.count({ where }),
  ]);

  return { overtimes: items, meta: buildMeta(total, page, limit) };
}

export async function createOvertimeRequestService(userId: string, body: {
  date: string; startTime: string; endTime: string; reason: string; attendanceId?: string | null;
}) {
  const { date, startTime, endTime, reason, attendanceId } = body;

  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const durationMinutes = (eh * 60 + em) - (sh * 60 + sm);
  if (durationMinutes <= 0) throw new AppError('Waktu selesai harus setelah waktu mulai', 400);
  if (durationMinutes < 30) throw new AppError('Minimum lembur 30 menit', 400);

  const dateVal = parseDate(date);

  const overtime = await prisma.overtimeRequest.create({
    data: { userId, date: dateVal, startTime, endTime, durationMinutes, reason, attendanceId: attendanceId ?? null },
    include: { user: { select: USER_SELECT } },
  });

  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { divisionId: true, fullName: true } });
  if (requester) {
    const h = Math.floor(durationMinutes / 60);
    const m = durationMinutes % 60;
    const durStr = h > 0 ? `${h}j ${m}m` : `${m}m`;
    const managers = await prisma.user.findMany({
      where: { divisionId: requester.divisionId, role: { level: { lte: 4 } }, id: { not: userId } },
      select: { id: true },
    });
    await Promise.all(managers.map((mg) =>
      sendHRISNotif(
        NotificationType.OVERTIME_SUBMITTED, userId, mg.id,
        'Pengajuan Lembur Baru',
        `${requester.fullName} mengajukan lembur pada ${date} (${durStr}).`,
        '/hris/overtime',
      ),
    ));
  }

  return overtime;
}

export async function reviewOvertimeRequestService(
  id: string, reviewerId: string, roleLevel: number,
  body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null },
) {
  if (roleLevel > 4) throw new AppError('Hanya manager/admin yang bisa review lembur', 403);
  const ot = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!ot) throw new AppError('Pengajuan lembur tidak ditemukan', 404);
  if (ot.status !== OvertimeStatus.PENDING) throw new AppError('Pengajuan ini sudah diproses', 400);
  if (ot.userId === reviewerId) throw new AppError('Tidak bisa mereview pengajuan lembur sendiri', 403);

  const updated = await prisma.overtimeRequest.update({
    where: { id },
    data: { status: body.status as OvertimeStatus, reviewNote: body.reviewNote ?? null, reviewedById: reviewerId, reviewedAt: new Date() },
    include: { user: { select: USER_SELECT }, reviewedBy: { select: USER_SELECT } },
  });

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } });
  const notifType = body.status === 'APPROVED' ? NotificationType.OVERTIME_APPROVED : NotificationType.OVERTIME_REJECTED;
  await sendHRISNotif(
    notifType, reviewerId, ot.userId,
    body.status === 'APPROVED' ? 'Lembur Disetujui' : 'Lembur Ditolak',
    body.status === 'APPROVED'
      ? `${reviewer?.fullName} menyetujui pengajuan lembur kamu pada ${ot.date.toISOString().slice(0, 10)}.`
      : `${reviewer?.fullName} menolak pengajuan lembur kamu${body.reviewNote ? ': ' + body.reviewNote : '.'}`,
    '/hris/overtime',
  );

  return updated;
}

export async function cancelOvertimeRequestService(id: string, userId: string) {
  const ot = await prisma.overtimeRequest.findUnique({ where: { id } });
  if (!ot) throw new AppError('Pengajuan lembur tidak ditemukan', 404);
  if (ot.userId !== userId) throw new AppError('Bukan pengajuan kamu', 403);
  if (ot.status !== OvertimeStatus.PENDING) throw new AppError('Hanya pengajuan PENDING yang bisa dibatalkan', 400);
  return prisma.overtimeRequest.update({ where: { id }, data: { status: OvertimeStatus.CANCELLED } });
}

// ── Attendance Reports ─────────────────────────────────────────

export async function getAttendanceReportsService(callerId: string, roleLevel: number, query: ParsedQs) {
  if (roleLevel > 4) throw new AppError('Only manager/admin can view reports', 403);

  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();

  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const endOfMonth   = new Date(year, month, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  // Scope by user/division; non-HR managers see their own division only
  let userWhere: Prisma.UserWhereInput = {};
  if (query.userId) {
    userWhere = { id: query.userId as string };
  } else if (query.divisionId) {
    userWhere = { divisionId: query.divisionId as string };
  } else if (roleLevel > 2) {
    const me = await prisma.user.findUnique({ where: { id: callerId }, select: { divisionId: true } });
    if (me?.divisionId) userWhere = { divisionId: me.divisionId };
  }

  const items = await prisma.attendance.findMany({
    where: { date: { gte: startOfMonth, lte: endOfMonth }, user: userWhere },
    select: {
      userId: true, status: true,
      workMinutes: true, lateMinutes: true, isOutOfArea: true,
      user: {
        select: {
          fullName: true, username: true, avatar: true,
          division: { select: { name: true } },
          shift:    { select: { name: true } },
        },
      },
    },
  });

  type Row = {
    userId: string; fullName: string; username: string; avatar: string | null;
    divisionName: string; shiftName: string | null;
    totalPresent: number; totalLate: number; totalAbsent: number; totalWFH: number;
    totalPermission: number; totalHoliday: number;
    totalWorkMinutes: number; totalLateMinutes: number; outOfAreaCount: number;
    attendanceRate: number;
  };

  const map = new Map<string, Row>();
  for (const rec of items) {
    if (!map.has(rec.userId)) {
      map.set(rec.userId, {
        userId:       rec.userId,
        fullName:     rec.user.fullName,
        username:     rec.user.username,
        avatar:       rec.user.avatar,
        divisionName: rec.user.division?.name ?? '—',
        shiftName:    rec.user.shift?.name ?? null,
        totalPresent: 0, totalLate: 0, totalAbsent: 0, totalWFH: 0,
        totalPermission: 0, totalHoliday: 0,
        totalWorkMinutes: 0, totalLateMinutes: 0, outOfAreaCount: 0, attendanceRate: 0,
      });
    }
    const row = map.get(rec.userId)!;
    switch (rec.status) {
      case 'PRESENT':    row.totalPresent++;    break;
      case 'LATE':       row.totalPresent++; row.totalLate++; break;
      case 'WFH':        row.totalWFH++;        break;
      case 'PERMISSION': row.totalPermission++; break;
      case 'ABSENT':     row.totalAbsent++;     break;
      case 'HOLIDAY':    row.totalHoliday++;    break;
    }
    row.totalWorkMinutes += rec.workMinutes ?? 0;
    row.totalLateMinutes += rec.lateMinutes ?? 0;
    if (rec.isOutOfArea) row.outOfAreaCount++;
  }

  // Working days in month (Mon–Fri)
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
  }

  const rows = Array.from(map.values()).map((row) => {
    const eligible = Math.max(1, workingDays - row.totalHoliday);
    const attended = row.totalPresent + row.totalWFH + row.totalPermission;
    row.attendanceRate = parseFloat(Math.min(100, (attended / eligible) * 100).toFixed(1));
    return row;
  });

  rows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Search filter applied after aggregation
  const search = (query.search as string | undefined)?.toLowerCase();
  return search
    ? rows.filter((r) => r.fullName.toLowerCase().includes(search) || r.username.toLowerCase().includes(search))
    : rows;
}
