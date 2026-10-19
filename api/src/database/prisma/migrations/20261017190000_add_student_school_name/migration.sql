-- AlterTable
ALTER TABLE "students" ADD COLUMN "schoolName" TEXT;

-- CreateIndex
CREATE INDEX "students_schoolName_idx" ON "students"("schoolName");
