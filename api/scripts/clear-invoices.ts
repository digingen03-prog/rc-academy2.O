import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking invoices in database...');

  const invoiceCount = await prisma.feeInvoice.count();
  const paymentCount = await prisma.payment.count();
  const allocationCount = await prisma.paymentAllocation.count();
  const adjustmentCount = await prisma.feeAdjustment.count();
  const invoiceLineCount = await prisma.feeInvoiceLine.count();

  console.log(`Current Database Counts:
  - Fee Invoices: ${invoiceCount}
  - Fee Invoice Lines: ${invoiceLineCount}
  - Fee Adjustments: ${adjustmentCount}
  - Payment Allocations: ${allocationCount}
  - Payments: ${paymentCount}
  `);

  if (invoiceCount === 0) {
    console.log('✨ No invoices found in database. Nothing to delete.');
    return;
  }

  console.log(`🗑️ Clearing all ${invoiceCount} fee invoices and related records...`);

  await prisma.$transaction(async (tx) => {
    // 1. Delete payment allocations for invoices
    const deletedAllocations = await tx.paymentAllocation.deleteMany({});
    console.log(`   - Deleted ${deletedAllocations.count} payment allocations.`);

    // 2. Delete fee adjustments
    const deletedAdjustments = await tx.feeAdjustment.deleteMany({});
    console.log(`   - Deleted ${deletedAdjustments.count} fee adjustments.`);

    // 3. Delete fee invoice lines
    const deletedLines = await tx.feeInvoiceLine.deleteMany({});
    console.log(`   - Deleted ${deletedLines.count} fee invoice lines.`);

    // 4. Delete fee invoices
    const deletedInvoices = await tx.feeInvoice.deleteMany({});
    console.log(`✅ Successfully deleted ${deletedInvoices.count} fee invoices!`);
  });

  const remainingInvoices = await prisma.feeInvoice.count();
  console.log(`🎉 Invoices cleanup complete. Remaining invoices: ${remainingInvoices}`);
}

main()
  .catch((e) => {
    console.error('❌ Error clearing invoices:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
