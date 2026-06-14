import request from 'supertest';
import app from '../helpers/app';
import { cleanDatabase, createTestUser, disconnectTestDb } from '../helpers/db';

let adminToken: string;
let staffToken: string;
let folderId: string;

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

  // Buat folder untuk semua test (hanya admin yang bisa manageFolder)
  const folderRes = await request(app)
    .post('/api/db-folders')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Folder' });
  folderId = folderRes.body.data.id;
});

afterAll(async () => {
  await disconnectTestDb();
});

const validLink = () => ({
  title: 'Google Drive',
  url:   'https://drive.google.com',
  folderId,
});

// ── POST /api/db-links ─────────────────────────────────────
describe('POST /api/db-links', () => {
  it('201 — admin bisa tambah link', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLink());

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Google Drive');
    expect(res.body.data.url).toBe('https://drive.google.com');
  });

  it('201 — link dengan deskripsi', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLink(), description: 'Cloud storage' });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('Cloud storage');
  });

  it('422 — URL tidak valid ditolak', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLink(), url: 'bukan-url' });

    expect(res.status).toBe(422);
  });

  it('422 — title kosong ditolak', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLink(), title: '' });

    expect(res.status).toBe(422);
  });

  it('401 — tanpa token', async () => {
    const res = await request(app).post('/api/db-links').send(validLink());
    expect(res.status).toBe(401);
  });

  it('404 — folderId tidak ada', async () => {
    const res = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLink(), folderId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });
});

// ── GET /api/db-folders/:id/links ─────────────────────────
describe('GET /api/db-folders/:id/links', () => {
  beforeEach(async () => {
    await request(app).post('/api/db-links').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLink(), title: 'Trello' });
    await request(app).post('/api/db-links').set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validLink(), title: 'HRIS' });
  });

  it('200 — semua user bisa lihat links dalam folder', async () => {
    const res = await request(app)
      .get(`/api/db-folders/${folderId}/links`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });


});

// ── PATCH /api/db-links/:id ────────────────────────────────
describe('PATCH /api/db-links/:id', () => {
  it('200 — pemilik bisa update link', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLink());
    const id = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Updated Title');
  });

  it('403 — staff lain tidak bisa update link orang', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLink());
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLink());
    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/db-links/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it('403 — staff lain tidak bisa hapus link orang', async () => {
    const createRes = await request(app)
      .post('/api/db-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validLink());
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
