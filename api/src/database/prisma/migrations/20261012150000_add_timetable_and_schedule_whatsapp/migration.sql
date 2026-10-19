-- CreateEnum
CREATE TYPE "ScheduleDayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ScheduleExceptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'SUBSTITUTED', 'RESCHEDULED', 'SPECIAL_CLASS');

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "batchId" TEXT,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" "ScheduleDayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "effectiveStartDate" TIMESTAMP(3),
    "effectiveEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_schedule_exceptions" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scheduleId" TEXT,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "batchId" TEXT,
    "staffId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "status" "ScheduleExceptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_schedule_configs" (
    "id" TEXT NOT NULL,
    "academyName" TEXT NOT NULL DEFAULT 'RC Academy',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "headerTemplate" TEXT DEFAULT '*{academy_name} – Tomorrow''s Class Schedule*
📅 {date}',
    "classItemTemplate" TEXT DEFAULT '🕘 {start_time} – {end_time}
📚 Class: {class_name}
📘 Subject: {subject_name}
👨‍🏫 Teacher: {teacher_name}
👥 Batch: {batch_name}
📍 Room: {room}',
    "footerTemplate" TEXT DEFAULT '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!',
    "groupByBatch" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_schedule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_schedules_classId_idx" ON "class_schedules"("classId");
CREATE INDEX "class_schedules_subjectId_idx" ON "class_schedules"("subjectId");
CREATE INDEX "class_schedules_staffId_idx" ON "class_schedules"("staffId");
CREATE INDEX "class_schedules_dayOfWeek_idx" ON "class_schedules"("dayOfWeek");

-- CreateIndex
CREATE INDEX "daily_schedule_exceptions_date_idx" ON "daily_schedule_exceptions"("date");
CREATE INDEX "daily_schedule_exceptions_scheduleId_idx" ON "daily_schedule_exceptions"("scheduleId");
CREATE INDEX "daily_schedule_exceptions_classId_idx" ON "daily_schedule_exceptions"("classId");
CREATE INDEX "daily_schedule_exceptions_staffId_idx" ON "daily_schedule_exceptions"("staffId");

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_schedule_exceptions" ADD CONSTRAINT "daily_schedule_exceptions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "class_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_schedule_exceptions" ADD CONSTRAINT "daily_schedule_exceptions_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_schedule_exceptions" ADD CONSTRAINT "daily_schedule_exceptions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_schedule_exceptions" ADD CONSTRAINT "daily_schedule_exceptions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_schedule_exceptions" ADD CONSTRAINT "daily_schedule_exceptions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
