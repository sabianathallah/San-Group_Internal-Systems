import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, disconnectTestDb } from '../helpers/db';

let userToken: string;
let otherToken: string;

async function loginAs(identifier: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier, password: 'Password123' });
  return res.body.data.accessToken as string;
}

beforeEach(async () => {
  await cleanDatabase();
  await createTestUser({ email: 'user@sangroup.id', username: 'noteuser', role: 'STAFF', division: 'OPS' });
  userToken = await loginAs('user@sangroup.id');
  await createTestUser({ email: 'other@sangroup.id', username: 'otheruser', role: 'STAFF', division: 'OPS' });
  otherToken = await loginAs('other@sangroup.id');
});

afterAll(async () => {
  await disconnectTestDb();
});

// ── POST /api/notes ────────────────────────────────────────
describe('POST /api/notes', () => {
  it('201 — buat note dasar', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Isi catatan pertama' });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Isi catatan pertama');
    expect(res.body.data.color).toBe('yellow');
    expect(res.body.data.isPinned).toBe(false);
  });

  it('201 — buat note dengan semua field', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Judul note', content: 'Konten', color: 'blue', isPinned: true });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Judul note');
    expect(res.body.data.color).toBe('blue');
    expect(res.body.data.isPinned).toBe(true);
  });

  it('422 — content kosong ditolak', async () => {
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: '' });

    expect(res.status).toBe(422);
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).post('/api/notes').send({ content: 'X' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/notes ─────────────────────────────────────────
describe('GET /api/notes', () => {
  beforeEach(async () => {
    await request(app).post('/api/notes').set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Note A', color: 'yellow' });
    await request(app).post('/api/notes').set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Note B', color: 'blue', isPinned: true });
    await request(app).post('/api/notes').set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Note orang lain' });
  });

  it('200 — user hanya lihat note sendiri', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('200 — pinned note muncul di atas', async () => {
    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].isPinned).toBe(true);
  });

  it('200 — filter by color', async () => {
    const res = await request(app)
      .get('/api/notes?color=blue')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].color).toBe('blue');
  });

  it('200 — search by content', async () => {
    const res = await request(app)
      .get('/api/notes?search=Note A')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ── PATCH /api/notes/:id ───────────────────────────────────
describe('PATCH /api/notes/:id', () => {
  it('200 — update konten dan warna', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Lama' });
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/notes/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Baru', color: 'green' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Baru');
    expect(res.body.data.color).toBe('green');
  });

  it('200 — pin/unpin note', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Pin me' });
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/notes/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ isPinned: true });

    expect(res.status).toBe(200);
    expect(res.body.data.isPinned).toBe(true);
  });

  it('404 — update note orang lain ditolak', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Punya orang' });
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/notes/${id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Coba ubah' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/notes/:id ──────────────────────────────────
describe('DELETE /api/notes/:id', () => {
  it('200 — pemilik bisa hapus note', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Hapus' });
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/notes/${id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
  });

  it('404 — hapus note orang lain ditolak', async () => {
    const createRes = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Punya orang' });
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/notes/${id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
  });
});
