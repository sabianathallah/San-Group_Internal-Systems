import cron from 'node-cron';
import { fireScheduledAnnouncements } from '@/services/scheduled-announcement.service';

export function startScheduler() {
  // Run every minute — fire any scheduled announcements due right now
  cron.schedule('* * * * *', async () => {
    try {
      await fireScheduledAnnouncements();
    } catch (err) {
      console.error('[scheduler] Error firing announcements:', err);
    }
  });

  console.log('⏰ Scheduler started');
}
