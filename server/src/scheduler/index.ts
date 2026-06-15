/**
 * Scheduler — Cron jobs dan background tasks.
 *
 * Cara menambah job baru:
 * 1. Buat file baru di folder ini, contoh: reminder.job.ts
 * 2. Export fungsi registerXxxJob() dari file tersebut
 * 3. Panggil fungsi tersebut di dalam startScheduler() di bawah
 *
 * Library: node-cron
 */

import cron from 'node-cron';
import { registerDueDateJob } from './due-date.job';
import { fireScheduledAnnouncements } from '@/services/scheduled-announcement.service';

export function startScheduler(): void {
  registerDueDateJob();

  // Fire scheduled announcements every minute
  cron.schedule('* * * * *', async () => {
    try {
      await fireScheduledAnnouncements();
    } catch (err) {
      console.error('[scheduler] Error firing announcements:', err);
    }
  });

  console.log('⏰ Scheduler started');
}
