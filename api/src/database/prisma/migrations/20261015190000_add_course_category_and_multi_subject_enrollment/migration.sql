-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM ('ACADEMIC', 'SKILL');

-- AlterTable
ALTER TABLE "classes" ADD COLUMN "category" "CourseCategory" NOT NULL DEFAULT 'ACADEMIC';

-- CreateIndex
CREATE INDEX "classes_category_idx" ON "classes"("category");

-- DropIndex
DROP INDEX IF EXISTS "student_batch_enrollments_studentId_batchId_key";

-- CreateIndex
CREATE UNIQUE INDEX "student_batch_enrollments_studentId_batchId_subjectId_key" ON "student_batch_enrollments"("studentId", "batchId", "subjectId");

-- CreateIndex
CREATE INDEX "student_batch_enrollments_studentId_idx" ON "student_batch_enrollments"("studentId");

-- CreateIndex
CREATE INDEX "student_batch_enrollments_batchId_idx" ON "student_batch_enrollments"("batchId");

-- CreateIndex
CREATE INDEX "student_batch_enrollments_subjectId_idx" ON "student_batch_enrollments"("subjectId");

-- CreateIndex
CREATE INDEX "student_batch_enrollments_isActive_idx" ON "student_batch_enrollments"("isActive");
