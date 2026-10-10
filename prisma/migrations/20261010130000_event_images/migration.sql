-- CreateTable
CREATE TABLE "EventImage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventImage_eventId_position_idx" ON "EventImage"("eventId", "position");

-- AddForeignKey
ALTER TABLE "EventImage" ADD CONSTRAINT "EventImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing cover images become position 0 (must run BEFORE the column is dropped).
-- gen_random_uuid() is built in since PostgreSQL 13.
INSERT INTO "EventImage" ("id", "eventId", "url", "position", "createdAt")
SELECT gen_random_uuid()::text, "id", "imageUrl", 0, NOW()
FROM "Event"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> '';

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "imageUrl";
