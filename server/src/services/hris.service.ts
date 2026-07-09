import { AttendanceStatus, LeaveStatus, NotificationType, Prisma, RequestStatus } from '@prisma/client';
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

// Working days = Mon–Fri minus company holidays (tanggal merah). The holiday
// set uses YYYY-MM-DD keys — same everywhere this is consulted (leave-day
// counting, auto-absent job, attendance reports) so they always agree.
function countWorkdays(start: Date, end: Date, holidays: Set<string>): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6 && !holidays.has(cur.toISOString().slice(0, 10))) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

export async function getHolidaySet(start: Date, end: Date): Promise<Set<string>> {
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  return new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));
}

// Whole months elapsed between two dates (date-of-month aware) — tenure rule.
function monthsBetween(from: Date, to: Date): number {
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

type LeaveTypePolicy = {
  id: string; maxDaysPerYear: number; allowCarryOver: boolean; earnedBalance: boolean;
};

// Balance rows exist for yearly-quota types AND earned types (comp-off, which
// starts at 0 and grows via grants). Unlimited types (e.g. sick) have none.
function isBalanceTracked(lt: { maxDaysPerYear: number; earnedBalance: boolean }): boolean {
  return lt.maxDaysPerYear > 0 || lt.earnedBalance;
}

// Returns the (created-on-first-touch) balance row for a user/type/year, with
// two policy rules applied:
//  1. Carry-over: on first touch of a new year, last year's remainder is added
//     to totalDays and recorded in carriedOverDays.
//  2. Expiry: past March 31 (WIB), the still-unused part of the carried days
//     is removed again — consumption counts against carried days first.
async function materializeBalance(
  db: Prisma.TransactionClient,
  userId: string,
  leaveType: LeaveTypePolicy,
  year: number,
) {
  let balance = await db.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId: leaveType.id, year } },
  });

  if (!balance) {
    let carry = 0;
    if (leaveType.allowCarryOver && leaveType.maxDaysPerYear > 0) {
      const prev = await db.leaveBalance.findUnique({
        where: { userId_leaveTypeId_year: { userId, leaveTypeId: leaveType.id, year: year - 1 } },
      });
      if (prev) carry = Math.max(0, prev.totalDays - prev.usedDays - prev.pendingDays);
    }
    balance = await db.leaveBalance.create({
      data: {
        userId,
        leaveTypeId: leaveType.id,
        year,
        totalDays: (leaveType.earnedBalance ? 0 : leaveType.maxDaysPerYear) + carry,
        carriedOverDays: carry,
      },
    });
  }

  if (balance.carriedOverDays > 0 && todayJakarta() >= `${year}-04-01`) {
    const consumed = balance.usedDays + balance.pendingDays;
    const expired = Math.max(0, balance.carriedOverDays - consumed);
    balance = await db.leaveBalance.update({
      where: { id: balance.id },
      data: { totalDays: { decrement: expired }, carriedOverDays: 0 },
    });
  }

  return balance;
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

  const result = [];
  for (const lt of types) {
    if (isBalanceTracked(lt)) {
      // Materializing here keeps display and request-time numbers identical
      // (both go through the same carry-over + expiry rules).
      const bal = await materializeBalance(prisma, userId, lt, year);
      result.push({
        leaveType: lt,
        totalDays:       bal.totalDays,
        usedDays:        bal.usedDays,
        pendingDays:     bal.pendingDays,
        carriedOverDays: bal.carriedOverDays,
        remainingDays:   bal.totalDays - bal.usedDays - bal.pendingDays,
      });
    } else {
      const bal = balances.find((b) => b.leaveTypeId === lt.id);
      result.push({
        leaveType: lt,
        totalDays:       bal?.totalDays   ?? 0,
        usedDays:        bal?.usedDays    ?? 0,
        pendingDays:     bal?.pendingDays ?? 0,
        carriedOverDays: 0,
        remainingDays:   null, // unlimited
      });
    }
  }
  return result;
}

// ── Leave Requests ─────────────────────────────────────────────

