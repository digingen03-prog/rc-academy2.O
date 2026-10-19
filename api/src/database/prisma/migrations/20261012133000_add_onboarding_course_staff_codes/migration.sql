-- AlterTable
ALTER TABLE "batches" ADD COLUMN "code" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "classes" ADD COLUMN "description" TEXT,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "students" ADD COLUMN "attendanceCode" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "attendanceCode" TEXT,
ADD COLUMN "designation" TEXT,
ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "attendance_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "studentId" TEXT,
    "userId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_course_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "batchId" TEXT,
    "role" TEXT DEFAULT 'TEACHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_course_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_attendance_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_codes_code_key" ON "attendance_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_codes_studentId_key" ON "attendance_codes"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_codes_userId_key" ON "attendance_codes"("userId");

-- CreateIndex
CREATE INDEX "attendance_codes_code_idx" ON "attendance_codes"("code");

-- CreateIndex
CREATE INDEX "staff_course_assignments_userId_idx" ON "staff_course_assignments"("userId");

-- CreateIndex
CREATE INDEX "staff_course_assignments_classId_idx" ON "staff_course_assignments"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_course_assignments_userId_classId_batchId_key" ON "staff_course_assignments"("userId", "classId", "batchId");

-- CreateIndex
CREATE INDEX "staff_attendance_records_userId_idx" ON "staff_attendance_records"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_attendance_records_userId_date_key" ON "staff_attendance_records"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "students_attendanceCode_key" ON "students"("attendanceCode");

-- CreateIndex
CREATE INDEX "students_attendanceCode_idx" ON "students"("attendanceCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_attendanceCode_key" ON "users"("attendanceCode");

-- AddForeignKey
ALTER TABLE "attendance_codes" ADD CONSTRAINT "attendance_codes_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_codes" ADD CONSTRAINT "attendance_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_course_assignments" ADD CONSTRAINT "staff_course_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_course_assignments" ADD CONSTRAINT "staff_course_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_course_assignments" ADD CONSTRAINT "staff_course_assignments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_attendance_records" ADD CONSTRAINT "staff_attendance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
