import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, testPrisma, disconnectTestDb } from '../helpers/db';

let adminToken: string;
let staffToken: string;
let adminId: string;
let staffRoleId: string;
let staffDivisionId: string;

async function loginAs(identifier: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier, password: 'Password123' });
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  await cleanDatabase();

  const admin = await createTestUser({
    email: 'admin@sangroup.id',
    username: 'adminuser',
    role: 'SUPER_ADMIN',
    division: 'MANAGEMENT',
  });
  adminId = admin.id;
  adminToken = await loginAs('admin@sangroup.id');

  const staff = await createTestUser({
    email: 'staff@sangroup.id',
    username: 'staffuser',
    role: 'STAFF',
    division: 'OPS',
  });
  staffRoleId     = staff.role.id;
  staffDivisionId = staff.division.id;
  staffToken = await loginAs('staff@sangroup.id');
});

afterAll(async () => {
  await disconnectTestDb();
});

// ── GET /api/users ─────────────────────────────────────────
describe('GET /api/users', () => {
  it('200 — returns paginated user list', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({
      total: expect.any(Number),
      page: 1,
      limit: expect.any(Number),
    });
  });

  it('200 — pagination: limit=1 returns 1 item', async () => {
    const res = await request(app)
      .get('/api/users?limit=1&page=1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.limit).toBe(1);
  });

  it('200 — search by name', async () => {
    const res = await request(app)
      .get('/api/users?search=admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { fullName: string }) =>
      u.fullName.toLowerCase().includes('admin') ||
      'admin@sangroup.id'.includes('admin')
    )).toBe(true);
  });

  it('200 — filter by role', async () => {
    const res = await request(app)
      .get('/api/users?role=STAFF')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { role: { slug: string } }) => u.role.slug === 'STAFF')).toBe(true);
  });

  it('200 — filter by isActive=false returns empty (no inactive users)', async () => {
    const res = await request(app)
      .get('/api/users?isActive=false')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  it('data tidak mengandung password field', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body.data.every((u: object) => !('password' in u))).toBe(true);
  });
});

// ── GET /api/users/:id ─────────────────────────────────────
describe('GET /api/users/:id', () => {
  it('200 — returns user detail', async () => {
    const res = await request(app)
      .get(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(adminId);
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('404 — user tidak ditemukan', async () => {
    const res = await request(app)
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });

  it('422 — ID bukan UUID valid', async () => {
    const res = await request(app)
      .get('/api/users/not-a-uuid')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(422);
  });
});

// ── POST /api/users ────────────────────────────────────────
describe('POST /api/users', () => {
  const newUserPayload = () => ({
    email: 'newuser@sangroup.id',
    username: 'newuser',
    password: 'Password123',
    fullName: 'New User',
    roleId:     staffRoleId,
    divisionId: staffDivisionId,
  });

  it('201 — SUPER_ADMIN bisa create user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newUserPayload());

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('newuser@sangroup.id');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('403 — STAFF tidak bisa create user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(newUserPayload());

    expect(res.status).toBe(403);
  });

  it('409 — email duplikat ditolak', async () => {
    // Create first
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newUserPayload());

    // Create again with same email
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newUserPayload(), username: 'different-username' });

    expect(res.status).toBe(409);
  });

  it('422 — validasi: email tidak valid', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newUserPayload(), email: 'bukan-email' });

    expect(res.status).toBe(422);
  });

  it('422 — validasi: password terlalu pendek', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...newUserPayload(), password: '123' });

    expect(res.status).toBe(422);
  });
});

// ── PATCH /api/users/:id ───────────────────────────────────
describe('PATCH /api/users/:id', () => {
  it('200 — update fullName berhasil', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Updated Admin Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.fullName).toBe('Updated Admin Name');
  });

  it('403 — STAFF tidak bisa update', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ fullName: 'Hacker' });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /api/users/:id/toggle ───────────────────────────
describe('PATCH /api/users/:id/toggle', () => {
  it('200 — SUPER_ADMIN bisa toggle user lain', async () => {
    const staffRes = await testPrisma.user.findFirst({
      where: { email: 'staff@sangroup.id' },
    });

    const res = await request(app)
      .patch(`/api/users/${staffRes!.id}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('400 — tidak bisa toggle diri sendiri', async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('403 — STAFF tidak bisa toggle', async () => {
    const staffRes = await testPrisma.user.findFirst({
      where: { email: 'staff@sangroup.id' },
    });

    const res = await request(app)
      .patch(`/api/users/${staffRes!.id}/toggle`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/users/:id ──────────────────────────────────
describe('DELETE /api/users/:id', () => {
  it('200 — soft delete: isActive menjadi false', async () => {
    const staff = await testPrisma.user.findFirst({
      where: { email: 'staff@sangroup.id' },
    });

    const res = await request(app)
      .delete(`/api/users/${staff!.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    // Verifikasi di DB
    const inDb = await testPrisma.user.findUnique({ where: { id: staff!.id } });
    expect(inDb!.isActive).toBe(false);
  });

  it('400 — tidak bisa delete diri sendiri', async () => {
    const res = await request(app)
      .delete(`/api/users/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
  });

  it('403 — STAFF tidak bisa delete', async () => {
    const staff = await testPrisma.user.findFirst({
      where: { email: 'staff@sangroup.id' },
    });

    const res = await request(app)
      .delete(`/api/users/${staff!.id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — user tidak ditemukan', async () => {
    const res = await request(app)
      .delete('/api/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
