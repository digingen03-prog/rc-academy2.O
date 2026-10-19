-- CreateEnum
CREATE TYPE "CompensationModel" AS ENUM ('FIXED_SALARY', 'REVENUE_SHARING');
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'BI_WEEKLY', 'WEEKLY');
CREATE TYPE "StaffCategory" AS ENUM ('GENERAL', 'FACULTY');

-- AlterTable "users"
ALTER TABLE "users" ADD COLUMN "staffCategory" "StaffCategory" DEFAULT 'FACULTY';
ALTER TABLE "users" ADD COLUMN "compensationModel" "CompensationModel" NOT NULL DEFAULT 'REVENUE_SHARING';
ALTER TABLE "users" ADD COLUMN "fixedSalaryAmount" DECIMAL(10,2);
ALTER TABLE "users" ADD COLUMN "payFrequency" "PayFrequency" DEFAULT 'MONTHLY';
ALTER TABLE "users" ADD COLUMN "compensationEffectiveDate" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable "staff_salary_ledgers"
ALTER TABLE "staff_salary_ledgers" ADD COLUMN "compensationModel" "CompensationModel" NOT NULL DEFAULT 'REVENUE_SHARING';
ALTER TABLE "staff_salary_ledgers" ADD COLUMN "payPeriod" TEXT;
ALTER TABLE "staff_salary_ledgers" ADD COLUMN "notes" TEXT;
ALTER TABLE "staff_salary_ledgers" ALTER COLUMN "classId" DROP NOT NULL;
ALTER TABLE "staff_salary_ledgers" ALTER COLUMN "paymentId" DROP NOT NULL;
ALTER TABLE "staff_salary_ledgers" ALTER COLUMN "receiptNumber" DROP NOT NULL;
ALTER TABLE "staff_salary_ledgers" ALTER COLUMN "collectedAmount" SET DEFAULT 0;
ALTER TABLE "staff_salary_ledgers" ALTER COLUMN "academyShareAmount" SET DEFAULT 0;
ALTER TABLE "staff_salary_ledgers" ALTER COLUMN "staffPoolAmount" SET DEFAULT 0;

-- DropForeignKey / AddForeignKey on staff_salary_ledgers with ON DELETE SET NULL
ALTER TABLE "staff_salary_ledgers" DROP CONSTRAINT IF EXISTS "staff_salary_ledgers_classId_fkey";
ALTER TABLE "staff_salary_ledgers" DROP CONSTRAINT IF EXISTS "staff_salary_ledgers_paymentId_fkey";
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_salary_ledgers" ADD CONSTRAINT "staff_salary_ledgers_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "staff_salary_ledgers_compensationModel_idx" ON "staff_salary_ledgers"("compensationModel");
CREATE INDEX "staff_salary_ledgers_payPeriod_idx" ON "staff_salary_ledgers"("payPeriod");

-- AlterTable "academy_salary_configs"
ALTER TABLE "academy_salary_configs" ADD COLUMN "fixedSalaryAutoAccrue" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "academy_salary_configs" ADD COLUMN "payDayOfMonth" INTEGER NOT NULL DEFAULT 1;
