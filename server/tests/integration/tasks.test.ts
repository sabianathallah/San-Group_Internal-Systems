import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, disconnectTestDb } from '../helpers/db';

let adminToken: string;
let staffToken: string;
let staffId: string;

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

  const staff = await createTestUser({ email: 'staff@sangroup.id', username: 'staffuser', role: 'STAFF', division: 'OPS' });
  staffId = staff.id;
  staffToken = await loginAs('staff@sangroup.id');
});

afterAll(async () => {
  await disconnectTestDb();
});

// ── POST /api/tasks ────────────────────────────────────────
describe('POST /api/tasks', () => {
  it('201 — staff bisa buat task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Task baru', priority: 'HIGH' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Task baru');
    expect(res.body.data.priority).toBe('HIGH');
    expect(res.body.data.status).toBe('TODO');
    expect(res.body.data).not.toHaveProperty('userId');
  });

  it('201 — task dengan semua field opsional', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Task lengkap',
        description: 'Deskripsi panjang',
        status: 'IN_PROGRESS',
        priority: 'URGENT',
        category: 'IMPORTANT',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        assignedToId: staffId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    expect(res.body.data.assignee.id).toBe(staffId);
  });

  it('422 — title kosong ditolak', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: '' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'X' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/tasks ─────────────────────────────────────────
describe('GET /api/tasks', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Task staff 1' });
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Task staff 2', status: 'DONE' });
    await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Task admin 1' });
  });

  it('200 — staff hanya lihat task sendiri', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('200 — admin lihat semua task', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('200 — filter by status', async () => {
    const res = await request(app)
      .get('/api/tasks?status=DONE')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { status: string }) => t.status === 'DONE')).toBe(true);
  });

  it('200 — search by title', async () => {
    const res = await request(app)
      .get('/api/tasks?search=staff')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ── GET /api/tasks/:id ─────────────────────────────────────
describe('GET /api/tasks/:id', () => {
  it('200 — pemilik task bisa lihat detail', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Detail task' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(taskId);
    expect(res.body.data.subTasks).toBeDefined();
  });

  it('403 — staff lain tidak bisa lihat task orang', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Task admin rahasia' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — task tidak ditemukan', async () => {
    const res = await request(app)
      .get('/api/tasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/tasks/:id ───────────────────────────────────
describe('PATCH /api/tasks/:id', () => {
  it('200 — pemilik bisa update task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Update me' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'DONE', priority: 'LOW' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DONE');
    expect(res.body.data.completedAt).not.toBeNull();
  });

  it('200 — status DONE → TODO: completedAt di-clear', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Reopen me', status: 'DONE' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'TODO' });

    expect(res.status).toBe(200);
    expect(res.body.data.completedAt).toBeNull();
  });

  it('403 — staff lain tidak bisa update task orang', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Milik admin' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/tasks/:id ──────────────────────────────────
describe('DELETE /api/tasks/:id', () => {
  it('200 — pemilik bisa hapus task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Hapus saya' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(getRes.status).toBe(404);
  });

  it('403 — staff lain tidak bisa hapus task orang', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin punya' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('200 — admin bisa hapus task siapapun', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Staff punya' });
    const taskId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});