export async function listLeaveRequestsService(
  callerId: string, reviewScope: string, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);
  const year   = query.year   ? Number(query.year)   : new Date().getFullYear();
  const status = query.status as LeaveStatus | undefined;

  const where: Prisma.LeaveRequestWhereInput = {};
  if (reviewScope === 'all') {
    if (query.userId) where.userId = query.userId as string;
  } else if (reviewScope === 'division') {
    where.user = { divisionId };
    if (query.userId) where.userId = query.userId as string;
  } else {
    where.userId = callerId;
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
  body: {
    leaveTypeId: string; startDate: string; endDate: string; reason: string;
    attachmentUrl?: string | null; attachmentName?: string | null;
  },
) {
  const { leaveTypeId, startDate, endDate, reason } = body;
  const attachmentUrl  = body.attachmentUrl ?? null;
  const attachmentName = body.attachmentName ?? null;
  const start = parseDate(startDate);
  const end   = parseDate(endDate);

  if (end < start) throw new AppError('Tanggal akhir harus setelah tanggal mulai', 400);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    throw new AppError('Cuti lintas tahun tidak didukung — ajukan terpisah per tahun', 400);
  }

  const holidays = await getHolidaySet(start, end);
  const totalDays = countWorkdays(start, end, holidays);
  if (totalDays === 0) throw new AppError('Tidak ada hari kerja dalam rentang tanggal tersebut', 400);

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) throw new AppError('Jenis cuti tidak ditemukan', 404);

  // Supporting document rule (surat dokter for sick > 1 day, undangan for
  // special leave, etc.) — requiresDocAfterDays sets the day threshold.
  if (leaveType.requiresDoc && totalDays > leaveType.requiresDocAfterDays && !attachmentUrl) {
    const suffix = leaveType.requiresDocAfterDays > 0 ? ` lebih dari ${leaveType.requiresDocAfterDays} hari` : '';
    throw new AppError(`${leaveType.name}${suffix} wajib melampirkan dokumen pendukung`, 400);
  }

  // Tenure rule: below the type's required tenure the request is still
  // allowed but flagged unpaid (potong gaji) and never touches the quota.
  let isUnpaid = false;
  if (leaveType.tenureMonthsRequired > 0) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { joinDate: true } });
    if (me?.joinDate && monthsBetween(me.joinDate, start) < leaveType.tenureMonthsRequired) {
      isUnpaid = true;
    }
  }

  const year = start.getUTCFullYear();

  let request;
  try {
    request = await prisma.$transaction(async (tx) => {
      // Guard against double-booking: any PENDING/APPROVED leave whose range
      // touches this one would deduct the balance twice.
      const overlap = await tx.leaveRequest.findFirst({
        where: {
          userId,
          status:    { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
          startDate: { lte: end },
          endDate:   { gte: start },
        },
        select: { startDate: true, endDate: true, status: true },
      });
      if (overlap) {
        const fmt = (d: Date) => d.toISOString().slice(0, 10);
        throw new AppError(
          `Rentang tanggal bertabrakan dengan pengajuan cuti kamu yang ${overlap.status === 'PENDING' ? 'masih menunggu' : 'sudah disetujui'} (${fmt(overlap.startDate)} s/d ${fmt(overlap.endDate)})`,
          400,
        );
      }

      if (isBalanceTracked(leaveType) && !isUnpaid) {
        const balance = await materializeBalance(tx, userId, leaveType, year);
        const remaining = balance.totalDays - balance.usedDays - balance.pendingDays;
        if (totalDays > remaining) {
          throw new AppError(`Saldo cuti tidak cukup. Tersisa ${remaining} hari`, 400);
        }
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data:  { pendingDays: { increment: totalDays } },
        });
      }

      return tx.leaveRequest.create({
        data: { userId, leaveTypeId, startDate: start, endDate: end, totalDays, reason, isUnpaid, attachmentUrl, attachmentName },
        include: { user: { select: USER_SELECT }, leaveType: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (err) {
    // P2034: write conflict/deadlock under Serializable isolation — two concurrent
    // submissions raced on the same balance row, safer to ask the user to retry
    // than to risk a negative balance.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw new AppError('Ada pengajuan lain yang bersamaan, silakan coba lagi', 409);
    }
    throw err;
  }

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
  id: string, reviewerId: string, reviewScope: string, divisionId: string,
  body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null },
) {

  const req = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { leaveType: true, user: { select: { divisionId: true } } },
  });
  if (!req) throw new AppError('Pengajuan cuti tidak ditemukan', 404);
  if (req.status !== LeaveStatus.PENDING) throw new AppError('Pengajuan ini sudah diproses', 400);
  if (req.userId === reviewerId) throw new AppError('Tidak bisa mereview pengajuan cuti sendiri', 403);
  if (reviewScope === 'division' && req.user.divisionId !== divisionId) {
    throw new AppError('Akses ditolak', 403);
  }

  const { status, reviewNote } = body;
  const year = new Date(req.startDate).getUTCFullYear();

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id },
      data: { status, reviewNote: reviewNote ?? null, reviewedById: reviewerId, reviewedAt: new Date() },
    });
    if (isBalanceTracked(req.leaveType) && !req.isUnpaid) {
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
    if (isBalanceTracked(req.leaveType) && !req.isUnpaid) {
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
  let activeShift = userRecord?.shift?.isActive ? userRecord.shift : null;
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

  // An APPROVED advance late-excuse for today neutralises the late flag —
  // the lateness was known and sanctioned beforehand.
  if (isLate) {
    const excuse = await prisma.lateExcuseRequest.findFirst({
      where: { userId, date: dateVal, status: RequestStatus.APPROVED },
    });
    if (excuse) {
      isLate = false;
      lateMinutes = 0;
    }
  }

  // Geofencing check (only if GPS provided)
  let officeLocationId: string | null = null;
  const { lat, lng, locationName, outOfAreaReason } = body;
  let resolvedIsOutOfArea = false;

  if (body.status !== 'WFH') {
    const locations = await prisma.officeLocation.findMany({ where: { isActive: true } });
    if (locations.length > 0 && (lat == null || lng == null)) {
      throw new AppError('Lokasi tidak terdeteksi. Aktifkan GPS dan coba check-in lagi.', 422);
    }
    if (locations.length > 0 && lat != null && lng != null) {
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

  let target = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: dateVal } },
  });
  let targetDate = dateVal;

  // Overnight shift: a guard who clocked in at 22:00 checks out past
  // midnight — today has no open record, but yesterday's is still open.
  // Close that one instead of rejecting the checkout.
  if (!target?.checkIn) {
    const yesterday = new Date(dateVal);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const prev = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: yesterday } },
    });
    if (prev?.checkIn && !prev.checkOut) {
      target = prev;
      targetDate = yesterday;
    } else {
      throw new AppError('Kamu belum check-in hari ini', 400);
    }
  }
  if (target.checkOut) throw new AppError('Kamu sudah check-out hari ini', 400);

  const now = new Date();
  const workMinutes = Math.floor((now.getTime() - target.checkIn!.getTime()) / 60000);

  return prisma.attendance.update({
    where: { userId_date: { userId, date: targetDate } },
    data:  { checkOut: now, workMinutes, note: body.note ?? target.note },
  });
}

