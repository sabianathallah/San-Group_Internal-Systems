import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, testPrisma, disconnectTestDb } from '../helpers/db';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await disconnectTestDb();
});

// ── POST /api/auth/login ───────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await createTestUser({
      email: 'user@sangroup.id',
      username: 'testlogin',
      password: 'Password123',
      role: 'STAFF',
      division: 'OPS',
    });
  });

  it('200 — login sukses dengan email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'user@sangroup.id', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user).not.toHaveProperty('password');
    expect(res.body.data.user.email).toBe('user@sangroup.id');
  });

  it('200 — login sukses dengan username', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'testlogin', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('400 — set httpOnly cookie refresh_token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'user@sangroup.id', password: 'Password123' });

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('401 — password salah', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'user@sangroup.id', password: 'WrongPass999' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('401 — user tidak ditemukan', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@x.com', password: 'Password123' });

    expect(res.status).toBe(401);
  });

  it('403 — user nonaktif tidak bisa login', async () => {
    await createTestUser({
      email: 'inactive@sangroup.id',
      username: 'inactiveuser',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'inactive@sangroup.id', password: 'Password123' });

    expect(res.status).toBe(403);
  });

  it('422 — validasi: identifier kosong', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: '', password: 'Password123' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('422 — validasi: body kosong', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(422);
  });
});

// ── GET /api/auth/me ───────────────────────────────────────
describe('GET /api/auth/me', () => {
  let accessToken: string;

  beforeEach(async () => {
    await createTestUser({ email: 'me@sangroup.id', username: 'meuser' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'me@sangroup.id', password: 'Password123' });

    accessToken = res.body.data.accessToken;
  });

  it('200 — returns current user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@sangroup.id');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('401 — token tidak valid', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer this.is.not.valid');

    expect(res.status).toBe(401);
  });
});

// ── POST /api/auth/refresh ─────────────────────────────────
describe('POST /api/auth/refresh', () => {
  it('200 — returns new access token', async () => {
    await createTestUser({ email: 'refresh@sangroup.id', username: 'refreshuser' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'refresh@sangroup.id', password: 'Password123' });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const cookieHeader = cookies.find((c: string) => c.startsWith('refresh_token='))!;

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('401 — tanpa cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
  });
});

// ── POST /api/auth/logout ──────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('200 — logout berhasil dan clear cookie', async () => {
    await createTestUser({ email: 'logout@sangroup.id', username: 'logoutuser' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'logout@sangroup.id', password: 'Password123' });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    const cookieHeader = cookies.find((c: string) => c.startsWith('refresh_token='))!;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Refresh token seharusnya sudah dihapus dari DB
    const storedTokens = await testPrisma.refreshToken.findMany();
    expect(storedTokens).toHaveLength(0);
  });

  it('200 — logout tanpa cookie tetap berhasil', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
  });
});

// ── PATCH /api/auth/change-password ───────────────────────
describe('PATCH /api/auth/change-password', () => {
  let accessToken: string;

  beforeEach(async () => {
    await createTestUser({ email: 'change@sangroup.id', username: 'changeuser' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'change@sangroup.id', password: 'Password123' });

    accessToken = res.body.data.accessToken;
  });

  it('200 — password berhasil diubah', async () => {
    const res = await request(app)
      .patch('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldPassword: 'Password123',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

    expect(res.status).toBe(200);

    // Bisa login dengan password baru
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'change@sangroup.id', password: 'NewPassword456' });

    expect(loginRes.status).toBe(200);
  });

  it('400 — old password salah', async () => {
    const res = await request(app)
      .patch('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldPassword: 'WrongOld',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

    expect(res.status).toBe(400);
  });

  it('422 — confirm password tidak cocok', async () => {
    const res = await request(app)
      .patch('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        oldPassword: 'Password123',
        newPassword: 'NewPassword456',
        confirmPassword: 'Different789',
      });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('401 — tanpa autentikasi', async () => {
    const res = await request(app)
      .patch('/api/auth/change-password')
      .send({
        oldPassword: 'Password123',
        newPassword: 'New456',
        confirmPassword: 'New456',
      });

    expect(res.status).toBe(401);
  });
});

// ── POST /api/auth/register ────────────────────────────────
describe('POST /api/auth/register', () => {
  let adminToken: string;

  beforeEach(async () => {
    await createTestUser({
      email: 'admin@sangroup.id',
      username: 'adminreg',
      role: 'SUPER_ADMIN',
      division: 'MANAGEMENT',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'admin@sangroup.id', password: 'Password123' });

    adminToken = res.body.data.accessToken;
  });

  it('201 — SUPER_ADMIN bisa register user baru', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'newstaff@sangroup.id',
        username: 'newstaff',
        password: 'Password123',
        fullName: 'New Staff',
        division: 'OPS',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('newstaff@sangroup.id');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('401 — tanpa token tidak bisa register', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'hacker@x.com',
        username: 'hacker',
        password: 'Password123',
        fullName: 'Hacker',
        division: 'OPS',
      });

    expect(res.status).toBe(401);
  });

  it('403 — STAFF tidak bisa register user baru', async () => {
    await createTestUser({ email: 'staff@sangroup.id', username: 'staffonly', role: 'STAFF' });

    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'staff@sangroup.id', password: 'Password123' });

    const staffToken = staffRes.body.data.accessToken;

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        email: 'another@sangroup.id',
        username: 'another',
        password: 'Password123',
        fullName: 'Another',
        division: 'OPS',
      });

    expect(res.status).toBe(403);
  });
});
