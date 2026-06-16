import { AudienceType, NotificationType, RecurrenceType } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError } from '@/middlewares/errorHandler.middleware';

const SA_SELECT = {
  id: true, title: true, content: true,
  audienceType: true, recurrence: true, dayOfWeek: true,
  sendHour: true, sendMinute: true, isActive: true, lastSentAt: true,
  createdAt: true, updatedAt: true,
  createdBy: { select: { id: true, fullName: true } },
  audiences: { select: { division: { select: { id: true, name: true, color: true } } } },
} as const;

export async function listScheduledAnnouncementsService() {
  return prisma.scheduledAnnouncement.findMany({
    select: SA_SELECT,
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createScheduledAnnouncementService(
  createdById: string,
  data: {
    title: string; content: string;
    audienceType?: AudienceType; divisionIds?: string[];
    recurrence: RecurrenceType; dayOfWeek?: number | null;
    sendHour: number; sendMinute?: number;
  },
) {
  if (data.recurrence === RecurrenceType.WEEKLY && (data.dayOfWeek == null || data.dayOfWeek < 0 || data.dayOfWeek > 6)) {
    throw new AppError('dayOfWeek (0-6) wajib diisi untuk recurrence WEEKLY', 400);
  }
  if (data.audienceType === AudienceType.CUSTOM && (!data.divisionIds || data.divisionIds.length === 0)) {
    throw new AppError('Pilih minimal satu divisi untuk audience CUSTOM', 400);
  }

  const audienceType = data.audienceType ?? AudienceType.ALL;

  // For DIVISION type: snapshot the creator's division now so audience stays stable
  // even if the creator changes divisions later.
  let audienceDivisionIds: string[] = [];
  if (audienceType === AudienceType.DIVISION) {
    const creator = await prisma.user.findUnique({ where: { id: createdById }, select: { divisionId: true } });
    if (creator?.divisionId) audienceDivisionIds = [creator.divisionId];
  } else if (audienceType === AudienceType.CUSTOM && data.divisionIds?.length) {
    audienceDivisionIds = data.divisionIds;
  }

  return prisma.scheduledAnnouncement.create({
    data: {
      title:        data.title,
      content:      data.content,
      audienceType,
      recurrence:   data.recurrence,
      dayOfWeek:    data.recurrence === RecurrenceType.WEEKLY ? (data.dayOfWeek ?? null) : null,
      sendHour:     data.sendHour,
      sendMinute:   data.sendMinute ?? 0,
      createdById,
      ...(audienceDivisionIds.length > 0 && {
        audiences: { create: audienceDivisionIds.map((divisionId) => ({ divisionId })) },
      }),
    },
    select: SA_SELECT,
  });
}

export async function updateScheduledAnnouncementService(
  id: string,
  data: {
    title?: string; content?: string;
    audienceType?: AudienceType; divisionIds?: string[];
    recurrence?: RecurrenceType; dayOfWeek?: number | null;
    sendHour?: number; sendMinute?: number; isActive?: boolean;
  },
) {
  const exists = await prisma.scheduledAnnouncement.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError('Pengumuman terjadwal tidak ditemukan', 404);

  const syncAudiences = data.audienceType !== undefined || data.divisionIds !== undefined;

  const updated = await prisma.scheduledAnnouncement.update({
    where: { id },
    data: {
      ...(data.title        !== undefined && { title: data.title }),
      ...(data.content      !== undefined && { content: data.content }),
      ...(data.audienceType !== undefined && { audienceType: data.audienceType }),
      ...(data.recurrence   !== undefined && { recurrence: data.recurrence }),
      ...(data.recurrence   !== undefined && { dayOfWeek: data.recurrence === RecurrenceType.WEEKLY ? (data.dayOfWeek ?? null) : null }),
      ...(data.dayOfWeek    !== undefined && data.recurrence === undefined && { dayOfWeek: data.dayOfWeek }),
      ...(data.sendHour     !== undefined && { sendHour: data.sendHour }),
      ...(data.sendMinute   !== undefined && { sendMinute: data.sendMinute }),
      ...(data.isActive     !== undefined && { isActive: data.isActive }),
      ...(syncAudiences && {
        audiences: {
          deleteMany: {},
          ...(data.audienceType === AudienceType.CUSTOM && data.divisionIds?.length && {
            create: data.divisionIds.map((divisionId) => ({ divisionId })),
          }),
        },
      }),
    },
    select: SA_SELECT,
  });

  return updated;
}

export async function deleteScheduledAnnouncementService(id: string) {
  const exists = await prisma.scheduledAnnouncement.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError('Pengumuman terjadwal tidak ditemukan', 404);
  await prisma.scheduledAnnouncement.delete({ where: { id } });
}

let _firingInProgress = false;

// Called by cron every minute
export async function fireScheduledAnnouncements() {
  if (_firingInProgress) return;
  _firingInProgress = true;
  try {
    return await _doFireScheduledAnnouncements();
  } finally {
    _firingInProgress = false;
  }
}

async function _doFireScheduledAnnouncements() {
  // Jakarta = UTC+7
  const now = new Date(Date.now() + 7 * 3_600_000);
  const currentHour    = now.getUTCHours();
  const currentMinute  = now.getUTCMinutes();
  const currentDay     = now.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  const todayJakarta   = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

  const candidates = await prisma.scheduledAnnouncement.findMany({
    where: {
      isActive:   true,
      sendHour:   currentHour,
      sendMinute: currentMinute,
    },
    select: SA_SELECT,
  });

  for (const sa of candidates) {
    // Skip if already sent today
    if (sa.lastSentAt) {
      const lastDate = new Date(sa.lastSentAt.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
      if (lastDate === todayJakarta) continue;
    }

    // Check recurrence matches today
    const matches =
      sa.recurrence === RecurrenceType.DAILY ||
      (sa.recurrence === RecurrenceType.WEEKDAYS && currentDay >= 1 && currentDay <= 5) ||
      (sa.recurrence === RecurrenceType.WEEKLY   && sa.dayOfWeek === currentDay);

    if (!matches) continue;

    // Resolve target user IDs
    let userIds: string[];
    if (sa.audienceType === AudienceType.ALL) {
      const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      userIds = users.map((u) => u.id);
    } else {
      // DIVISION and CUSTOM both use the stored audience divisions (snapshotted at create time)
      const divisionIds = sa.audiences.map((a) => a.division.id);
      const users = await prisma.user.findMany({
        where: { isActive: true, divisionId: { in: divisionIds } },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    if (userIds.length === 0) continue;

    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        type:    NotificationType.SYSTEM,
        title:   sa.title,
        message: sa.content,
        link:    '/notifications',
        userId,
        actorId: sa.createdBy.id,
      })),
      skipDuplicates: true,
    });

    await prisma.scheduledAnnouncement.update({
      where: { id: sa.id },
      data:  { lastSentAt: new Date() },
    });

    console.log(`[scheduler] Fired "${sa.title}" → ${userIds.length} users`);
  }
}
