import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, WorkOrderStatus } from '@prisma/client';

jest.mock('@/config/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '@/config/database';
import {
  changeWorkOrderStatusService,
  reviewWorkOrderService,
  deleteWorkOrderService,
  getWorkOrderByIdService,
} from '@/services/work-order.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const REQUESTER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';
const DIVISION_A = 'division-uuid-a';
const DIVISION_B = 'division-uuid-b';

function mockWO(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wo-uuid-1',
    reportedById: REQUESTER_ID,
    assignedToId: null,
    status: WorkOrderStatus.OPEN,
    title: 'AC rusak',
    reportedBy: { divisionId: DIVISION_A },
    assignee: null,
    attachments: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockReset(prismaMock);
});

// ── changeWorkOrderStatusService ────────────────────────────
describe('changeWorkOrderStatusService', () => {
  it('allows a valid transition (OPEN -> VALIDATED)', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockWO() as never);
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.VALIDATED }) as never);

    const result = await changeWorkOrderStatusService(
      'wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A,
      { status: WorkOrderStatus.VALIDATED },
    );

    expect(result.status).toBe(WorkOrderStatus.VALIDATED);
    expect(prismaMock.workOrder.update).toHaveBeenCalledTimes(1);
  });

  it('allows a valid transition (VALIDATED -> ASSIGNED)', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ status: WorkOrderStatus.VALIDATED, assignedToId: OTHER_USER_ID }) as never,
    );
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.ASSIGNED }) as never);

    const result = await changeWorkOrderStatusService(
      'wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A,
      { status: WorkOrderStatus.ASSIGNED },
    );

    expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
    expect(prismaMock.workOrder.update).toHaveBeenCalledTimes(1);
  });

  it('rejects skipping VALIDATED (OPEN -> ASSIGNED directly)', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockWO({ assignedToId: OTHER_USER_ID }) as never);

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { status: WorkOrderStatus.ASSIGNED }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.workOrder.update).not.toHaveBeenCalled();
  });

  it('rejects an invalid transition (OPEN -> DONE, skipping the workflow)', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockWO() as never);

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { status: WorkOrderStatus.DONE }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.workOrder.update).not.toHaveBeenCalled();
  });

  it('rejects a no-op transition to the same status', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockWO() as never);

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { status: WorkOrderStatus.OPEN }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a terminal status (DONE) transitioning further', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockWO({ status: WorkOrderStatus.DONE }) as never);

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { status: WorkOrderStatus.IN_PROGRESS }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("'own' scope denies a user who is neither reporter nor assignee", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ reportedById: OTHER_USER_ID, assignedToId: OTHER_USER_ID }) as never,
    );

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'own', DIVISION_A, { status: WorkOrderStatus.ASSIGNED }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("'division' scope denies access to a work order outside the caller's division", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ reportedById: OTHER_USER_ID, reportedBy: { divisionId: DIVISION_B } }) as never,
    );

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'division', DIVISION_A, { status: WorkOrderStatus.ASSIGNED }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("'division' scope allows access when the assignee shares the caller's division", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({
        status: WorkOrderStatus.VALIDATED,
        reportedById: OTHER_USER_ID,
        reportedBy: { divisionId: DIVISION_B },
        assignedToId: REQUESTER_ID,
        assignee: { divisionId: DIVISION_A },
      }) as never,
    );
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.ASSIGNED }) as never);

    const result = await changeWorkOrderStatusService(
      'wo-uuid-1', REQUESTER_ID, 'division', DIVISION_A,
      { status: WorkOrderStatus.ASSIGNED },
    );

    expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
  });

  it('throws 404 when the work order does not exist', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(null);

    await expect(
      changeWorkOrderStatusService('bad-id', REQUESTER_ID, 'all', DIVISION_A, { status: WorkOrderStatus.ASSIGNED }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getWorkOrderByIdService ──────────────────────────────────
describe('getWorkOrderByIdService', () => {
  it("'division' scope denies a work order outside the caller's division", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ reportedBy: { divisionId: DIVISION_B }, assignee: null }) as never,
    );

    await expect(
      getWorkOrderByIdService('wo-uuid-1', OTHER_USER_ID, 'division', DIVISION_A),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("'division' scope allows a work order inside the caller's division", async () => {
    const wo = mockWO({ reportedBy: { divisionId: DIVISION_A } });
    prismaMock.workOrder.findUnique.mockResolvedValue(wo as never);

    const result = await getWorkOrderByIdService('wo-uuid-1', OTHER_USER_ID, 'division', DIVISION_A);

    expect(result).toBe(wo);
  });
});

// ── deleteWorkOrderService ───────────────────────────────────
describe('deleteWorkOrderService', () => {
  it("'division' scope denies deleting a work order outside the caller's division", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ reportedBy: { divisionId: DIVISION_B }, assignee: null }) as never,
    );

    await expect(
      deleteWorkOrderService('wo-uuid-1', OTHER_USER_ID, 'division', DIVISION_A),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.workOrder.delete).not.toHaveBeenCalled();
  });

  it("'own' scope denies deleting a work order reported by someone else", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ reportedById: OTHER_USER_ID, reportedBy: { divisionId: DIVISION_A } }) as never,
    );

    await expect(
      deleteWorkOrderService('wo-uuid-1', REQUESTER_ID, 'own', DIVISION_A),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── changeWorkOrderStatusService — submit for review gate ────
describe('changeWorkOrderStatusService — submit for review', () => {
  it('rejects submitting for review without an "after" photo', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({ status: WorkOrderStatus.IN_PROGRESS, assignedToId: REQUESTER_ID, attachments: [] }) as never,
    );

    await expect(
      changeWorkOrderStatusService('wo-uuid-1', REQUESTER_ID, 'own', DIVISION_A, { status: WorkOrderStatus.PENDING_REVIEW }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.workOrder.update).not.toHaveBeenCalled();
  });

  it('allows submitting for review once an "after" photo exists', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({
        status: WorkOrderStatus.IN_PROGRESS, assignedToId: REQUESTER_ID,
        attachments: [{ type: 'AFTER' }],
      }) as never,
    );
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.PENDING_REVIEW }) as never);

    const result = await changeWorkOrderStatusService(
      'wo-uuid-1', REQUESTER_ID, 'own', DIVISION_A, { status: WorkOrderStatus.PENDING_REVIEW },
    );

    expect(result.status).toBe(WorkOrderStatus.PENDING_REVIEW);
  });

  it('allows submitting for review from PENDING_PARTS too', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockWO({
        status: WorkOrderStatus.PENDING_PARTS, assignedToId: REQUESTER_ID,
        attachments: [{ type: 'AFTER' }],
      }) as never,
    );
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.PENDING_REVIEW }) as never);

    const result = await changeWorkOrderStatusService(
      'wo-uuid-1', REQUESTER_ID, 'own', DIVISION_A, { status: WorkOrderStatus.PENDING_REVIEW },
    );

    expect(result.status).toBe(WorkOrderStatus.PENDING_REVIEW);
  });
});

