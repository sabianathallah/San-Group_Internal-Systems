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

const VALID_LINK = {
  title: 'Google Drive',
  url: 'https://drive.google.com',
  category: 'Storage',
  division: 'OPS',
};

// ── POST /api/db-links ─────────────────────────────────────
describe('POST /api/db-links', () => {
  it('201 — staff bisa tambah link', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(VALID_LINK);

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Google Drive');
    expect(res.body.data.url).toBe('https://drive.google.com');
    expect(res.body.data.division).toBe('OPS');
  });

  it('201 — link dengan deskripsi dan icon', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_LINK, description: 'Cloud storage', icon: 'folder' });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('Cloud storage');
    expect(res.body.data.icon).toBe('folder');
  });

  it('422 — URL tidak valid ditolak', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...VALID_LINK, url: 'bukan-url' });

    expect(res.status).toBe(422);
  });

  it('422 — title kosong ditolak', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...VALID_LINK, title: '' });

    expect(res.status).toBe(422);
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).post('/api/db-links').send(VALID_LINK);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/db-links ──────────────────────────────────────
describe('GET /api/db-links', () => {
  beforeEach(async () => {
    await request(app).post('/api/db-links').set('Authorization', `Bearer ${staffToken}`)
      .send({ ...VALID_LINK, title: 'Trello', division: 'OPS', category: 'Project' });
    await request(app).post('/api/db-links').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_LINK, title: 'HRIS', division: 'HRD', category: 'HR Tools' });
  });

  it('200 — semua user bisa lihat semua link', async () => {
    const res = await request(app)
      .get('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('200 — filter by division', async () => {
    const res = await request(app)
      .get('/api/db-links?division=HRD')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].division).toBe('HRD');
  });

  it('200 — search by title', async () => {
    const res = await request(app)
      .get('/api/db-links?search=HRIS')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ── PATCH /api/db-links/:id ────────────────────────────────
describe('PATCH /api/db-links/:id', () => {
  it('200 — pemilik bisa update link', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(VALID_LINK);
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('200 — admin bisa update link orang lain', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(VALID_LINK);
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Admin Update' });

    expect(res.status).toBe(200);
  });

  it('403 — staff lain tidak bisa update link orang', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_LINK);
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ title: 'Coba ubah' });

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/db-links/:id ───────────────────────────────
describe('DELETE /api/db-links/:id', () => {
  it('200 — pemilik bisa hapus link', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(VALID_LINK);
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
  });

  it('403 — staff lain tidak bisa hapus link orang', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_LINK);
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(403);
  });

  it('404 — hapus link tidak ada', async () => {
    const res = await request(app)
      .delete('/api/db-links/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
