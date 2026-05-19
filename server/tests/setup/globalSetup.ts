import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';

export default async function globalSetup() {
  // Load .env.test sebelum apapun berjalan
  dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

  const dbUrl = process.env.DATABASE_URL!;
  const dbName = dbUrl.split('/').pop()!;

  console.log(`\n🔧 [Test Setup] Menyiapkan test database: ${dbName}`);

  try {
    // Buat test database jika belum ada (ignore error jika sudah ada)
    const baseUrl = dbUrl.substring(0, dbUrl.lastIndexOf('/'));
    execSync(`psql "${baseUrl}/postgres" -c "CREATE DATABASE ${dbName};" 2>/dev/null || true`, {
      stdio: 'pipe',
    });
  } catch {
    // Database mungkin sudah ada, lanjut
  }

  // Jalankan migrations ke test DB
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'pipe',
    cwd: path.resolve(__dirname, '../..'),
  });

  console.log('✅ [Test Setup] Test database siap\n');
}