export async function listAttendanceService(
  callerId: string, manageScope: string, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);
  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();

  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const endOfMonth   = new Date(year, month, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  const where: Prisma.AttendanceWhereInput = { date: { gte: startOfMonth, lte: endOfMonth } };
  if (manageScope === 'all') {
    if (query.userId) where.userId = query.userId as string;
  } else if (manageScope === 'division') {
    where.user = { divisionId };
    if (query.userId) where.userId = query.userId as string;
  } else {
    where.userId = callerId;
  }
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
  id: string, editScope: string, divisionId: string,
  body: { status?: AttendanceStatus; note?: string | null; checkIn?: string | null; checkOut?: string | null },
) {
  const existing = await prisma.attendance.findUnique({
    where: { id },
    include: { user: { select: { divisionId: true } } },
  });
  if (!existing) throw new AppError('Record absensi tidak ditemukan', 404);
  if (editScope === 'division' && existing.user.divisionId !== divisionId) {
    throw new AppError('Akses ditolak', 403);
  }

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

export async function createShiftService(body: {
  name: string; startTime: string; endTime: string;
  lateThresholdMinutes?: number; isDefault?: boolean; color?: string;
}) {
  if (body.isDefault) {
    await prisma.shift.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  return prisma.shift.create({ data: body });
}

export async function updateShiftService(id: string, body: {
  name?: string; startTime?: string; endTime?: string;
  lateThresholdMinutes?: number; isDefault?: boolean; color?: string; isActive?: boolean;
}) {
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) throw new AppError('Shift tidak ditemukan', 404);
  if (body.isDefault) {
    await prisma.shift.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
  }
  return prisma.shift.update({ where: { id }, data: body });
}

export async function deleteShiftService(id: string) {
  const shift = await prisma.shift.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!shift) throw new AppError('Shift tidak ditemukan', 404);
  if (shift.isDefault) throw new AppError('Tidak bisa hapus shift default', 400);
  if (shift._count.users > 0) throw new AppError(`Shift ini masih dipakai oleh ${shift._count.users} karyawan`, 400);
  return prisma.shift.delete({ where: { id } });
}

