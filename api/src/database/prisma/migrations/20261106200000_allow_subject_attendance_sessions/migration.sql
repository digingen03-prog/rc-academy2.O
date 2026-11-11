-- Drop legacy non-scheduled index that blocked distinct subject attendance per batch/date
DROP INDEX IF EXISTS "attendance_sessions_legacy_batch_date_type_key";

-- Create unique index on batchId, date, sessionType, and subjectId for non-scheduled sessions
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_batch_date_subject_type_key"
  ON "attendance_sessions"("batchId", "date", "sessionType", COALESCE("subjectId", ''))
  WHERE "classScheduleId" IS NULL;

