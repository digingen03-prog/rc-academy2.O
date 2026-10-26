-- CreateTable
CREATE TABLE "student_advances" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_advance_allocations" (
    "id" TEXT NOT NULL,
    "advanceId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(10,2) NOT NULL,
    "allocatedById" TEXT NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "student_advance_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_advances_receiptNumber_key" ON "student_advances"("receiptNumber");

-- CreateIndex
CREATE INDEX "student_advances_studentId_idx" ON "student_advances"("studentId");

-- CreateIndex
CREATE INDEX "student_advances_receiptNumber_idx" ON "student_advances"("receiptNumber");

-- CreateIndex
CREATE INDEX "student_advance_allocations_advanceId_idx" ON "student_advance_allocations"("advanceId");

-- CreateIndex
CREATE INDEX "student_advance_allocations_invoiceId_idx" ON "student_advance_allocations"("invoiceId");

-- AddForeignKey
ALTER TABLE "student_advances" ADD CONSTRAINT "student_advances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_advances" ADD CONSTRAINT "student_advances_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_advance_allocations" ADD CONSTRAINT "student_advance_allocations_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "student_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_advance_allocations" ADD CONSTRAINT "student_advance_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "fee_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_advance_allocations" ADD CONSTRAINT "student_advance_allocations_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
