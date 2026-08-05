-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('marketplace', 'owner');

-- AlterTable Booking: walk-in / owner bookings + Google sync id
ALTER TABLE "Booking" ALTER COLUMN "consumerId" DROP NOT NULL;

ALTER TABLE "Booking" ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'marketplace';
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestEmail" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "googleEventId" TEXT;

UPDATE "Booking"
SET "source" = 'marketplace'
WHERE "consumerId" IS NOT NULL;

-- Google Calendar OAuth connection per business
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "connectedEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarConnection_businessId_key" ON "GoogleCalendarConnection"("businessId");

ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
