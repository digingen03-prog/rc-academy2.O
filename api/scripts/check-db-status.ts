import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  console.log('=== USERS IN DB ===');
  users.forEach((u) => {
    const roles = u.userRoles.map((r) => r.role.name).join(', ');
    console.log(`- [${u.id}] ${u.email} (${u.firstName} ${u.lastName}) | Roles: [${roles}] | Status: ${u.status}`);
  });

  const counts: Record<string, number> = {
    users: await prisma.user.count(),
    students: await prisma.student.count(),
    guardians: await prisma.guardian.count(),
    batchEnrollments: await prisma.studentBatchEnrollment.count(),
    feeInvoices: await prisma.feeInvoice.count(),
    feeInvoiceLines: await prisma.feeInvoiceLine.count(),
    payments: await prisma.payment.count(),
    paymentAllocations: await prisma.paymentAllocation.count(),
    staffSalaryLedgers: await prisma.staffSalaryLedger.count(),
    staffSalaryPayouts: await prisma.staffSalaryPayout.count(),
    staffCourseAssignments: await prisma.staffCourseAssignment.count(),
    attendanceSessions: await prisma.attendanceSession.count(),
    attendanceRecords: await prisma.attendanceRecord.count(),
    attendanceCodes: await prisma.attendanceCode.count(),
    classes: await prisma.class.count(),
    batches: await prisma.batch.count(),
    subjects: await prisma.subject.count(),
    courseFeeConfigs: await prisma.courseFeeConfig.count(),
    academicYears: await prisma.academicYear.count(),
    exams: await prisma.examination.count(),
    evaluations: await prisma.aIEvaluation.count(),
    results: await prisma.result.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  console.log('\n=== RECORD COUNTS ===');
  console.table(counts);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
