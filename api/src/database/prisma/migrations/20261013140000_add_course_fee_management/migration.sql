-- CreateEnum
CREATE TYPE "FeeAdjustmentType" AS ENUM ('DISCOUNT', 'SCHOLARSHIP', 'CREDIT_ADJUSTMENT', 'WAIVER', 'CORRECTION');

-- AlterTable
ALTER TABLE "fee_invoices" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "billingPeriod" TEXT,
ADD COLUMN     "classId" TEXT,
ADD COLUMN     "configurationSnapshot" JSONB,
ADD COLUMN     "courseFeeConfigId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "enrollmentId" TEXT,
ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "student_batch_enrollments" ADD COLUMN     "subjectId" TEXT;

-- CreateTable
CREATE TABLE "course_fee_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "batchId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "billingPeriod" TEXT NOT NULL DEFAULT 'ANNUAL',
    "installmentCount" INTEGER NOT NULL DEFAULT 1,
    "installmentsSchedule" JSONB,
    "allowedDiscounts" JSONB,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_adjustments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "FeeAdjustmentType" NOT NULL DEFAULT 'DISCOUNT',
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_fee_configs_academicYearId_idx" ON "course_fee_configs"("academicYearId");

-- CreateIndex
CREATE INDEX "course_fee_configs_classId_idx" ON "course_fee_configs"("classId");

-- CreateIndex
CREATE INDEX "course_fee_configs_subjectId_idx" ON "course_fee_configs"("subjectId");

-- CreateIndex
CREATE INDEX "course_fee_configs_batchId_idx" ON "course_fee_configs"("batchId");

-- CreateIndex
CREATE INDEX "course_fee_configs_isActive_idx" ON "course_fee_configs"("isActive");

-- CreateIndex
CREATE INDEX "fee_adjustments_invoiceId_idx" ON "fee_adjustments"("invoiceId");

-- CreateIndex
CREATE INDEX "fee_invoice_lines_classId_idx" ON "fee_invoice_lines"("classId");

-- CreateIndex
CREATE INDEX "fee_invoice_lines_subjectId_idx" ON "fee_invoice_lines"("subjectId");

-- CreateIndex
CREATE INDEX "fee_invoices_enrollmentId_idx" ON "fee_invoices"("enrollmentId");

-- CreateIndex
CREATE INDEX "fee_invoices_classId_idx" ON "fee_invoices"("classId");

-- CreateIndex
CREATE INDEX "fee_invoices_subjectId_idx" ON "fee_invoices"("subjectId");

-- CreateIndex
CREATE INDEX "fee_invoices_batchId_idx" ON "fee_invoices"("batchId");

-- CreateIndex
CREATE INDEX "fee_invoices_courseFeeConfigId_idx" ON "fee_invoices"("courseFeeConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_idempotencyKey_idx" ON "payments"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "student_batch_enrollments" ADD CONSTRAINT "student_batch_enrollments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_fee_configs" ADD CONSTRAINT "course_fee_configs_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_fee_configs" ADD CONSTRAINT "course_fee_configs_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_fee_configs" ADD CONSTRAINT "course_fee_configs_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_fee_configs" ADD CONSTRAINT "course_fee_configs_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_adjustments" ADD CONSTRAINT "fee_adjustments_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "student_batch_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_courseFeeConfigId_fkey" FOREIGN KEY ("courseFeeConfigId") REFERENCES "course_fee_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
