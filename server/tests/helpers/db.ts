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
    testPrisma.bulletinReadStatus.deleteMany(),
    testPrisma.bulletinAttachment.deleteMany(),
    testPrisma.bulletin.deleteMany(),
    testPrisma.taskAttachment.deleteMany(),
    testPrisma.task.deleteMany(),
    testPrisma.taskList.deleteMany(),
    testPrisma.stickyNote.deleteMany(),
    testPrisma.databaseLink.deleteMany(),
    testPrisma.refreshToken.deleteMany(),
    testPrisma.user.deleteMany(),
  ]);
}

/** Buat user test dengan password sudah di-hash */
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
  return testPrisma.user.create({
    data: {
      email: overrides.email ?? 'test@sangroup.id',
      username: overrides.username ?? 'testuser',
      password: await bcrypt.hash(plain, 12),
      fullName: overrides.fullName ?? 'Test User',
      role: (overrides.role as never) ?? 'STAFF',
      division: (overrides.division as never) ?? 'OPS',
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function disconnectTestDb() {
  await testPrisma.$disconnect();
}
