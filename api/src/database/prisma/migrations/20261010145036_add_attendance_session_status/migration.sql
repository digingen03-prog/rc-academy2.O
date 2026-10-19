-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'OPEN';
