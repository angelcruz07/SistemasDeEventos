-- CreateTable
CREATE TABLE "DoorAccess" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoorAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoorAccess_eventId_key" ON "DoorAccess"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "DoorAccess_keyHash_key" ON "DoorAccess"("keyHash");

-- AddForeignKey
ALTER TABLE "DoorAccess" ADD CONSTRAINT "DoorAccess_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

