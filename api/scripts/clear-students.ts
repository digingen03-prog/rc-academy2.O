import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking student-related records in database...');

  const studentCount = await prisma.student.count();
  const enrollmentCount = await prisma.studentBatchEnrollment.count();
  const invoiceCount = await prisma.feeInvoice.count();
  const paymentCount = await prisma.payment.count();
  const attendanceRecordCount = await prisma.attendanceRecord.count();
  const guardianCount = await prisma.guardian.count();
  const studentGuardianCount = await prisma.studentGuardian.count();
  const attendanceCodeCount = await prisma.attendanceCode.count({
    where: { entityType: 'STUDENT' },
  });
  const submissionCount = await prisma.studentSubmission.count();
  const resultCount = await prisma.result.count();

  console.log(`Current Database Counts:
  - Students: ${studentCount}
  - Batch Enrollments: ${enrollmentCount}
  - Fee Invoices: ${invoiceCount}
  - Payments: ${paymentCount}
  - Attendance Records: ${attendanceRecordCount}
  - Student Guardians: ${studentGuardianCount}
  - Guardians: ${guardianCount}
  - Student Attendance Codes: ${attendanceCodeCount}
  - Exam Submissions: ${submissionCount}
  - Exam Results: ${resultCount}
  `);

  if (studentCount === 0) {
    console.log('✨ No students found in database. Nothing to delete.');
    return;
  }

  console.log('🗑️ Deleting all students and related records...');

  await prisma.$transaction(async (tx) => {
    // 1. Delete student exam results and submissions
    await tx.result.deleteMany({});
    await tx.teacherReview.deleteMany({});
    await tx.aIEvaluation.deleteMany({});
    await tx.studentSubmission.deleteMany({});

    // 2. Clear attendance corrections and records for students
    await tx.attendanceCorrection.deleteMany({});
    await tx.attendanceRecord.deleteMany({});

    // 3. Clear payments, payment allocations, payment revenue exceptions, salary ledgers linked to payments
    await tx.paymentRevenueException.deleteMany({});
    await tx.paymentAllocation.deleteMany({});
    await tx.staffSalaryLedger.deleteMany({
      where: { paymentId: { not: null } },
    });
    await tx.payment.deleteMany({});

    // 4. Clear fee invoice adjustments, lines, and fee invoices
    await tx.feeAdjustment.deleteMany({});
    await tx.feeInvoiceLine.deleteMany({});
    await tx.feeInvoice.deleteMany({});

    // 5. Clear batch enrollments
    await tx.studentBatchEnrollment.deleteMany({});

    // 6. Clear student attendance codes
    await tx.attendanceCode.deleteMany({
      where: { entityType: 'STUDENT' },
    });

    // 7. Clear student guardians and guardians
    await tx.studentGuardian.deleteMany({});
    await tx.guardian.deleteMany({});

    // 8. Delete all students
    const deleteResult = await tx.student.deleteMany({});
    console.log(`✅ Successfully deleted ${deleteResult.count} students!`);
  });

  const remainingStudents = await prisma.student.count();
  console.log(`🎉 Student database cleanup complete. Remaining students: ${remainingStudents}`);
}

main()
  .catch((e) => {
    console.error('❌ Error clearing student data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
