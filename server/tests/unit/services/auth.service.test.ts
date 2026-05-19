import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, Role, Division } from '@prisma/client';

// Mock modules SEBELUM import service
jest.mock('@/config/database', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

// Mock bcryptjs agar unit test tidak bergantung pada komputasi hash sungguhan
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$hashed$'),
}));

import { prisma } from '@/config/database';
import bcrypt from 'bcryptjs';

const bcryptCompareMock = bcrypt.compare as jest.Mock;
import {
  loginService,
  registerService,
  refreshTokenService,
  changePasswordService,
  getMeService,
} from '@/services/auth.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const MOCK_USER = {
  id: 'user-uuid-1',
  email: 'admin@sangroup.id',
  username: 'superadmin',
  password: '$hashed$', // bcrypt dipanggil via mock
  fullName: 'Super Admin',
  phone: '08100000000',
  avatar: null,
  role: Role.SUPER_ADMIN,
  division: Division.MANAGEMENT,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  mockReset(prismaMock);
  bcryptCompareMock.mockReset();
});

// ── loginService ───────────────────────────────────────────
describe('loginService', () => {
  it('returns accessToken and user (password excluded) on valid credentials', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MOCK_USER);
    prismaMock.$transaction.mockResolvedValue([]);
    bcryptCompareMock.mockResolvedValue(true);

    const result = await loginService('admin@sangroup.id', 'Password123');

    expect(result.accessToken).toBeDefined();
    expect(result.user).not.toHaveProperty('password');
    expect(result.user.email).toBe('admin@sangroup.id');
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'admin@sangroup.id' }, { username: 'admin@sangroup.id' }] },
    });
  });

  it('can login with username as identifier', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MOCK_USER);
    prismaMock.$transaction.mockResolvedValue([]);
    bcryptCompareMock.mockResolvedValue(true);

    const result = await loginService('superadmin', 'Password123');

    expect(result.accessToken).toBeDefined();
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'superadmin' }, { username: 'superadmin' }] },
    });
  });

  it('throws 401 when user not found', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(loginService('nobody@x.com', 'Password123')).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining('salah'),
    });
  });

  it('throws 401 on wrong password', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MOCK_USER);
    bcryptCompareMock.mockResolvedValue(false);

    await expect(loginService('admin@sangroup.id', 'WrongPass999')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 403 when user is inactive', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...MOCK_USER, isActive: false });
    bcryptCompareMock.mockResolvedValue(true);

    await expect(loginService('admin@sangroup.id', 'Password123')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

// ── registerService ────────────────────────────────────────
describe('registerService', () => {
  it('creates and returns user without password', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = MOCK_USER;
    prismaMock.user.create.mockResolvedValue(safeUser as typeof MOCK_USER);

    const result = await registerService({
      email: 'new@sangroup.id',
      username: 'newuser',
      password: 'Password123',
      fullName: 'New User',
      division: Division.OPS,
    });

    expect(result).not.toHaveProperty('password');
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
  });

  it('throws 409 when email already exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MOCK_USER);

    await expect(
      registerService({
        email: 'admin@sangroup.id',
        username: 'different',
        password: 'Password123',
        fullName: 'Dup',
        division: Division.OPS,
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Email') });
  });

  it('throws 409 when username already exists', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...MOCK_USER, email: 'other@x.com' });

    await expect(
      registerService({
        email: 'brand-new@sangroup.id',
        username: 'superadmin',
        password: 'Password123',
        fullName: 'Dup',
        division: Division.OPS,
      }),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('Username') });
  });
});

// ── refreshTokenService ────────────────────────────────────
describe('refreshTokenService', () => {
  it('throws 401 on invalid token string', async () => {
    await expect(refreshTokenService('not-a-jwt')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('throws 401 when token not in DB', async () => {
    // Generate a real-looking token using env secrets
    const jwt = await import('jsonwebtoken');
    const token = jwt.sign(
      { userId: 'x', email: 'x@x.com', username: 'x', role: 'STAFF' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' },
    );

    prismaMock.refreshToken.findUnique.mockResolvedValue(null);

    await expect(refreshTokenService(token)).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── changePasswordService ──────────────────────────────────
describe('changePasswordService', () => {
  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(changePasswordService('bad-id', 'old', 'New123!')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 400 when old password does not match', async () => {
    prismaMock.user.findUnique.mockResolvedValue(MOCK_USER);

    await expect(
      changePasswordService(MOCK_USER.id, 'WrongOld', 'NewPass123'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── getMeService ───────────────────────────────────────────
describe('getMeService', () => {
  it('returns user without password', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = MOCK_USER;
    prismaMock.user.findUnique.mockResolvedValue(safeUser as typeof MOCK_USER);

    const result = await getMeService(MOCK_USER.id);

    expect(result).not.toHaveProperty('password');
    expect(result.id).toBe(MOCK_USER.id);
  });

  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(getMeService('nonexistent-id')).rejects.toMatchObject({ statusCode: 404 });
  });
});
