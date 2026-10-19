-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIEvalStatus" ADD VALUE 'APPROVED';
ALTER TYPE "AIEvalStatus" ADD VALUE 'MODIFIED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubmissionStatus" ADD VALUE 'APPROVED';
ALTER TYPE "SubmissionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "ai_evaluations" ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "extractedAnswer" TEXT,
ADD COLUMN     "isOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxMarks" DECIMAL(4,2),
ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "reviewedMarks" DECIMAL(4,2),
ADD COLUMN     "teacherNotes" TEXT;

-- AlterTable
ALTER TABLE "student_submissions" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedMarks" DECIMAL(5,2),
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSizeBytes" INTEGER,
ADD COLUMN     "ocrText" TEXT,
ADD COLUMN     "pageCount" INTEGER DEFAULT 1,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "uploadedById" TEXT;

-- AddForeignKey
ALTER TABLE "ai_evaluations" ADD CONSTRAINT "ai_evaluations_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
