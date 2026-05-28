import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, disconnectTestDb } from '../helpers/db';

let adminToken: string;
let staffToken: string;

async function loginAs(identifier: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier, password: 'Password123' });
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  await cleanDatabase();
  await createTestUser({ email: 'admin@sangroup.id', username: 'adminuser', role: 'SUPER_ADMIN', division: 'MANAGEMENT' });
  adminToken = await loginAs('admin@sangroup.id');
  await createTestUser({ email: 'staff@sangroup.id', username: 'staffuser', role: 'STAFF', division: 'OPS' });
  staffToken = await loginAs('staff@sangroup.id');
});

afterAll(async () => {
  await disconnectTestDb();
});

async function createBulletin(token: string, overrides: object = {}) {
  return request(app)
    .post('/api/bulletins')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Bulletin Test', content: 'Isi bulletin', ...overrides });
}

// ── POST /api/bulletins ────────────────────────────────────
describe('POST /api/bulletins', () => {
  it('201 — admin bisa buat bulletin draft', async () => {
    const res = await createBulletin(adminToken);

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Bulletin Test');
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('201 — buat bulletin langsung published', async () => {
    const res = await createBulletin(adminToken, { isPublished: true, priority: 'URGENT' });

    expect(res.status).toBe(201);
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.publishedAt).not.toBeNull();
    expect(res.body.data.priority).toBe('URGENT');
  });

  it('403 — staff tidak bisa buat bulletin', async () => {
    const res = await createBulletin(staffToken);
    expect(res.status).toBe(403);
  });

  it('422 — title kosong ditolak', async () => {
    const res = await request(app)
      .post('/api/bulletins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '', content: 'Isi' });

    expect(res.status).toBe(422);
  });
});

// ── GET /api/bulletins ─────────────────────────────────────
describe('GET /api/bulletins', () => {
  beforeEach(async () => {
    await createBulletin(adminToken, { title: 'Draft (belum publish)', isPublished: false });
    await createBulletin(adminToken, { title: 'Published bulletin', isPublished: true });
    await createBulletin(adminToken, { title: 'Bulletin penting', isPublished: true, priority: 'IMPORTANT' });
  });

  it('200 — admin lihat semua termasuk draft', async () => {
    const res = await request(app)
      .get('/api/bulletins')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
  });

  it('200 — staff hanya lihat yang published', async () => {
    const res = await request(app)
      .get('/api/bulletins')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.every((b: { isPublished: boolean }) => b.isPublished)).toBe(true);
  });

  it('200 — setiap bulletin memiliki field isRead', async () => {
    const res = await request(app)
      .get('/api/bulletins')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((b: { isRead: boolean }) => typeof b.isRead === 'boolean')).toBe(true);
  });

  it('200 — filter admin by isPublished=false', async () => {
    const res = await request(app)
      .get('/api/bulletins?isPublished=false')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });
});

// ── GET /api/bulletins/:id ─────────────────────────────────
describe('GET /api/bulletins/:id', () => {
  it('200 — auto mark-as-read saat staff buka bulletin', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: true });
    const id = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });

  it('404 — staff tidak bisa lihat bulletin draft', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: false });
    const id = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(404);
  });

  it('200 — admin bisa lihat bulletin draft', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: false });
    const id = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// ── PATCH /api/bulletins/:id ───────────────────────────────
describe('PATCH /api/bulletins/:id', () => {
  it('200 — publish bulletin: publishedAt di-set', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: false });
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPublished: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it('200 — unpublish bulletin: publishedAt di-clear', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: true });
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPublished: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isPublished).toBe(false);
    expect(res.body.data.publishedAt).toBeNull();
  });

  it('403 — staff tidak bisa update bulletin', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: true });
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Coba ubah' });

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/bulletins/:id ──────────────────────────────
describe('DELETE /api/bulletins/:id', () => {
  it('200 — admin bisa hapus bulletin', async () => {
    const createRes = await createBulletin(adminToken);
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('403 — staff tidak bisa hapus bulletin', async () => {
    const createRes = await createBulletin(adminToken, { isPublished: true });
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/bulletins/${id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — hapus bulletin tidak ada', async () => {
    const res = await request(app)
      .delete('/api/bulletins/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
