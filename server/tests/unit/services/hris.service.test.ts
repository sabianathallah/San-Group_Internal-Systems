import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { Prisma, PrismaClient } from '@prisma/client';

jest.mock('@/config/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '@/config/database';
import {
  checkInService,
  createLeaveRequestService,
  reviewLeaveRequestService,
} from '@/services/hris.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-uuid-1';
const REVIEWER_ID = 'reviewer-uuid-1';
const DIVISION_A = 'division-uuid-a';
const DIVISION_B = 'division-uuid-b';

const OFFICE_LOCATION = {
  id: 'loc-uuid-1', name: 'Head Office', lat: -6.2, lng: 106.8, radiusMeters: 150, isActive: true,
};

beforeEach(() => {
  mockReset(prismaMock);
  // hris.service uses callback-style `prisma.$transaction(async (tx) => ...)` in
  // some places and array-style elsewhere — support both against the same mock.
  prismaMock.$transaction.mockImplementation(((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prismaMock) : Promise.all(arg as Promise<unknown>[])
  ) as never);
  // Defaults for lookups most flows consult: no company holidays, no existing
  // overlapping leave, no approved late excuse.
  prismaMock.holiday.findMany.mockResolvedValue([] as never);
  prismaMock.leaveRequest.findFirst.mockResolvedValue(null);
  prismaMock.lateExcuseRequest.findFirst.mockResolvedValue(null);
  prismaMock.role.findMany.mockResolvedValue([] as never); // no reviewer roles
  prismaMock.user.findMany.mockResolvedValue([] as never); // no reviewers to notify
});

// ── checkInService — geofencing ──────────────────────────────
describe('checkInService — geofencing', () => {
  it('rejects PRESENT check-in with no GPS coordinates when office locations exist', async () => {
    prismaMock.attendance.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ shift: null } as never);
    prismaMock.officeLocation.findMany.mockResolvedValue([OFFICE_LOCATION] as never);

    await expect(
      checkInService(USER_ID, { status: 'PRESENT' }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(prismaMock.attendance.create).not.toHaveBeenCalled();
  });

  it('allows PRESENT check-in inside the office radius', async () => {
    prismaMock.attendance.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ shift: null } as never);
    prismaMock.officeLocation.findMany.mockResolvedValue([OFFICE_LOCATION] as never);
    prismaMock.shift.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: 'att-1' } as never);

    await checkInService(USER_ID, { status: 'PRESENT', lat: -6.2, lng: 106.8 });

    expect(prismaMock.attendance.create).toHaveBeenCalledTimes(1);
    const [{ data }] = prismaMock.attendance.create.mock.calls[0];
    expect(data.isOutOfArea).toBe(false);
  });

  it('rejects out-of-area check-in when no reason is given, and accepts one with a reason', async () => {
    prismaMock.attendance.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ shift: null } as never);
    prismaMock.officeLocation.findMany.mockResolvedValue([OFFICE_LOCATION] as never);

    await expect(
      checkInService(USER_ID, { status: 'PRESENT', lat: 0, lng: 0 }),
    ).rejects.toMatchObject({ statusCode: 422 });

    prismaMock.shift.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: 'att-1' } as never);

    await checkInService(USER_ID, { status: 'PRESENT', lat: 0, lng: 0, outOfAreaReason: 'Tugas luar kantor' });
    const [{ data }] = prismaMock.attendance.create.mock.calls[0];
    expect(data.isOutOfArea).toBe(true);
  });

  it('does not require GPS for WFH check-in', async () => {
    prismaMock.attendance.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ shift: null } as never);
    prismaMock.shift.findFirst.mockResolvedValue(null);
    prismaMock.attendance.create.mockResolvedValue({ id: 'att-1' } as never);

    await checkInService(USER_ID, { status: 'WFH' });

    expect(prismaMock.officeLocation.findMany).not.toHaveBeenCalled();
    expect(prismaMock.attendance.create).toHaveBeenCalledTimes(1);
  });
});

// ── checkInService — late detection ──────────────────────────
describe('checkInService — late detection', () => {
  it('ignores an inactive assigned shift and falls back to the default shift', async () => {
    prismaMock.attendance.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      shift: { id: 'shift-old', isActive: false, startTime: '06:00', lateThresholdMinutes: 0 },
    } as never);
    prismaMock.officeLocation.findMany.mockResolvedValue([]);
    prismaMock.shift.findFirst.mockResolvedValue({
      id: 'shift-default', isActive: true, isDefault: true, startTime: '08:00', lateThresholdMinutes: 0,
    } as never);
    prismaMock.attendance.create.mockResolvedValue({ id: 'att-1' } as never);

    await checkInService(USER_ID, { status: 'PRESENT' });

    expect(prismaMock.shift.findFirst).toHaveBeenCalledWith({ where: { isDefault: true, isActive: true } });
    const [{ data }] = prismaMock.attendance.create.mock.calls[0];
    expect(data.shiftId).toBe('shift-default');
  });

  it('uses the assigned shift directly when it is active', async () => {
    prismaMock.attendance.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({
      shift: { id: 'shift-active', isActive: true, startTime: '08:00', lateThresholdMinutes: 0 },
    } as never);
    prismaMock.officeLocation.findMany.mockResolvedValue([]);
    prismaMock.attendance.create.mockResolvedValue({ id: 'att-1' } as never);

    await checkInService(USER_ID, { status: 'PRESENT' });

    expect(prismaMock.shift.findFirst).not.toHaveBeenCalled();
    const [{ data }] = prismaMock.attendance.create.mock.calls[0];
    expect(data.shiftId).toBe('shift-active');
  });
});

