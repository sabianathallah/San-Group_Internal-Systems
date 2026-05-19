/**
 * Scheduler — Cron jobs dan background tasks.
 *
 * Cara menambah job baru:
 * 1. Buat file baru di folder ini, contoh: reminder.job.ts
 * 2. Export fungsi yang menerima cron schedule dan logic-nya
 * 3. Register job tersebut di fungsi startScheduler() di bawah
 *
 * Library yang direkomendasikan: node-cron (npm install node-cron)
 * Contoh: cron.schedule('0 8 * * *', () => { ... }) — setiap hari jam 08:00
 */

export function startScheduler(): void {
  // Job-job akan diregister di sini seiring fitur berkembang
  // Contoh job yang akan datang:
  // - Reminder deadline task harian
  // - Arsip bulletin yang sudah lewat tanggal
  // - Cleanup notifikasi lama
}
