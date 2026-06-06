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

import { registerDueDateJob } from './due-date.job';

export function startScheduler(): void {
  registerDueDateJob();
}
