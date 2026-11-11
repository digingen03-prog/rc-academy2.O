import { PrismaClient, UserRoleType, PaymentMethod, FeeAdjustmentType, InvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FeesService } from './src/modules/fees/fees.service';
import { SalaryService } from './src/modules/salary/salary.service';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const salaryService = new SalaryService(prisma as any);
const feesService = new FeesService(prisma as any, salaryService);

async function runCourseFeeTests() {
  console.log('================================================================');
  console.log('TESTING COURSE-BASED FEE MANAGEMENT & MULTI-COURSE BILLING');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup Test Environment: Academic Year, Classes, Batches, Staff
    // -------------------------------------------------------------
    console.log('1. Setting up academic foundations...');

    const timestamp = Date.now();
    const acadYear = await prisma.academicYear.upsert({
      where: { name: `2026-2027-FEE-TEST-${timestamp}` },
      update: {},
      create: {
        name: `2026-2027-FEE-TEST-${timestamp}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-04-30'),
        isCurrent: true,
      },
    });

    const admin = await prisma.user.findFirst();
    const adminId = admin?.id || 'admin-uuid';

    // Course 1: 12th Physics
    const coursePhysics = await prisma.class.create({
      data: {
        name: `12th Physics - ${timestamp}`,
        code: `PHY12-${timestamp}`,
        academicYearId: acadYear.id,
      },
    });

    const batchPhysics = await prisma.batch.create({
      data: {
        name: 'Physics Batch Alpha',
        code: `PHY-B1-${timestamp}`,
        classId: coursePhysics.id,
      },
    });

    // Course 2: 12th Maths
    const courseMaths = await prisma.class.create({
      data: {
        name: `12th Mathematics - ${timestamp}`,
        code: `MTH12-${timestamp}`,
        academicYearId: acadYear.id,
      },
    });

    const batchMaths = await prisma.batch.create({
      data: {
        name: 'Maths Batch Omega',
        code: `MTH-B1-${timestamp}`,
        classId: courseMaths.id,
      },
    });

    // Faculty 1 for Physics (70% share)
    const pwHash = await bcrypt.hash('Teacher@123', 10);
    const facultyPhysics = await prisma.user.create({
      data: {
        email: `faculty.physics.${timestamp}@rca.test`,
        passwordHash: pwHash,
        firstName: 'Prof. Vikram',
        lastName: 'Sarabhai',
      },
    });

    await prisma.staffCourseAssignment.create({
      data: {
        userId: facultyPhysics.id,
        classId: coursePhysics.id,
        batchId: batchPhysics.id,
        staffSharePercentage: new Decimal(70.0),
        isActive: true,
      },
    });

    // Faculty 2 for Maths (70% share)
    const facultyMaths = await prisma.user.create({
      data: {
        email: `faculty.maths.${timestamp}@rca.test`,
        passwordHash: pwHash,
        firstName: 'Dr. Srinivasa',
        lastName: 'Ramanujan',
      },
    });

    await prisma.staffCourseAssignment.create({
      data: {
        userId: facultyMaths.id,
        classId: courseMaths.id,
        batchId: batchMaths.id,
        staffSharePercentage: new Decimal(70.0),
        isActive: true,
      },
    });

    console.log('   Academic foundations ready.\n');

    // -------------------------------------------------------------
    // Test 1: Configure Fees for Courses
    // -------------------------------------------------------------
    console.log('2. Configuring Course Fees...');

    const configPhysics = await feesService.createCourseFeeConfig(
      {
        name: '12th Physics Annual Comprehensive Tuition',
        academicYearId: acadYear.id,
        classId: coursePhysics.id,
        batchId: batchPhysics.id,
        amount: 40000,
        billingPeriod: 'ANNUAL',
        installmentCount: 2,
        installmentsSchedule: [
          { installmentNumber: 1, percentage: 50, dueDaysOffset: 0 },
          { installmentNumber: 2, percentage: 50, dueDaysOffset: 60 },
        ],
      },
      adminId,
    );

    assert(
      configPhysics && Number(configPhysics.amount) === 40000,
      'Course Fee Configuration 1 (12th Physics: Rs. 40,000) created successfully',
    );

    const configMaths = await feesService.createCourseFeeConfig(
      {
        name: '12th Maths Annual Advanced Track',
        academicYearId: acadYear.id,
        classId: courseMaths.id,
        batchId: batchMaths.id,
        amount: 35000,
        billingPeriod: 'ANNUAL',
        installmentCount: 1,
      },
      adminId,
    );

    assert(
      configMaths && Number(configMaths.amount) === 35000,
      'Course Fee Configuration 2 (12th Maths: Rs. 35,000) created successfully',
    );

    // -------------------------------------------------------------
    // Test 2: Multi-Course Student Enrollment & Separate Fee Invoices
    // -------------------------------------------------------------
    console.log('\n3. Enrolling Student in Multiple Courses...');

    const student = await prisma.student.create({
      data: {
        studentCode: `RCA-TST-${timestamp.toString().slice(-5)}`,
        admissionNumber: `ADM-TST-${timestamp.toString().slice(-5)}`,
        firstName: 'Aditya',
        lastName: 'Verma',
        dob: new Date('2008-05-20'),
        gender: 'MALE',
        email: `aditya.${timestamp}@example.com`,
      },
    });

    // Enrollment 1: Physics
    const enrollmentPhysics = await prisma.studentBatchEnrollment.create({
      data: {
        studentId: student.id,
        batchId: batchPhysics.id,
        isActive: true,
      },
    });

    // Enrollment 2: Maths
    const enrollmentMaths = await prisma.studentBatchEnrollment.create({
      data: {
        studentId: student.id,
        batchId: batchMaths.id,
        isActive: true,
      },
    });

    // Generate separate course fee obligations for each enrollment
    const invPhysics = await feesService.createCourseInvoiceForEnrollment(
      enrollmentPhysics.id,
      'ANNUAL',
      adminId,
    );

    const invMaths = await feesService.createCourseInvoiceForEnrollment(
      enrollmentMaths.id,
      'ANNUAL',
      adminId,
    );

    assert(
      invPhysics !== null && invMaths !== null && invPhysics.id !== invMaths.id,
      'Two separately identifiable course fee records created for the multi-course student',
    );

    assert(
      Number(invPhysics?.totalAmount) === 40000 && Number(invPhysics?.balanceAmount) === 40000,
      '12th Physics invoice has correct total (Rs. 40,000) and balance (Rs. 40,000)',
    );

    assert(
      Number(invMaths?.totalAmount) === 35000 && Number(invMaths?.balanceAmount) === 35000,
      '12th Maths invoice has correct total (Rs. 35,000) and balance (Rs. 35,000)',
    );

    // -------------------------------------------------------------
    // Test 3: Consolidated Student Fee Account
    // -------------------------------------------------------------
    console.log('\n4. Verifying Consolidated Student Fee Account...');

    let studentAccount = await feesService.getStudentFeeAccount(student.id);

    assert(
      studentAccount.enrolledCourses.length === 2,
      'Student account lists 2 active enrolled courses',
    );

    assert(
      studentAccount.consolidatedAccount.consolidatedTotalBilled === 75000,
      `Consolidated Total Billed is Rs. 75,000 (Actual: ${studentAccount.consolidatedAccount.consolidatedTotalBilled})`,
    );

    assert(
      studentAccount.consolidatedAccount.consolidatedBalance === 75000,
      `Consolidated Outstanding Balance is Rs. 75,000 (Actual: ${studentAccount.consolidatedAccount.consolidatedBalance})`,
    );

    assert(
      studentAccount.consolidatedAccount.overallStatus === 'UNPAID',
      'Initial consolidated status is UNPAID',
    );

    // -------------------------------------------------------------
    // Test 4: Duplicate Billing Prevention
    // -------------------------------------------------------------
    console.log('\n5. Testing Duplicate Billing Prevention...');

    let duplicateCaught = false;
    try {
      await feesService.createCourseInvoice({
        studentId: student.id,
        enrollmentId: enrollmentPhysics.id,
        billingPeriod: 'ANNUAL',
        totalAmount: 40000,
        dueDate: '2026-12-31',
        description: 'Duplicate attempt',
      });
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        duplicateCaught = true;
      }
    }

    assert(duplicateCaught, 'Duplicate invoice attempt for same enrollment & period correctly rejected');

    // -------------------------------------------------------------
    // Test 5: Partial Payment on Single Course
    // -------------------------------------------------------------
    console.log('\n6. Testing Partial Payment on Single Course...');

    const singlePayResult = await feesService.recordPayment(
      {
        studentId: student.id,
        invoiceId: invPhysics!.id,
        amount: 15000,
        paymentMethod: PaymentMethod.UPI,
        reference: 'UPI-TXN-SINGLE-001',
      },
      adminId,
    );

    assert(
      singlePayResult && singlePayResult.receiptNumber.startsWith('REC-'),
      'Single course partial payment (Rs. 15,000) recorded with official receipt',
    );

    const updatedInvPhysics = await feesService.getInvoiceById(invPhysics!.id);
    const updatedInvMaths = await feesService.getInvoiceById(invMaths!.id);

    assert(
      Number(updatedInvPhysics.paidAmount) === 15000 &&
        Number(updatedInvPhysics.balanceAmount) === 25000 &&
        updatedInvPhysics.status === 'PARTIAL',
      'Physics invoice updated to paid: Rs. 15,000, balance: Rs. 25,000, status: PARTIAL',
    );

    assert(
      Number(updatedInvMaths.paidAmount) === 0 && Number(updatedInvMaths.balanceAmount) === 35000,
      'Maths invoice was completely untouched (Rs. 35,000 balance maintained)',
    );

    // Check faculty earnings for single payment
    const facultyPhysicsLedger = await prisma.staffSalaryLedger.findFirst({
      where: {
        paymentId: singlePayResult.payment.id,
        userId: facultyPhysics.id,
      },
    });

    assert(
      facultyPhysicsLedger !== null &&
        Number(facultyPhysicsLedger.staffPoolAmount) === 10500 && // 70% of 15,000
        Number(facultyPhysicsLedger.academyShareAmount) === 4500, // 30% of 15,000
      'Faculty revenue share accurately calculated: 70% (Rs. 10,500) staff pool, 30% (Rs. 4,500) academy share',
    );

    // -------------------------------------------------------------
    // Test 6: Multi-Course Payment with Explicit Allocations
    // -------------------------------------------------------------
    console.log('\n7. Testing Multi-Course Payment with Explicit Allocations...');

    // First test invalid allocation sum
    let allocationSumMismatchCaught = false;
    try {
      await feesService.recordPayment(
        {
          studentId: student.id,
          amount: 30000,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          allocations: [
            { invoiceId: invPhysics!.id, amount: 10000 },
            { invoiceId: invMaths!.id, amount: 15000 }, // sum 25,000 != 30,000
          ],
        },
        adminId,
      );
    } catch (err: any) {
      if (err.message.includes('must exactly equal')) {
        allocationSumMismatchCaught = true;
      }
    }

    assert(
      allocationSumMismatchCaught,
      'Mismatched allocation sum rejection verified (sum != total payment amount)',
    );

    // Now execute correct multi-course payment: Rs. 30,000 (Rs. 10,000 to Physics, Rs. 20,000 to Maths)
    const multiPayResult = await feesService.recordPayment(
      {
        studentId: student.id,
        amount: 30000,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        reference: 'NEFT-MULTI-SPLIT-9901',
        allocations: [
          { invoiceId: invPhysics!.id, amount: 10000 },
          { invoiceId: invMaths!.id, amount: 20000 },
        ],
      },
      adminId,
    );

    assert(
      multiPayResult && multiPayResult.receiptNumber.startsWith('REC-'),
      'Multi-course payment of Rs. 30,000 split across both courses successfully recorded',
    );

    const postMultiPhysics = await feesService.getInvoiceById(invPhysics!.id);
    const postMultiMaths = await feesService.getInvoiceById(invMaths!.id);

    assert(
      Number(postMultiPhysics.paidAmount) === 25000 && Number(postMultiPhysics.balanceAmount) === 15000,
      'Physics invoice updated to paid: Rs. 25,000, balance: Rs. 15,000',
    );

    assert(
      Number(postMultiMaths.paidAmount) === 20000 && Number(postMultiMaths.balanceAmount) === 15000,
      'Maths invoice updated to paid: Rs. 20,000, balance: Rs. 15,000',
    );

    // Verify independent faculty revenue attribution for each allocation
    const ledgersMulti = await prisma.staffSalaryLedger.findMany({
      where: { paymentId: multiPayResult.payment.id },
    });

    const physicsLedgerEntry = ledgersMulti.find((l) => l.userId === facultyPhysics.id);
    const mathsLedgerEntry = ledgersMulti.find((l) => l.userId === facultyMaths.id);

    assert(
      physicsLedgerEntry !== undefined &&
        Number(physicsLedgerEntry.staffPoolAmount) === 7000 && // 70% of 10,000
        Number(physicsLedgerEntry.academyShareAmount) === 3000,
      'Physics faculty received exactly 70% of allocated Rs. 10,000 (Rs. 7,000)',
    );

    assert(
      mathsLedgerEntry !== undefined &&
        Number(mathsLedgerEntry.staffPoolAmount) === 14000 && // 70% of 20,000
        Number(mathsLedgerEntry.academyShareAmount) === 6000,
      'Maths faculty received exactly 70% of allocated Rs. 20,000 (Rs. 14,000)',
    );

    // Check consolidated student account now
    studentAccount = await feesService.getStudentFeeAccount(student.id);

    assert(
      studentAccount.consolidatedAccount.consolidatedPaid === 45000 &&
        studentAccount.consolidatedAccount.consolidatedBalance === 30000 &&
        studentAccount.consolidatedAccount.overallStatus === 'PARTIAL',
      'Consolidated student account reflects accurate combined paid: Rs. 45,000 and balance: Rs. 30,000',
    );

    // -------------------------------------------------------------
    // Test 7: Authorized Fee Adjustment (Discount/Scholarship)
    // -------------------------------------------------------------
    console.log('\n8. Testing Authorized Fee Adjustment Workflow...');

    const adjustmentResult = await feesService.applyFeeAdjustment(
      {
        invoiceId: invPhysics!.id,
        type: FeeAdjustmentType.SCHOLARSHIP,
        amount: 5000,
        reason: 'Merit-based science olympiad scholarship waiver',
      },
      adminId,
    );

    assert(
      adjustmentResult && Number(adjustmentResult.adjustment.amount) === 5000,
      'Scholarship adjustment of Rs. 5,000 recorded',
    );

    const postAdjPhysics = await feesService.getInvoiceById(invPhysics!.id);

    assert(
      Number(postAdjPhysics.discountAmount) === 5000 &&
        Number(postAdjPhysics.balanceAmount) === 10000 &&
        Number(postAdjPhysics.totalAmount) === 35000,
      'Physics invoice balance reduced from Rs. 15,000 to Rs. 10,000 with discount recorded',
    );

    // -------------------------------------------------------------
    // Test 8: Fee Config Changes Never Mutate Historical Invoices
    // -------------------------------------------------------------
    console.log('\n9. Testing Historical Record Preservation on Config Price Change...');

    await feesService.updateCourseFeeConfig(configPhysics.id, {
      amount: 55000, // Price increased for future enrollments
    });

    const historicalInvoiceCheck = await feesService.getInvoiceById(invPhysics!.id);

    assert(
      Number(historicalInvoiceCheck.totalAmount) === 35000 &&
        Number(historicalInvoiceCheck.balanceAmount) === 10000,
      'Future course fee price change to Rs. 55,000 did NOT overwrite student historical obligation (Rs. 35,000 preserved)',
    );

    // -------------------------------------------------------------
    // Test 9: Idempotency & Duplicate Payment Retry Protection
    // -------------------------------------------------------------
    console.log('\n10. Testing Payment Idempotency & Repeat Processing...');

    const idempKey = `IDEMP-TEST-${timestamp}`;

    const idempPay1 = await feesService.recordPayment(
      {
        studentId: student.id,
        invoiceId: invMaths!.id,
        amount: 5000,
        paymentMethod: PaymentMethod.CASH,
        idempotencyKey: idempKey,
      },
      adminId,
    );

    const idempPay2 = await feesService.recordPayment(
      {
        studentId: student.id,
        invoiceId: invMaths!.id,
        amount: 5000,
        paymentMethod: PaymentMethod.CASH,
        idempotencyKey: idempKey, // Same key repeated!
      },
      adminId,
    );

    assert(
      idempPay1.payment.id === idempPay2.payment.id && (idempPay2 as any).isDuplicateRetry === true,
      'Duplicate payment retry with same idempotency key safely returned original record without double charge',
    );

    // -------------------------------------------------------------
    // Test 10: Payment Reversal & Ledger Rollback
    // -------------------------------------------------------------
    console.log('\n11. Testing Payment Reversal & Balance Restoration...');

    const balanceBeforeRev = Number((await feesService.getInvoiceById(invMaths!.id)).balanceAmount);

    const reversalResult = await feesService.reversePayment(
      idempPay1.payment.id,
      { reason: 'Cash entry posted by mistake' },
      adminId,
    );

    assert(
      reversalResult && reversalResult.payment.status === 'REVERSED',
      'Payment successfully reversed',
    );

    const balanceAfterRev = Number((await feesService.getInvoiceById(invMaths!.id)).balanceAmount);

    assert(
      balanceAfterRev === balanceBeforeRev + 5000,
      `Invoice balance properly restored upon reversal (+Rs. 5,000): ${balanceBeforeRev} -> ${balanceAfterRev}`,
    );

    // -------------------------------------------------------------
    // Test 11: Real Finance Dashboard Aggregations
    // -------------------------------------------------------------
    console.log('\n12. Testing Finance Dashboard Aggregates...');

    const dashboardSummary = await feesService.getFinanceDashboardSummary();

    assert(
      dashboardSummary.kpis.totalInvoiced > 0 &&
        dashboardSummary.kpis.totalCollected > 0 &&
        dashboardSummary.courseBreakdown.length >= 2,
      'Finance dashboard aggregates real DB data with comprehensive course-wise collections breakdown',
    );

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Unhandled test exception:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCourseFeeTests();
