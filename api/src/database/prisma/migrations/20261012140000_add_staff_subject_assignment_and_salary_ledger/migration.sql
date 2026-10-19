-- AlterTable staff_course_assignments
ALTER TABLE "staff_course_assignments" 
ADD COLUMN "subjectId" TEXT,
ADD COLUMN "staffSharePercentage" DECIMAL(5,2) NOT NULL DEFAULT 70.00,
ADD COLUMN "compensationRule" TEXT NOT NULL DEFAULT 'REVENUE_SHARE_70_30';

-- Drop old unique index
DROP INDEX IF EXISTS "staff_course_assignments_userId_classId_batchId_key";

-- Create new unique index on (userId, classId, subjectId, batchId)
CREATE UNIQUE INDEX "staff_course_assignments_userId_classId_subjectId_batchId_key" ON "staff_course_assignments"("userId", "classId", "subjectId", "batchId");

-- Index on subjectId
CREATE INDEX "staff_course_assignments_subjectId_idx" ON "staff_course_assignments"("subjectId");

-- Add ForeignKey to subjects
ALTER TABLE "staff_course_assignments" ADD CONSTRAINT "staff_course_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable fee_invoice_lines
ALTER TABLE "fee_invoice_lines"
ADD COLUMN "classId" TEXT,
ADD COLUMN "subjectId" TEXT;

-- Add ForeignKeys for fee_invoice_lines
ALTER TABLE "fee_invoice_lines" ADD CONSTRAINT "fee_invoice_lines_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fee_invoice_lines" ADD CONSTRAINT "fee_invoice_lines_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable staff_salary_payouts
CREATE TABLE "staff_salary_payouts" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10, 2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,

    CONSTRAINT "staff_salary_payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_salary_payouts_payoutNumber_key" ON "staff_salary_payouts"("payoutNumber");
CREATE INDEX "staff_salary_payouts_userId_idx" ON "staff_salary_payouts"("userId");
CREATE INDEX "staff_salary_payouts_status_idx" ON "staff_salary_payouts"("status");

-- CreateTable staff_salary_ledgers
CREATE TABLE "staff_salary_ledgers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT,
    "paymentId" TEXT NOT NULL,
    "paymentAllocationId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "collectedAmount" DECIMAL(10, 2) NOT NULL,
    "staffPoolRate" DECIMAL(5, 2) NOT NULL DEFAULT 70.00,
    "academyShareRate" DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    "academyShareAmount" DECIMAL(10, 2) NOT NULL,
    "staffPoolAmount" DECIMAL(10, 2) NOT NULL,
    "earnedAmount" DECIMAL(10, 2) NOT NULL,
    "ruleApplied" TEXT NOT NULL DEFAULT 'REVENUE_SHARE_70_30',
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "payoutId" TEXT,
    "payoutReference" TEXT,
    "payoutDate" TIMESTAMP(3),
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_salary_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_salary_ledgers_userId_idx" ON "staff_salary_ledgers"("userId");
CREATE INDEX "staff_salary_ledgers_assignmentId_idx" ON "staff_salary_ledgers"("assignmentId");
CREATE INDEX "staff_salary_ledgers_classId_idx" ON "staff_salary_ledgers"("classId");
CREATE INDEX "staff_salary_ledgers_subjectId_idx" ON "staff_salary_ledgers"("subjectId");
CREATE INDEX "staff_salary_ledgers_paymentId_idx" ON "staff_salary_ledgers"("paymentId");
CREATE INDEX "staff_salary_ledgers_status_idx" ON "staff_salary_ledgers"("status");

-- CreateTable academy_salary_configs
CREATE TABLE "academy_salary_configs" (
    "id" TEXT NOT NULL,
    "defaultStaffPoolRate" DECIMAL(5, 2) NOT NULL DEFAULT 70.00,
    "defaultAcademyShareRate" DECIMAL(5, 2) NOT NULL DEFAULT 30.00,
    "isApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_salary_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable payment_revenue_exceptions
CREATE TABLE "payment_revenue_exceptions" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "unallocatedAmount" DECIMAL(10, 2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolutionNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_revenue_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_revenue_exceptions_paymentId_idx" ON "payment_revenue_exceptions"("paymentId");
CREATE INDEX "payment_revenue_exceptions_status_idx" ON "payment_revenue_exceptions"("status");

-- ForeignKeys
ALTER TABLE "staff_salary_payouts" ADD CONSTRAINT "staff_salary_payouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_salary_payouts" ADD CONSTRAINT "staff_salary_payouts_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_salary_payouts" ADD CONSTRAINT "staff_salary_payouts_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "staff_course_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "staff_salary_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payment_revenue_exceptions" ADD CONSTRAINT "payment_revenue_exceptions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