export async function assignShiftService(userId: string, shiftId: string | null) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User tidak ditemukan', 404);
  return prisma.user.update({
    where: { id: userId },
    data: { shiftId },
    select: { id: true, fullName: true, username: true, avatar: true, shiftId: true },
  });
}

export async function listUsersForShiftService() {
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

export async function createOfficeLocationService(body: {
  name: string; address?: string | null; lat: number; lng: number; radiusMeters?: number;
}) {
  return prisma.officeLocation.create({ data: body });
}

export async function updateOfficeLocationService(id: string, body: {
  name?: string; address?: string | null; lat?: number; lng?: number; radiusMeters?: number; isActive?: boolean;
}) {
  const loc = await prisma.officeLocation.findUnique({ where: { id } });
  if (!loc) throw new AppError('Lokasi tidak ditemukan', 404);
  return prisma.officeLocation.update({ where: { id }, data: body });
}

export async function deleteOfficeLocationService(id: string) {
  const loc = await prisma.officeLocation.findUnique({ where: { id } });
  if (!loc) throw new AppError('Lokasi tidak ditemukan', 404);
  return prisma.officeLocation.delete({ where: { id } });
}

// ── Attendance Reports ─────────────────────────────────────────

export async function getAttendanceReportsService(callerId: string, permScope: string, query: ParsedQs) {
  const now   = new Date();
  const month = query.month ? Number(query.month) : now.getMonth() + 1;
  const year  = query.year  ? Number(query.year)  : now.getFullYear();

  const startOfMonth = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const endOfMonth   = new Date(year, month, 0);
  endOfMonth.setUTCHours(23, 59, 59, 999);

  // Scope by user/division based on permScope ('division' = own division only, 'all' = everyone)
  let userWhere: Prisma.UserWhereInput = {};
  if (query.userId) {
    userWhere = { id: query.userId as string };
  } else if (query.divisionId) {
    userWhere = { divisionId: query.divisionId as string };
  } else if (permScope === 'division') {
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

  // Working days in month (Mon–Fri minus company holidays)
  const holidaySet = await getHolidaySet(startOfMonth, endOfMonth);
  const workingDays = countWorkdays(startOfMonth, endOfMonth, holidaySet);

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

// ── Holidays (company calendar / tanggal merah) ────────────────

export async function listHolidaysService(year: number) {
  return prisma.holiday.findMany({
    where: { date: { gte: parseDate(`${year}-01-01`), lte: parseDate(`${year}-12-31`) } },
    orderBy: { date: 'asc' },
  });
}

export async function createHolidayService(body: { date: string; name: string }) {
  const date = parseDate(body.date);
  const existing = await prisma.holiday.findUnique({ where: { date } });
  if (existing) throw new AppError(`Tanggal tersebut sudah terdaftar sebagai "${existing.name}"`, 400);
  return prisma.holiday.create({ data: { date, name: body.name } });
}

export async function deleteHolidayService(id: string) {
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) throw new AppError('Hari libur tidak ditemukan', 404);
  return prisma.holiday.delete({ where: { id } });
}

// ── Shift Change Requests (timetable) ──────────────────────────

export async function listShiftChangeRequestsService(
  callerId: string, reviewScope: string, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.ShiftChangeRequestWhereInput = {};
  if (reviewScope === 'all') {
    if (query.userId) where.userId = query.userId as string;
  } else if (reviewScope === 'division') {
    where.user = { divisionId };
    if (query.userId) where.userId = query.userId as string;
  } else {
    where.userId = callerId;
  }
  if (query.status) where.status = query.status as RequestStatus;

  const [items, total] = await prisma.$transaction([
    prisma.shiftChangeRequest.findMany({
      where, skip, take: limit,
      include: {
        user:           { select: USER_SELECT },
        requestedShift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
        reviewedBy:     { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.shiftChangeRequest.count({ where }),
  ]);

  return { shiftChangeRequests: items, meta: buildMeta(total, page, limit) };
}

export async function createShiftChangeRequestService(userId: string, body: {
  requestedShiftId: string; effectiveDate: string; reason: string;
}) {
  const shift = await prisma.shift.findUnique({ where: { id: body.requestedShiftId } });
  if (!shift || !shift.isActive) throw new AppError('Shift tidak ditemukan', 404);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { shiftId: true, fullName: true, divisionId: true },
  });
  if (user?.shiftId === body.requestedShiftId) {
    throw new AppError('Kamu sudah berada di shift tersebut', 400);
  }

  const pending = await prisma.shiftChangeRequest.findFirst({
    where: { userId, status: RequestStatus.PENDING },
  });
  if (pending) throw new AppError('Masih ada pengajuan perubahan shift yang menunggu review', 400);

  const request = await prisma.shiftChangeRequest.create({
    data: {
      userId,
      requestedShiftId: body.requestedShiftId,
      effectiveDate:    parseDate(body.effectiveDate),
      reason:           body.reason,
    },
    include: {
      user:           { select: USER_SELECT },
      requestedShift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
    },
  });

  if (user) {
    const managers = await prisma.user.findMany({
      where: { divisionId: user.divisionId, role: { level: { lte: 4 } }, id: { not: userId } },
      select: { id: true },
    });
    await Promise.all(managers.map((m) =>
      sendHRISNotif(
        NotificationType.SYSTEM, userId, m.id,
        'Pengajuan Perubahan Shift',
        `${user.fullName} mengajukan pindah ke shift ${shift.name} mulai ${body.effectiveDate}.`,
        '/hris/requests',
      ),
    ));
  }

  return request;
}

export async function reviewShiftChangeRequestService(
  id: string, reviewerId: string, reviewScope: string, divisionId: string,
  body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null },
) {
  const req = await prisma.shiftChangeRequest.findUnique({
    where: { id },
    include: { user: { select: { divisionId: true } }, requestedShift: { select: { name: true } } },
  });
  if (!req) throw new AppError('Pengajuan tidak ditemukan', 404);
  if (req.status !== RequestStatus.PENDING) throw new AppError('Pengajuan ini sudah diproses', 400);
  if (req.userId === reviewerId) throw new AppError('Tidak bisa mereview pengajuan sendiri', 403);
  if (reviewScope === 'division' && req.user.divisionId !== divisionId) {
    throw new AppError('Akses ditolak', 403);
  }

  // Approval applies the new shift to the user immediately — effectiveDate is
  // informational for HR; late detection always uses the user's current shift.
  const updated = await prisma.$transaction(async (tx) => {
    const r = await tx.shiftChangeRequest.update({
      where: { id },
      data: { status: body.status as RequestStatus, reviewNote: body.reviewNote ?? null, reviewedById: reviewerId, reviewedAt: new Date() },
      include: {
        user:           { select: USER_SELECT },
        requestedShift: { select: { id: true, name: true, startTime: true, endTime: true, color: true } },
        reviewedBy:     { select: USER_SELECT },
      },
    });
    if (body.status === 'APPROVED') {
      await tx.user.update({ where: { id: req.userId }, data: { shiftId: req.requestedShiftId } });
    }
    return r;
  });

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } });
  await sendHRISNotif(
    NotificationType.SYSTEM, reviewerId, req.userId,
    body.status === 'APPROVED' ? 'Perubahan Shift Disetujui' : 'Perubahan Shift Ditolak',
    body.status === 'APPROVED'
      ? `${reviewer?.fullName ?? 'HRD'} menyetujui pindah shift kamu ke ${req.requestedShift.name}.`
      : `${reviewer?.fullName ?? 'HRD'} menolak pengajuan pindah shift kamu${body.reviewNote ? ': ' + body.reviewNote : '.'}`,
    '/hris/requests',
  );

  return updated;
}

