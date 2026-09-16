import cron from 'node-cron';
import { NotificationType } from '@prisma/client';
import { prisma } from '@/config/database';
import { getPermissionsForRole } from '@/services/permission.service';

const REMINDER_TYPE = 'LEASE_EXPIRY_6M';
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

// Same shape as notifyInventoryApprovers/sendHRISNotif elsewhere — every
// module that creates notifications writes its own small local wrapper
// rather than sharing one, since the recipient-selection logic differs.
async function getFinancialViewerIds(): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: { select: { id: true, level: true } } },
  });

  const roleCanView = new Map<string, boolean>();
  for (const u of candidates) {
    if (!roleCanView.has(u.role.id)) {
      const perms = await getPermissionsForRole(u.role.id, u.role.level);
      roleCanView.set(u.role.id, u.role.level <= 1 ? true : perms.tenant.viewFinancials);
    }
  }

  return candidates.filter((u) => roleCanView.get(u.role.id)).map((u) => u.id);
}

/**
 * Tenant Lease-Expiry Reminder
 * Runs daily at 01:00 UTC (08:00 WIB) — finds ACTIVE tenants whose lease ends
 * within the next 6 months and haven't been reminded yet (dedup via
 * TenantReminder{tenantId, type}), notifies Finance/Leasing/Legal-equivalent
 * roles, and logs the reminder so it never fires twice for the same tenant.
 */
export function registerTenantLeaseExpiryJob(): void {
  cron.schedule('0 1 * * *', async () => {
    console.log('[Scheduler] Running tenant lease-expiry job...');

    try {
      const cutoff = new Date(Date.now() + SIX_MONTHS_MS);

      const expiring = await prisma.tenant.findMany({
        where: {
          status: 'ACTIVE',
          leaseEnd: { not: null, lte: cutoff, gte: new Date() },
          reminders: { none: { type: REMINDER_TYPE } },
        },
        select: { id: true, name: true, unitNo: true, location: true, leaseEnd: true },
      });

      if (expiring.length === 0) {
        console.log('[Scheduler] Tenant lease-expiry: nothing due, skipping');
        return;
      }

      const recipientIds = await getFinancialViewerIds();

      for (const tenant of expiring) {
        await prisma.$transaction([
          prisma.tenantReminder.create({ data: { tenantId: tenant.id, type: REMINDER_TYPE } }),
          prisma.notification.createMany({
            data: recipientIds.map((userId) => ({
              userId,
              type: NotificationType.TENANT_LEASE_EXPIRING,
              title: `Sewa akan berakhir: ${tenant.name ?? tenant.unitNo}`,
              message: `Unit ${tenant.unitNo} (${tenant.location}) masa sewanya berakhir ${tenant.leaseEnd?.toISOString().slice(0, 10)}.`,
              link: `/tenants?tenantId=${tenant.id}`,
            })),
          }),
        ]);
      }

      console.log(`[Scheduler] Tenant lease-expiry done — reminded for ${expiring.length} tenant(s)`);
    } catch (err) {
      console.error('[Scheduler] Tenant lease-expiry job error:', err);
    }
  });

  console.log('[Scheduler] Tenant lease-expiry job registered (daily 01:00 UTC / 08:00 WIB)');
}
