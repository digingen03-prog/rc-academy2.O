-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('UNIT_TEST', 'WEEKLY_TEST', 'MONTHLY_TEST', 'MODEL_EXAM', 'FINAL_EXAM');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ExamAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXEMPT');

-- AlterTable
ALTER TABLE "examination_questions" ADD COLUMN     "sectionInstructions" TEXT,
ADD COLUMN     "sectionName" TEXT;

-- AlterTable
ALTER TABLE "examinations" ADD COLUMN     "academicYearId" TEXT,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "examType" "ExamType" NOT NULL DEFAULT 'UNIT_TEST',
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paperVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "passMarks" DECIMAL(5,2) NOT NULL DEFAULT 35.00;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "sourceReference" TEXT,
ADD COLUMN     "status" "QuestionStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "results" ADD COLUMN     "attendanceStatus" "ExamAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctedById" TEXT,
ADD COLUMN     "correctedMarks" DECIMAL(5,2),
ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "isPassed" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "examinations" ADD CONSTRAINT "examinations_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
