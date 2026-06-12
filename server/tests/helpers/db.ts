import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Prisma client khusus test (pakai DATABASE_URL dari .env.test)
export const testPrisma = new PrismaClient();

/**
 * Hapus semua data test dalam urutan yang aman (respect FK constraints).
 * Dipanggil di beforeEach pada integration tests.
 */
export async function cleanDatabase() {
  await testPrisma.$transaction([
    testPrisma.notification.deleteMany(),
    testPrisma.auditLog.deleteMany(),
    testPrisma.bulletinReadStatus.deleteMany(),
    testPrisma.bulletinAttachment.deleteMany(),
    testPrisma.bulletinAudience.deleteMany(),
    testPrisma.bulletin.deleteMany(),
    testPrisma.taskAttachment.deleteMany(),
    testPrisma.taskComment.deleteMany(),
    testPrisma.taskLink.deleteMany(),
    testPrisma.task.deleteMany(),
    testPrisma.taskList.deleteMany(),
    testPrisma.stickyNote.deleteMany(),
    testPrisma.databaseLink.deleteMany(),
    testPrisma.databaseFolder.deleteMany(),
    testPrisma.refreshToken.deleteMany(),
    testPrisma.user.deleteMany(),
    // roles & divisions sengaja tidak dihapus — seeded oleh migration
  ]);
}

// Slug role → level (hierarki: 1=SuperAdmin … 6=Staff).
// Slug yang tidak dikenal dibuat on-the-fly; permission jatuh ke default per level.
const ROLE_LEVELS: Record<string, number> = {
  OWNER: 1, SUPER_ADMIN: 1, ADMIN: 2, HRD: 2, DIRECTOR: 3, MANAGER: 4, SUPERVISOR: 5, STAFF: 6,
};

async function ensureRole(slug: string) {
  const existing = await testPrisma.role.findUnique({ where: { slug } });
  if (existing) return existing;
  return testPrisma.role.create({
    data: { name: slug, slug, level: ROLE_LEVELS[slug] ?? 6, color: '#64748b' },
  });
}

async function ensureDivision(slug: string) {
  const existing = await testPrisma.division.findUnique({ where: { slug } });
  if (existing) return existing;
  return testPrisma.division.create({
    data: { name: slug, slug, color: '#64748b' },
  });
}

/** Buat user test dengan password sudah di-hash. role/division berupa slug. */
export async function createTestUser(overrides: Partial<{
  email: string;
  username: string;
  password: string;
  fullName: string;
  role: string;
  division: string;
  isActive: boolean;
}> = {}) {
  const plain = overrides.password ?? 'Password123';
  const role     = await ensureRole(overrides.role ?? 'STAFF');
  const division = await ensureDivision(overrides.division ?? 'GENERAL');
  return testPrisma.user.create({
    data: {
      email: overrides.email ?? 'test@sangroup.id',
      username: overrides.username ?? 'testuser',
      password: await bcrypt.hash(plain, 12),
      fullName: overrides.fullName ?? 'Test User',
      roleId: role.id,
      divisionId: division.id,
      isActive: overrides.isActive ?? true,
    },
    include: { role: true, division: true },
  });
}

export async function disconnectTestDb() {
  await testPrisma.$disconnect();
}
