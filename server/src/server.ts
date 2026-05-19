import 'dotenv/config';
import app from './app';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { startScheduler } from '@/scheduler';

async function main() {
  // Verify DB connection on startup
  try {
    await prisma.$connect();
    console.log('✅ Database terhubung');
  } catch (err) {
    console.error('❌ Gagal terhubung ke database:', err);
    process.exit(1);
  }

  startScheduler();

  const server = app.listen(env.PORT, () => {
    console.log('');
    console.log('🚀 SAN Group Internal System — Server');
    console.log(`   URL     : http://localhost:${env.PORT}`);
    console.log(`   ENV     : ${env.NODE_ENV}`);
    console.log(`   Health  : http://localhost:${env.PORT}/api/health`);
    console.log('');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Database disconnected. Goodbye.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