export async function cancelShiftChangeRequestService(id: string, userId: string) {
  const req = await prisma.shiftChangeRequest.findUnique({ where: { id } });
  if (!req) throw new AppError('Pengajuan tidak ditemukan', 404);
  if (req.userId !== userId) throw new AppError('Bukan pengajuan kamu', 403);
  if (req.status !== RequestStatus.PENDING) throw new AppError('Hanya pengajuan PENDING yang bisa dibatalkan', 400);
  return prisma.shiftChangeRequest.update({ where: { id }, data: { status: RequestStatus.CANCELLED } });
}

// ── Late Excuse Requests (izin telat di muka) ──────────────────

export async function listLateExcuseRequestsService(
  callerId: string, reviewScope: string, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.LateExcuseRequestWhereInput = {};
  if (reviewScope === 'all') {
    if (query.userId) where.userId = query.userId as string;
  } else if (reviewScope === 'division') {
    where.user = { divisionId };
    if (query.userId) where.userId = query.userId as string;
  } else {
    where.userId = callerId;
  }
  if (query.status) where.status = query.status as RequestStatus;

  const [items, total] = await prisma.$transaction([
    prisma.lateExcuseRequest.findMany({
      where, skip, take: limit,
      include: { user: { select: USER_SELECT }, reviewedBy: { select: USER_SELECT } },
      orderBy: { date: 'desc' },
    }),
    prisma.lateExcuseRequest.count({ where }),
  ]);

  return { lateExcuseRequests: items, meta: buildMeta(total, page, limit) };
}