// ── createLeaveRequestService — balance race condition ───────
describe('createLeaveRequestService', () => {
  const LEAVE_TYPE = { id: 'lt-1', name: 'Annual Leave', isActive: true, maxDaysPerYear: 12 };

  it('rejects a request that exceeds the remaining balance', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(LEAVE_TYPE as never);
    prismaMock.leaveBalance.findUnique.mockResolvedValue(
      { totalDays: 12, usedDays: 10, pendingDays: 0 } as never,
    );

    // Mon–Fri (5 weekdays) requested, only 2 days remaining.
    await expect(
      createLeaveRequestService(USER_ID, {
        leaveTypeId: 'lt-1', startDate: '2026-08-03', endDate: '2026-08-07', reason: 'Liburan',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.leaveBalance.update).not.toHaveBeenCalled();
    expect(prismaMock.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('creates the request and increments pendingDays when balance is sufficient', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(LEAVE_TYPE as never);
    prismaMock.leaveBalance.findUnique.mockResolvedValue(
      { totalDays: 12, usedDays: 0, pendingDays: 0 } as never,
    );
    prismaMock.leaveRequest.create.mockResolvedValue({ id: 'lr-1', totalDays: 5 } as never);
    prismaMock.user.findUnique.mockResolvedValue(null); // skip manager-notification branch

    const result = await createLeaveRequestService(USER_ID, {
      leaveTypeId: 'lt-1', startDate: '2026-08-03', endDate: '2026-08-07', reason: 'Liburan',
    });

    expect(result).toMatchObject({ id: 'lr-1' });
    expect(prismaMock.leaveBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pendingDays: { increment: 5 } } }),
    );
  });

  it('rejects a range overlapping an existing PENDING/APPROVED leave', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(LEAVE_TYPE as never);
    prismaMock.leaveRequest.findFirst.mockResolvedValue({
      startDate: new Date('2026-08-05T00:00:00.000Z'),
      endDate:   new Date('2026-08-06T00:00:00.000Z'),
      status:    'APPROVED',
    } as never);

    await expect(
      createLeaveRequestService(USER_ID, {
        leaveTypeId: 'lt-1', startDate: '2026-08-03', endDate: '2026-08-07', reason: 'Liburan',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.leaveBalance.update).not.toHaveBeenCalled();
    expect(prismaMock.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('rejects a doc-required leave without an attachment (sick > 1 day)', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      ...LEAVE_TYPE, maxDaysPerYear: 0, requiresDoc: true, requiresDocAfterDays: 1,
    } as never);

    await expect(
      createLeaveRequestService(USER_ID, {
        leaveTypeId: 'lt-1', startDate: '2026-08-03', endDate: '2026-08-05', reason: 'Sakit demam',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('flags the request unpaid and skips the quota when tenure is under the requirement', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue({
      ...LEAVE_TYPE, tenureMonthsRequired: 12,
    } as never);
    // joinDate ~5 months before the leave start
    prismaMock.user.findUnique.mockResolvedValue({ joinDate: new Date('2026-03-01T00:00:00.000Z') } as never);
    prismaMock.leaveRequest.create.mockResolvedValue({ id: 'lr-2', isUnpaid: true } as never);

    const result = await createLeaveRequestService(USER_ID, {
      leaveTypeId: 'lt-1', startDate: '2026-08-03', endDate: '2026-08-07', reason: 'Liburan',
    });

    expect(result).toMatchObject({ isUnpaid: true });
    expect(prismaMock.leaveBalance.update).not.toHaveBeenCalled();
    expect(prismaMock.leaveRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isUnpaid: true }) }),
    );
  });

  it('surfaces a concurrent-submission conflict as a 409', async () => {
    prismaMock.leaveType.findUnique.mockResolvedValue(LEAVE_TYPE as never);
    prismaMock.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2034', clientVersion: '5.0.0' }),
    );

    await expect(
      createLeaveRequestService(USER_ID, {
        leaveTypeId: 'lt-1', startDate: '2026-08-03', endDate: '2026-08-03', reason: 'Sakit',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── reviewLeaveRequestService — division scope ───────────────
describe('reviewLeaveRequestService', () => {
  const PENDING_REQUEST = {
    id: 'lr-1',
    userId: USER_ID,
    status: 'PENDING',
    startDate: new Date('2026-08-03'),
    totalDays: 3,
    leaveType: { maxDaysPerYear: 12, name: 'Annual Leave' },
    user: { divisionId: DIVISION_B },
  };

  it("'division' scope denies reviewing a request outside the reviewer's division", async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue(PENDING_REQUEST as never);

    await expect(
      reviewLeaveRequestService('lr-1', REVIEWER_ID, 'division', DIVISION_A, { status: 'APPROVED' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('denies reviewing your own leave request regardless of scope', async () => {
    prismaMock.leaveRequest.findUnique.mockResolvedValue(
      { ...PENDING_REQUEST, userId: REVIEWER_ID, user: { divisionId: DIVISION_A } } as never,
    );

    await expect(
      reviewLeaveRequestService('lr-1', REVIEWER_ID, 'all', DIVISION_A, { status: 'APPROVED' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
