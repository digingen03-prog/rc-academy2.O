-- AlterTable
ALTER TABLE "students" ADD COLUMN "dateOfJoining" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN "academicBoard" TEXT;
ALTER TABLE "students" ADD COLUMN "referralSource" TEXT;
ALTER TABLE "students" ADD COLUMN "alternativePhone" TEXT;

-- CreateIndex
CREATE INDEX "students_dateOfJoining_idx" ON "students"("dateOfJoining");
CREATE INDEX "students_academicBoard_idx" ON "students"("academicBoard");
