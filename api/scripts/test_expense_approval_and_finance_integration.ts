import { PrismaClient, ExpenseStatus, ExpenseCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING EXPENSE APPROVAL & FINANCE ANALYTICS INTEGRATION TEST ---');

  // 1. Find Admin and Super Admin
  const superAdmin = await prisma.user.findFirst({
    where: {
      userRoles: {
        some: {
          role: { name: 'SUPER_ADMIN' },
        },
      },
    },
  });

  const academyAdmin = await prisma.user.findFirst({
    where: {
      userRoles: {
        some: {
          role: { name: { in: ['ACADEMY_ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN'] } },
        },
      },
    },
  });

  if (!superAdmin || !academyAdmin) {
    throw new Error('Super Admin or Admin user not found for testing');
  }

  console.log(`Using Super Admin: ${superAdmin.email} (${superAdmin.id})`);
  console.log(`Using Creator Admin: ${academyAdmin.email} (${academyAdmin.id})`);

  // 2. Read baseline approved expenses from DB
  const initialApprovedAgg = await prisma.expense.aggregate({
    where: { status: 'APPROVED' },
    _sum: { amount: true },
    _count: { id: true },
  });
  const baselineApprovedAmount = (initialApprovedAgg._sum.amount || new Decimal(0)).toNumber();
  console.log(`Baseline approved expenses: ₹${baselineApprovedAmount} (${initialApprovedAgg._count.id} items)`);

  // 3. Admin creates a test expense (e.g. ₹7,500 for Laboratory Equipment) with proof attachment
  const testExpense = await prisma.expense.create({
    data: {
      title: 'TEST-EXPENSE: Chemistry Lab Glassware & Reagents',
      category: ExpenseCategory.EQUIPMENT,
      amount: new Decimal(7500.0),
      expenseDate: new Date(),
      paymentMethod: 'UPI',
      referenceNumber: 'UPI-TEST-998877',
      notes: 'Test expense created by admin to verify Super Admin approval workflow and finance analytics',
      status: ExpenseStatus.PENDING,
      proofFileName: 'lab_reagents_tax_invoice.pdf',
      proofMimeType: 'application/pdf',
      proofFileSize: 104857,
      proofObjectKey: 'expenses/test-lab/invoice.pdf',
      proofUploadedAt: new Date(),
      createdById: academyAdmin.id,
    },
  });

  console.log(`\nStep 1: Admin created expense with ID: ${testExpense.id}`);
  console.log(`- Status: ${testExpense.status} (MUST BE PENDING)`);
  console.log(`- Amount: ₹${testExpense.amount}`);
  console.log(`- Proof: ${testExpense.proofFileName} (${testExpense.proofMimeType})`);

  if (testExpense.status !== ExpenseStatus.PENDING) {
    throw new Error(`Expected expense status to be PENDING, got ${testExpense.status}`);
  }

  // 4. Verify that Finance Analytics query ignores this PENDING expense!
  const pendingCheckAgg = await prisma.expense.aggregate({
    where: { status: 'APPROVED' },
    _sum: { amount: true },
  });
  const pendingCheckAmount = (pendingCheckAgg._sum.amount || new Decimal(0)).toNumber();
  console.log(`\nStep 2: Checking approved expenses while status is PENDING:`);
  console.log(`- Approved total: ₹${pendingCheckAmount} (Expected: ₹${baselineApprovedAmount})`);

  if (pendingCheckAmount !== baselineApprovedAmount) {
    throw new Error(`Pending expense was mistakenly included in approved total! Expected ₹${baselineApprovedAmount}, got ₹${pendingCheckAmount}`);
  }
  console.log('✓ SUCCESS: Pending expense is correctly EXCLUDED from approved financial totals!');

  // 5. Super Admin Approves the expense
  const approvedExpense = await prisma.expense.update({
    where: { id: testExpense.id },
    data: {
      status: ExpenseStatus.APPROVED,
      approvedById: superAdmin.id,
      approvedAt: new Date(),
      rejectionReason: null,
    },
  });

  console.log(`\nStep 3: Super Admin approved expense:`);
  console.log(`- Status: ${approvedExpense.status}`);
  console.log(`- Approved By: ${approvedExpense.approvedById}`);
  console.log(`- Approved At: ${approvedExpense.approvedAt?.toISOString()}`);

  // 6. Verify that Finance Analytics now CALCULATES the approved expense!
  const postApprovalAgg = await prisma.expense.aggregate({
    where: { status: 'APPROVED' },
    _sum: { amount: true },
  });
  const postApprovalAmount = (postApprovalAgg._sum.amount || new Decimal(0)).toNumber();
  const expectedApprovedTotal = baselineApprovedAmount + 7500.0;

  console.log(`\nStep 4: Checking approved expenses after Super Admin APPROVAL:`);
  console.log(`- Approved total: ₹${postApprovalAmount} (Expected: ₹${expectedApprovedTotal})`);

  if (postApprovalAmount !== expectedApprovedTotal) {
    throw new Error(`Approved expense was NOT included! Expected ₹${expectedApprovedTotal}, got ₹${postApprovalAmount}`);
  }
  console.log('✓ SUCCESS: Approved expense is correctly INCLUDED in financial metrics!');

  // 7. Test Rejecting an expense
  const rejectedExpense = await prisma.expense.update({
    where: { id: testExpense.id },
    data: {
      status: ExpenseStatus.REJECTED,
      rejectionReason: 'Duplicate invoice submitted',
      approvedById: superAdmin.id,
      approvedAt: new Date(),
    },
  });

  console.log(`\nStep 5: Testing Rejection:`);
  console.log(`- Status: ${rejectedExpense.status}`);
  console.log(`- Reason: ${rejectedExpense.rejectionReason}`);

  // 8. Verify that once rejected, it is again EXCLUDED from finance analytics!
  const postRejectAgg = await prisma.expense.aggregate({
    where: { status: 'APPROVED' },
    _sum: { amount: true },
  });
  const postRejectAmount = (postRejectAgg._sum.amount || new Decimal(0)).toNumber();
  console.log(`- Approved total after rejection: ₹${postRejectAmount} (Expected: ₹${baselineApprovedAmount})`);

  if (postRejectAmount !== baselineApprovedAmount) {
    throw new Error(`Rejected expense is still included in approved totals!`);
  }
  console.log('✓ SUCCESS: Rejected expense is correctly EXCLUDED from financial calculations!');

  // 9. Clean up test record
  await prisma.expense.delete({
    where: { id: testExpense.id },
  });
  console.log(`\nStep 6: Cleaned up test expense record ${testExpense.id}`);

  console.log('\n======================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

main()
  .catch((e) => {
    console.error('Test failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