export async function createLateExcuseRequestService(userId: string, body: {
  date: string; expectedTime?: string | null; reason: string;
}) {
  // Advance notice only — for a past date the lateness already happened.
  if (body.date < todayJakarta()) {
    throw new AppError('Tidak bisa mengajukan izin telat untuk tanggal yang sudah lewat', 400);
  }

  const dateVal = parseDate(body.date);
  const existing = await prisma.lateExcuseRequest.findFirst({
    where: { userId, date: dateVal, status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] } },
  });
  if (existing) throw new AppError('Sudah ada pengajuan izin telat untuk tanggal ini', 400);

  const request = await prisma.lateExcuseRequest.create({
    data: { userId, date: dateVal, expectedTime: body.expectedTime ?? null, reason: body.reason },
    include: { user: { select: USER_SELECT } },
  });

  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { divisionId: true, fullName: true } });
  if (requester) {
    const managers = await prisma.user.findMany({
      where: { divisionId: requester.divisionId, role: { level: { lte: 4 } }, id: { not: userId } },
      select: { id: true },
    });
    await Promise.all(managers.map((m) =>
      sendHRISNotif(
        NotificationType.SYSTEM, userId, m.id,
        'Pengajuan Izin Telat',
        `${requester.fullName} mengajukan izin telat pada ${body.date}${body.expectedTime ? ` (perkiraan tiba ${body.expectedTime})` : ''}.`,
        '/hris/requests',
      ),
    ));
  }

  return request;
}

