-- CreateEnum
CREATE TYPE "InvigilatorAssignmentStatus" AS ENUM ('NOT_ASSIGNED', 'ASSIGNED', 'ACKNOWLEDGEMENT_PENDING', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "WhatsAppShareStatus" AS ENUM ('DRAFT', 'READY_TO_SHARE', 'OPENED_FOR_SHARING', 'CONFIRMED_SHARED', 'CANCELLED');

-- AlterTable
ALTER TABLE "examinations" ADD COLUMN "startTime" TEXT,
ADD COLUMN "endTime" TEXT,
ADD COLUMN "venue" TEXT,
ADD COLUMN "invigilatorInstructions" TEXT,
ADD COLUMN "invigilatorId" TEXT,
ADD COLUMN "invigilatorStatus" "InvigilatorAssignmentStatus" NOT NULL DEFAULT 'NOT_ASSIGNED',
ADD COLUMN "invigilatorNotes" TEXT,
ADD COLUMN "invigilatorAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "announcementStatus" "WhatsAppShareStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "announcementSharedAt" TIMESTAMP(3),
ADD COLUMN "announcementSharedById" TEXT,
ADD COLUMN "announcementMessageSnapshot" TEXT,
ADD COLUMN "announcementNotes" TEXT;

-- CreateIndex
CREATE INDEX "examinations_date_idx" ON "examinations"("date");

-- CreateIndex
CREATE INDEX "examinations_invigilatorId_idx" ON "examinations"("invigilatorId");

-- CreateIndex
CREATE INDEX "examinations_announcementStatus_idx" ON "examinations"("announcementStatus");

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_announcementSharedById_fkey" FOREIGN KEY ("announcementSharedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
