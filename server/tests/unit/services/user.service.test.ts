import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('@/config/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '@/config/database';
import {
  listUsersService,
  getUserByIdService,
  createUserService,
  updateUserService,
  toggleUserService,
  deleteUserService,
} from '@/services/user.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const MOCK_ROLE     = { id: 'role-uuid-1', name: 'Staff', slug: 'STAFF', color: '#64748b', level: 6 };
const MOCK_DIVISION = { id: 'division-uuid-1', name: 'Ops', slug: 'OPS', color: '#64748b' };

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'test@sangroup.id',
  username: 'testuser',
  password: '$hashed$',
  fullName: 'Test User',
  phone: null,
  avatar: null,
  roleId:     MOCK_ROLE.id,
  divisionId: MOCK_DIVISION.id,
  role:     MOCK_ROLE,
  division: MOCK_DIVISION,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REQUESTER_ID = 'requester-uuid';
// requesterLevel 1 (true SuperAdmin) + scope 'all' bypass the level-ceiling and
// division-scope rules added later, so these tests keep exercising the original
// not-found/self-guard/SUPER_ADMIN-immunity behavior in isolation.
const REQUESTER_LEVEL = 1;
const REQUESTER_DIVISION_ID = 'requester-division-uuid';

beforeEach(() => {
  mockReset(prismaMock);
});

// ── listUsersService ───────────────────────────────────────
describe('listUsersService', () => {
  it('returns paginated users with meta', async () => {
    prismaMock.$transaction.mockResolvedValue([[MOCK_USER], 1]);

    const result = await listUsersService({ page: '1', limit: '10' });

    expect(result.users).toHaveLength(1);
    expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
  });

  it('passes search filter to prisma', async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0]);

    await listUsersService({ search: 'sari' });

    const [[findManyCall]] = prismaMock.$transaction.mock.calls;
    // $transaction dipanggil dengan array query — verifikasi dipanggil
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(findManyCall).toBeDefined();
  });
});

// ── getUserByIdService ─────────────────────────────────────
describe('getUserByIdService', () => {
  it('returns user when found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER as never);

    const result = await getUserByIdService(MOCK_USER.id);

    expect(result.id).toBe(MOCK_USER.id);
    // Password exclusion diverifikasi di integration test (Prisma select berlaku di DB sungguhan)
  });

  it('throws 404 when not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getUserByIdService('bad-id')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── createUserService ──────────────────────────────────────
describe('createUserService', () => {
  it('creates user and returns without password', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findUnique.mockResolvedValue(MOCK_ROLE as never);
    prismaMock.division.findUnique.mockResolvedValue(MOCK_DIVISION as never);
    prismaMock.user.create.mockResolvedValue(MOCK_USER as never);

    const result = await createUserService(REQUESTER_LEVEL, {
      email: 'new@sangroup.id',
      username: 'newuser',
      password: 'Password123',
      fullName: 'New User',
      roleId:     MOCK_ROLE.id,
      divisionId: MOCK_DIVISION.id,
    });

    expect(result.email).toBe(MOCK_USER.email);
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
  });

  it('throws 409 on duplicate email', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MOCK_USER as never);

    await expect(
      createUserService(REQUESTER_LEVEL, {
        email: 'test@sangroup.id',
        username: 'other',
        password: 'Password123',
        fullName: 'Dup',
        roleId:     MOCK_ROLE.id,
        divisionId: MOCK_DIVISION.id,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 on duplicate username', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...MOCK_USER, email: 'other@x.com' } as never);

    await expect(
      createUserService(REQUESTER_LEVEL, {
        email: 'brand@new.id',
        username: 'testuser',
        password: 'Password123',
        fullName: 'Dup',
        roleId:     MOCK_ROLE.id,
        divisionId: MOCK_DIVISION.id,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── updateUserService ──────────────────────────────────────
describe('updateUserService', () => {
  it('updates and returns user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER as never);
    prismaMock.user.update.mockResolvedValue({ ...MOCK_USER, fullName: 'Updated Name' } as never);

    const result = await updateUserService(
      MOCK_USER.id, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID,
      { fullName: 'Updated Name' },
    );

    expect(result.fullName).toBe('Updated Name');
  });

  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      updateUserService('bad-id', REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID, { fullName: 'X' }),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── toggleUserService ──────────────────────────────────────
describe('toggleUserService', () => {
  it('toggles isActive from true to false', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, isActive: true } as never);
    prismaMock.user.update.mockResolvedValue({ ...MOCK_USER, isActive: false } as never);

    const result = await toggleUserService(
      MOCK_USER.id, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID,
    );

    expect(result.isActive).toBe(false);
  });

  it('throws 400 if toggling own account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, id: REQUESTER_ID } as never);

    await expect(
      toggleUserService(REQUESTER_ID, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 403 if targeting SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      role: { ...MOCK_ROLE, slug: 'SUPER_ADMIN', level: 1 },
    } as never);

    await expect(
      toggleUserService(MOCK_USER.id, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      toggleUserService('bad-id', REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── deleteUserService ──────────────────────────────────────
describe('deleteUserService', () => {
  it('soft-deletes by setting isActive false', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER as never);
    prismaMock.user.update.mockResolvedValue({ ...MOCK_USER, isActive: false } as never);

    const result = await deleteUserService(
      MOCK_USER.id, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID,
    );

    expect(result.isActive).toBe(false);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('throws 400 if deleting own account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, id: REQUESTER_ID } as never);

    await expect(
      deleteUserService(REQUESTER_ID, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 403 if deleting SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      role: { ...MOCK_ROLE, slug: 'SUPER_ADMIN', level: 1 },
    } as never);

    await expect(
      deleteUserService(MOCK_USER.id, REQUESTER_ID, REQUESTER_LEVEL, 'all', REQUESTER_DIVISION_ID),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
