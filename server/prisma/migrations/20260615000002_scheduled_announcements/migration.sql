-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY');

-- CreateTable
CREATE TABLE "scheduled_announcements" (
    "id"           TEXT        NOT NULL,
    "title"        TEXT        NOT NULL,
    "content"      TEXT        NOT NULL,
    "audienceType" "AudienceType" NOT NULL DEFAULT 'ALL',
    "recurrence"   "RecurrenceType" NOT NULL,
    "dayOfWeek"    INTEGER,
    "sendHour"     INTEGER     NOT NULL,
    "sendMinute"   INTEGER     NOT NULL DEFAULT 0,
    "isActive"     BOOLEAN     NOT NULL DEFAULT true,
    "lastSentAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "createdById"  TEXT        NOT NULL,

    CONSTRAINT "scheduled_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_announcement_audiences" (
    "id"                      TEXT NOT NULL,
    "scheduledAnnouncementId" TEXT NOT NULL,
    "divisionId"              TEXT NOT NULL,

    CONSTRAINT "scheduled_announcement_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_announcements_createdById_idx" ON "scheduled_announcements"("createdById");
CREATE INDEX "scheduled_announcements_isActive_idx" ON "scheduled_announcements"("isActive");
CREATE UNIQUE INDEX "scheduled_announcement_audiences_scheduledAnnouncementId_divisionId_key"
    ON "scheduled_announcement_audiences"("scheduledAnnouncementId", "divisionId");
CREATE INDEX "scheduled_announcement_audiences_scheduledAnnouncementId_idx" ON "scheduled_announcement_audiences"("scheduledAnnouncementId");
CREATE INDEX "scheduled_announcement_audiences_divisionId_idx" ON "scheduled_announcement_audiences"("divisionId");

-- AddForeignKey
ALTER TABLE "scheduled_announcements" ADD CONSTRAINT "scheduled_announcements_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_announcement_audiences" ADD CONSTRAINT "scheduled_announcement_audiences_scheduledAnnouncementId_fkey"
    FOREIGN KEY ("scheduledAnnouncementId") REFERENCES "scheduled_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_announcement_audiences" ADD CONSTRAINT "scheduled_announcement_audiences_divisionId_fkey"
    FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
