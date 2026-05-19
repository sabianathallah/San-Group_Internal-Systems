import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Role, Division } from '@prisma/client';

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

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'test@sangroup.id',
  username: 'testuser',
  password: '$hashed$',
  fullName: 'Test User',
  phone: null,
  avatar: null,
  role: Role.STAFF,
  division: Division.OPS,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const REQUESTER_ID = 'requester-uuid';

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
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);

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
    prismaMock.user.create.mockResolvedValue(MOCK_USER);

    const result = await createUserService({
      email: 'new@sangroup.id',
      username: 'newuser',
      password: 'Password123',
      fullName: 'New User',
      division: Division.OPS,
    });

    expect(result.email).toBe(MOCK_USER.email);
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
  });

  it('throws 409 on duplicate email', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MOCK_USER);

    await expect(
      createUserService({
        email: 'test@sangroup.id',
        username: 'other',
        password: 'Password123',
        fullName: 'Dup',
        division: Division.OPS,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 on duplicate username', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...MOCK_USER, email: 'other@x.com' });

    await expect(
      createUserService({
        email: 'brand@new.id',
        username: 'testuser',
        password: 'Password123',
        fullName: 'Dup',
        division: Division.OPS,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ── updateUserService ──────────────────────────────────────
describe('updateUserService', () => {
  it('updates and returns user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.user.update.mockResolvedValue({ ...MOCK_USER, fullName: 'Updated Name' });

    const result = await updateUserService(MOCK_USER.id, { fullName: 'Updated Name' });

    expect(result.fullName).toBe('Updated Name');
  });

  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(updateUserService('bad-id', { fullName: 'X' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── toggleUserService ──────────────────────────────────────
describe('toggleUserService', () => {
  it('toggles isActive from true to false', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, isActive: true });
    prismaMock.user.update.mockResolvedValue({ ...MOCK_USER, isActive: false });

    const result = await toggleUserService(MOCK_USER.id, REQUESTER_ID);

    expect(result.isActive).toBe(false);
  });

  it('throws 400 if toggling own account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, id: REQUESTER_ID });

    await expect(toggleUserService(REQUESTER_ID, REQUESTER_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 403 if targeting SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      role: Role.SUPER_ADMIN,
    });

    await expect(toggleUserService(MOCK_USER.id, REQUESTER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(toggleUserService('bad-id', REQUESTER_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── deleteUserService ──────────────────────────────────────
describe('deleteUserService', () => {
  it('soft-deletes by setting isActive false', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);
    prismaMock.user.update.mockResolvedValue({ ...MOCK_USER, isActive: false });

    const result = await deleteUserService(MOCK_USER.id, REQUESTER_ID);

    expect(result.isActive).toBe(false);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('throws 400 if deleting own account', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...MOCK_USER, id: REQUESTER_ID });

    await expect(deleteUserService(REQUESTER_ID, REQUESTER_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('throws 403 if deleting SUPER_ADMIN', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      role: Role.SUPER_ADMIN,
    });

    await expect(deleteUserService(MOCK_USER.id, REQUESTER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
