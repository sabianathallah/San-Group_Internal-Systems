-- CreateEnum
CREATE TYPE "MeetingRoomBookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "building" TEXT,
    "floor" TEXT,
    "capacity" INTEGER,
    "facilities" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_room_bookings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "attendees" TEXT[],
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "MeetingRoomBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roomId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,

    CONSTRAINT "meeting_room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_room_bookings_roomId_idx" ON "meeting_room_bookings"("roomId");

-- CreateIndex
CREATE INDEX "meeting_room_bookings_bookedById_idx" ON "meeting_room_bookings"("bookedById");

-- CreateIndex
CREATE INDEX "meeting_room_bookings_startTime_idx" ON "meeting_room_bookings"("startTime");

-- CreateIndex
CREATE INDEX "meeting_room_bookings_status_idx" ON "meeting_room_bookings"("status");

-- AddForeignKey
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_room_bookings" ADD CONSTRAINT "meeting_room_bookings_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
