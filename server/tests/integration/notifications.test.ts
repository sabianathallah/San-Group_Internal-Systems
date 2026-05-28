import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, testPrisma, disconnectTestDb } from '../helpers/db';

let userToken: string;
let userId: string;

async function loginAs(identifier: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier, password: 'Password123' });
  return res.body.data.accessToken as string;
}

async function seedNotification(uId: string, isRead = false) {
  return testPrisma.notification.create({
    data: {
      userId: uId,
      type: 'SYSTEM',
      title: 'Notifikasi test',
      message: 'Pesan test',
      isRead,
    },
  });
}

beforeEach(async () => {
  await cleanDatabase();
  const user = await createTestUser({ email: 'user@sangroup.id', username: 'notifuser', role: 'STAFF', division: 'OPS' });
  userId = user.id;
  userToken = await loginAs('user@sangroup.id');
});

afterAll(async () => {
  await disconnectTestDb();
});

// ── GET /api/notifications ─────────────────────────────────
describe('GET /api/notifications', () => {
  it('200 — returns notifikasi milik user', async () => {
    await seedNotification(userId);
    await seedNotification(userId, true);

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('200 — returns array kosong bila belum ada notifikasi', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/notifications/unread-count ───────────────────
describe('GET /api/notifications/unread-count', () => {
  it('200 — returns jumlah unread yang benar', async () => {
    await seedNotification(userId, false);
    await seedNotification(userId, false);
    await seedNotification(userId, true);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });

  it('200 — returns 0 bila semua sudah dibaca', async () => {
    await seedNotification(userId, true);

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });
});

// ── PATCH /api/notifications/:id/read ─────────────────────
describe('PATCH /api/notifications/:id/read', () => {
  it('200 — mark notifikasi sebagai dibaca', async () => {
    const notif = await seedNotification(userId, false);

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });

  it('404 — notifikasi tidak ada', async () => {
    const res = await request(app)
      .patch('/api/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });

  it('404 — tidak bisa mark notifikasi user lain', async () => {
    const otherUser = await createTestUser({ email: 'other@sangroup.id', username: 'otherone', division: 'OPS' });
    const notif = await seedNotification(otherUser.id, false);

    const res = await request(app)
      .patch(`/api/notifications/${notif.id}/read`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/notifications/read-all ─────────────────────
describe('PATCH /api/notifications/read-all', () => {
  it('200 — semua notifikasi ditandai dibaca', async () => {
    await seedNotification(userId, false);
    await seedNotification(userId, false);
    await seedNotification(userId, false);

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    const unread = await testPrisma.notification.count({ where: { userId, isRead: false } });
    expect(unread).toBe(0);
  });

  it('200 — tidak error meskipun tidak ada unread', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
  });
});