export async function reviewLateExcuseRequestService(
  id: string, reviewerId: string, reviewScope: string, divisionId: string,
  body: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null },
) {
  const req = await prisma.lateExcuseRequest.findUnique({
    where: { id },
    include: { user: { select: { divisionId: true } } },
  });
  if (!req) throw new AppError('Pengajuan tidak ditemukan', 404);
  if (req.status !== RequestStatus.PENDING) throw new AppError('Pengajuan ini sudah diproses', 400);
  if (req.userId === reviewerId) throw new AppError('Tidak bisa mereview pengajuan sendiri', 403);
  if (reviewScope === 'division' && req.user.divisionId !== divisionId) {
    throw new AppError('Akses ditolak', 403);
  }

  const updated = await prisma.lateExcuseRequest.update({
    where: { id },
    data: { status: body.status as RequestStatus, reviewNote: body.reviewNote ?? null, reviewedById: reviewerId, reviewedAt: new Date() },
    include: { user: { select: USER_SELECT }, reviewedBy: { select: USER_SELECT } },
  });

  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { fullName: true } });
  await sendHRISNotif(
    NotificationType.SYSTEM, reviewerId, req.userId,
    body.status === 'APPROVED' ? 'Izin Telat Disetujui' : 'Izin Telat Ditolak',
    body.status === 'APPROVED'
      ? `${reviewer?.fullName ?? 'HRD'} menyetujui izin telat kamu pada ${req.date.toISOString().slice(0, 10)} — check-in tidak akan dihitung telat.`
      : `${reviewer?.fullName ?? 'HRD'} menolak izin telat kamu${body.reviewNote ? ': ' + body.reviewNote : '.'}`,
    '/hris/requests',
  );

  return updated;
}

export async function cancelLateExcuseRequestService(id: string, userId: string) {
  const req = await prisma.lateExcuseRequest.findUnique({ where: { id } });
  if (!req) throw new AppError('Pengajuan tidak ditemukan', 404);
  if (req.userId !== userId) throw new AppError('Bukan pengajuan kamu', 403);
  if (req.status !== RequestStatus.PENDING) throw new AppError('Hanya pengajuan PENDING yang bisa dibatalkan', 400);
  return prisma.lateExcuseRequest.update({ where: { id }, data: { status: RequestStatus.CANCELLED } });
}

// ── Comp-Off Grants (ganti off) ────────────────────────────────

export async function grantCompOffService(
  granterId: string,
  body: { userId: string; days: number; reason: string },
) {
  const leaveType = await prisma.leaveType.findFirst({ where: { earnedBalance: true, isActive: true } });
  if (!leaveType) throw new AppError('Jenis cuti Ganti Off belum dikonfigurasi', 400);
  if (body.userId === granterId) throw new AppError('Tidak bisa memberi ganti off ke diri sendiri', 403);

  const target = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true, isActive: true } });
  if (!target || !target.isActive) throw new AppError('User tidak ditemukan', 404);

  const year = Number(todayJakarta().slice(0, 4));

  const grant = await prisma.$transaction(async (tx) => {
    const balance = await materializeBalance(tx, body.userId, leaveType, year);
    await tx.leaveBalance.update({
      where: { id: balance.id },
      data:  { totalDays: { increment: body.days } },
    });
    return tx.compOffGrant.create({
      data: { userId: body.userId, days: body.days, reason: body.reason, grantedById: granterId },
      include: { user: { select: USER_SELECT }, grantedBy: { select: USER_SELECT } },
    });
  });

  await sendHRISNotif(
    NotificationType.SYSTEM, granterId, body.userId,
    'Ganti Off Diberikan',
    `Kamu mendapat ${body.days} hari ganti off: ${body.reason}`,
    '/hris/leave',
  );

  return grant;
}

export async function listCompOffGrantsService(
  callerId: string, reviewScope: string, divisionId: string, query: ParsedQs,
) {
  const { page, limit, skip } = parsePagination(query);

  const where: Prisma.CompOffGrantWhereInput = {};
  if (reviewScope === 'all') {
    if (query.userId) where.userId = query.userId as string;
  } else if (reviewScope === 'division') {
    where.user = { divisionId };
    if (query.userId) where.userId = query.userId as string;
  } else {
    where.userId = callerId;
  }

  const [items, total] = await prisma.$transaction([
    prisma.compOffGrant.findMany({
      where, skip, take: limit,
      include: { user: { select: USER_SELECT }, grantedBy: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.compOffGrant.count({ where }),
  ]);

  return { grants: items, meta: buildMeta(total, page, limit) };
}
