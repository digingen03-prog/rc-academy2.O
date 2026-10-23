-- AlterTable: Add S3 Payment Proof Document Metadata to payments
-- All new columns are strictly nullable to guarantee 100% backward compatibility
-- with all existing payment history and active financial calculations.

ALTER TABLE "payments" ADD COLUMN "proofObjectKey" TEXT;
ALTER TABLE "payments" ADD COLUMN "proofFileName" TEXT;
ALTER TABLE "payments" ADD COLUMN "proofFileSize" INTEGER;
ALTER TABLE "payments" ADD COLUMN "proofMimeType" TEXT;
ALTER TABLE "payments" ADD COLUMN "proofUploadedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "payments_proofObjectKey_idx" ON "payments"("proofObjectKey");
