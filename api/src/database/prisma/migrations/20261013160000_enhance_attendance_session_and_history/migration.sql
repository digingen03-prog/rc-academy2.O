-- AlterTable attendance_sessions: Add classId, subjectId, classScheduleId, startTime, endTime
ALTER TABLE "attendance_sessions" 
  ADD COLUMN IF NOT EXISTS "classId" TEXT,
  ADD COLUMN IF NOT EXISTS "subjectId" TEXT,
  ADD COLUMN IF NOT EXISTS "classScheduleId" TEXT,
  ADD COLUMN IF NOT EXISTS "startTime" TEXT,
  ADD COLUMN IF NOT EXISTS "endTime" TEXT;

-- Drop legacy unique constraint if exists to support multiple daily schedules per batch
ALTER TABLE "attendance_sessions" DROP CONSTRAINT IF EXISTS "attendance_sessions_batchId_date_sessionType_key";

-- Add foreign keys
ALTER TABLE "attendance_sessions" 
  DROP CONSTRAINT IF EXISTS "attendance_sessions_classId_fkey",
  ADD CONSTRAINT "attendance_sessions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions" 
  DROP CONSTRAINT IF EXISTS "attendance_sessions_subjectId_fkey",
  ADD CONSTRAINT "attendance_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_sessions" 
  DROP CONSTRAINT IF EXISTS "attendance_sessions_classScheduleId_fkey",
  ADD CONSTRAINT "attendance_sessions_classScheduleId_fkey" FOREIGN KEY ("classScheduleId") REFERENCES "class_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create partial unique index on (classScheduleId, date) for scheduled classes
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_classScheduleId_date_key" 
  ON "attendance_sessions"("classScheduleId", "date") 
  WHERE "classScheduleId" IS NOT NULL;

-- Create partial unique index for legacy non-scheduled sessions
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_legacy_batch_date_type_key" 
  ON "attendance_sessions"("batchId", "date", "sessionType") 
  WHERE "classScheduleId" IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS "attendance_sessions_classScheduleId_idx" ON "attendance_sessions"("classScheduleId");
CREATE INDEX IF NOT EXISTS "attendance_sessions_classId_idx" ON "attendance_sessions"("classId");
CREATE INDEX IF NOT EXISTS "attendance_sessions_subjectId_idx" ON "attendance_sessions"("subjectId");
CREATE INDEX IF NOT EXISTS "attendance_sessions_date_idx" ON "attendance_sessions"("date");
CREATE INDEX IF NOT EXISTS "attendance_sessions_batchId_idx" ON "attendance_sessions"("batchId");