// ── reviewWorkOrderService ────────────────────────────────────
describe('reviewWorkOrderService', () => {
  function mockPendingReview(overrides: Record<string, unknown> = {}) {
    return mockWO({ status: WorkOrderStatus.PENDING_REVIEW, assignedToId: OTHER_USER_ID, ...overrides });
  }

  it('approves and closes the work order', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockPendingReview() as never);
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.DONE }) as never);

    const result = await reviewWorkOrderService(
      'wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { decision: 'APPROVED' },
    );

    expect(result.status).toBe(WorkOrderStatus.DONE);
    const [{ data }] = prismaMock.workOrder.update.mock.calls[0];
    expect(data).toMatchObject({ status: WorkOrderStatus.DONE, reviewedById: REQUESTER_ID });
  });

  it('rejects without a reason', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockPendingReview() as never);

    await expect(
      reviewWorkOrderService('wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { decision: 'REJECTED' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.workOrder.update).not.toHaveBeenCalled();
  });

  it('sends a rejected work order back to IN_PROGRESS with a reason', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockPendingReview() as never);
    prismaMock.workOrder.update.mockResolvedValue(mockWO({ status: WorkOrderStatus.IN_PROGRESS }) as never);

    const result = await reviewWorkOrderService(
      'wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A,
      { decision: 'REJECTED', reviewNotes: 'Kabel masih longgar' },
    );

    expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
  });

  it('rejects reviewing a work order that is not PENDING_REVIEW', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(mockWO({ status: WorkOrderStatus.IN_PROGRESS }) as never);

    await expect(
      reviewWorkOrderService('wo-uuid-1', REQUESTER_ID, 'all', DIVISION_A, { decision: 'APPROVED' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("'division' scope denies reviewing a work order outside the caller's division", async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue(
      mockPendingReview({ reportedBy: { divisionId: DIVISION_B }, assignee: { divisionId: DIVISION_B } }) as never,
    );

    await expect(
      reviewWorkOrderService('wo-uuid-1', REQUESTER_ID, 'division', DIVISION_A, { decision: 'APPROVED' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
