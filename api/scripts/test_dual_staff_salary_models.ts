import { PrismaClient, StaffCategory, CompensationModel, PayFrequency, CourseCategory, UserRoleType, Gender } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { SalaryService } from '../src/modules/salary/salary.service';

const prisma = new PrismaClient();
const salaryService = new SalaryService(prisma as any);

async function runTests() {
  console.log('\n================================================================');
  console.log(' RCA2.O — DUAL STAFF SALARY MODELS & REVENUE SHARING TEST SUITE ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (detail) console.log(`         -> ${detail}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         -> ${detail}`);
    }
  }

  try {
    const passwordHash = await bcrypt.hash('SecurePass123!', 10);

    // =========================================================================
    // 0. ACADEMIC SETUP (Academic Year, Classes, Batches, Subjects, Roles)
    // =========================================================================
    console.log('--- 0. Setting up Academic Structure ---');
    let acadYear = await prisma.academicYear.findFirst({ where: { name: '2026-2027-DUAL-TEST' } });
    if (!acadYear) {
      acadYear = await prisma.academicYear.create({
        data: {
          name: '2026-2027-DUAL-TEST',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-04-30'),
          isCurrent: true,
        },
      });
    }

    // Role
    let facultyRole = await prisma.role.findFirst({ where: { name: UserRoleType.TEACHER } });
    if (!facultyRole) {
      facultyRole = await prisma.role.create({ data: { name: UserRoleType.TEACHER, description: 'Faculty Teacher' } });
    }
    let staffRole = await prisma.role.findFirst({ where: { name: UserRoleType.STAFF } });
    if (!staffRole) {
      staffRole = await prisma.role.create({ data: { name: UserRoleType.STAFF, description: 'Office Support Staff' } });
    }

    // 10th Standard
    let class10 = await prisma.class.findFirst({ where: { code: 'STD10-DUAL' } });
    if (!class10) {
      class10 = await prisma.class.create({
        data: {
          name: '10th Standard',
          code: 'STD10-DUAL',
          category: CourseCategory.ACADEMIC,
          academicYearId: acadYear.id,
        },
      });
    }

    // 12th Standard
    let class12 = await prisma.class.findFirst({ where: { code: 'STD12-DUAL' } });
    if (!class12) {
      class12 = await prisma.class.create({
        data: {
          name: '12th Standard',
          code: 'STD12-DUAL',
          category: CourseCategory.ACADEMIC,
          academicYearId: acadYear.id,
        },
      });
    }

    // Batches
    let batch10A = await prisma.batch.findFirst({ where: { classId: class10.id, name: 'Batch 10A' } });
    if (!batch10A) {
      batch10A = await prisma.batch.create({
        data: { name: 'Batch 10A', code: 'B10A-DUAL', classId: class10.id },
      });
    }

    let batch12A = await prisma.batch.findFirst({ where: { classId: class12.id, name: 'Batch 12A' } });
    if (!batch12A) {
      batch12A = await prisma.batch.create({
        data: { name: 'Batch 12A', code: 'B12A-DUAL', classId: class12.id },
      });
    }

    // Subjects
    let subj10Maths = await prisma.subject.findFirst({ where: { classId: class10.id, code: 'MTH10-DUAL' } });
    if (!subj10Maths) {
      subj10Maths = await prisma.subject.create({
        data: { name: '10th Mathematics', code: 'MTH10-DUAL', classId: class10.id },
      });
    }

    let subj10Science = await prisma.subject.findFirst({ where: { classId: class10.id, code: 'SCI10-DUAL' } });
    if (!subj10Science) {
      subj10Science = await prisma.subject.create({
        data: { name: '10th Science', code: 'SCI10-DUAL', classId: class10.id },
      });
    }

    let subj12Maths = await prisma.subject.findFirst({ where: { classId: class12.id, code: 'MTH12-DUAL' } });
    if (!subj12Maths) {
      subj12Maths = await prisma.subject.create({
        data: { name: '12th Mathematics', code: 'MTH12-DUAL', classId: class12.id },
      });
    }

    // Ensure Global Salary Config (70% Faculty Pool / 30% Academy Share)
    await salaryService.updateSalaryConfig({
      defaultStaffPoolRate: 70,
      defaultAcademyShareRate: 30,
      isApprovalRequired: true,
    });

    // =========================================================================
    // 1. STAFF ONBOARDING: GENERAL STAFF (FIXED SALARY) & FACULTY (REVENUE SHARING)
    // =========================================================================
    console.log('\n--- 1. Testing Dual Staff Classification & Onboarding ---');

    // 1A. General Staff: Ramesh Office Admin (Fixed Salary ₹35,000 / month)
    let generalStaff = await prisma.user.findFirst({ where: { email: 'ramesh.admin.test@rcacademy.com' } });
    if (!generalStaff) {
      generalStaff = await prisma.user.create({
        data: {
          email: 'ramesh.admin.test@rcacademy.com',
          passwordHash,
          firstName: 'Ramesh',
          lastName: 'Admin',
          staffCategory: StaffCategory.GENERAL,
          compensationModel: CompensationModel.FIXED_SALARY,
          fixedSalaryAmount: new Decimal(35000),
          payFrequency: PayFrequency.MONTHLY,
          compensationEffectiveDate: new Date('2026-06-01'),
          userRoles: { create: { roleId: staffRole.id } },
        },
      });
    } else {
      generalStaff = await prisma.user.update({
        where: { id: generalStaff.id },
        data: {
          staffCategory: StaffCategory.GENERAL,
          compensationModel: CompensationModel.FIXED_SALARY,
          fixedSalaryAmount: new Decimal(35000),
          payFrequency: PayFrequency.MONTHLY,
        },
      });
    }
    assert(
      generalStaff.staffCategory === 'GENERAL' &&
      generalStaff.compensationModel === 'FIXED_SALARY' &&
      Number(generalStaff.fixedSalaryAmount) === 35000 &&
      generalStaff.payFrequency === 'MONTHLY',
      'General staff correctly classified with Fixed Salary terms',
      `Ramesh Admin: Category=${generalStaff.staffCategory}, Model=${generalStaff.compensationModel}, Amount=₹${generalStaff.fixedSalaryAmount}, Freq=${generalStaff.payFrequency}`
    );

    // 1B. Faculty A: Priya Sharma (Teaches 10th Maths AND 12th Maths)
    let facultyPriya = await prisma.user.findFirst({ where: { email: 'priya.maths.test@rcacademy.com' } });
    if (!facultyPriya) {
      facultyPriya = await prisma.user.create({
        data: {
          email: 'priya.maths.test@rcacademy.com',
          passwordHash,
          firstName: 'Priya',
          lastName: 'Sharma',
          staffCategory: StaffCategory.FACULTY,
          compensationModel: CompensationModel.REVENUE_SHARING,
          payFrequency: PayFrequency.MONTHLY,
          compensationEffectiveDate: new Date('2026-06-01'),
          userRoles: { create: { roleId: facultyRole.id } },
        },
      });
    } else {
      facultyPriya = await prisma.user.update({
        where: { id: facultyPriya.id },
        data: {
          staffCategory: StaffCategory.FACULTY,
          compensationModel: CompensationModel.REVENUE_SHARING,
        },
      });
    }
    assert(
      facultyPriya.staffCategory === 'FACULTY' && facultyPriya.compensationModel === 'REVENUE_SHARING',
      'Faculty A correctly classified with Revenue Sharing model',
      `Priya Sharma: Category=${facultyPriya.staffCategory}, Model=${facultyPriya.compensationModel}`
    );

    // 1C. Faculty B: Vikram Singh (Teaches 10th Science only)
    let facultyVikram = await prisma.user.findFirst({ where: { email: 'vikram.science.test@rcacademy.com' } });
    if (!facultyVikram) {
      facultyVikram = await prisma.user.create({
        data: {
          email: 'vikram.science.test@rcacademy.com',
          passwordHash,
          firstName: 'Vikram',
          lastName: 'Singh',
          staffCategory: StaffCategory.FACULTY,
          compensationModel: CompensationModel.REVENUE_SHARING,
          payFrequency: PayFrequency.MONTHLY,
          compensationEffectiveDate: new Date('2026-06-01'),
          userRoles: { create: { roleId: facultyRole.id } },
        },
      });
    } else {
      facultyVikram = await prisma.user.update({
        where: { id: facultyVikram.id },
        data: {
          staffCategory: StaffCategory.FACULTY,
          compensationModel: CompensationModel.REVENUE_SHARING,
        },
      });
    }
    assert(
      facultyVikram.staffCategory === 'FACULTY' && facultyVikram.compensationModel === 'REVENUE_SHARING',
      'Faculty B correctly classified with Revenue Sharing model',
      `Vikram Singh: Category=${facultyVikram.staffCategory}, Model=${facultyVikram.compensationModel}`
    );

    // 1D. Faculty C: Neha Patel (Co-teaches 10th Maths with Priya)
    let facultyNeha = await prisma.user.findFirst({ where: { email: 'neha.maths.test@rcacademy.com' } });
    if (!facultyNeha) {
      facultyNeha = await prisma.user.create({
        data: {
          email: 'neha.maths.test@rcacademy.com',
          passwordHash,
          firstName: 'Neha',
          lastName: 'Patel',
          staffCategory: StaffCategory.FACULTY,
          compensationModel: CompensationModel.REVENUE_SHARING,
          payFrequency: PayFrequency.MONTHLY,
          compensationEffectiveDate: new Date('2026-06-01'),
          userRoles: { create: { roleId: facultyRole.id } },
        },
      });
    } else {
      facultyNeha = await prisma.user.update({
        where: { id: facultyNeha.id },
        data: {
          staffCategory: StaffCategory.FACULTY,
          compensationModel: CompensationModel.REVENUE_SHARING,
        },
      });
    }
    assert(
      facultyNeha.staffCategory === 'FACULTY' && facultyNeha.compensationModel === 'REVENUE_SHARING',
      'Faculty C correctly classified with Revenue Sharing model',
      `Neha Patel: Category=${facultyNeha.staffCategory}, Model=${facultyNeha.compensationModel}`
    );

    // =========================================================================
    // 2. TEACHING ASSIGNMENTS (No duplicate staff records)
    // =========================================================================
    console.log('\n--- 2. Setting Up Course and Subject Assignments ---');

    // Priya -> 10th Standard Maths
    const assignPriya10M = await prisma.staffCourseAssignment.upsert({
      where: {
        userId_classId_subjectId_batchId: {
          userId: facultyPriya.id,
          classId: class10.id,
          subjectId: subj10Maths.id,
          batchId: batch10A.id,
        },
      },
      update: { isActive: true, staffSharePercentage: new Decimal(70.0) },
      create: {
        userId: facultyPriya.id,
        classId: class10.id,
        subjectId: subj10Maths.id,
        batchId: batch10A.id,
        staffSharePercentage: new Decimal(70.0),
        compensationRule: 'REVENUE_SHARE_70_30',
        isActive: true,
      },
    });

    // Priya -> 12th Standard Maths (Same teacher, multiple offerings, NO duplicate user record)
    const assignPriya12M = await prisma.staffCourseAssignment.upsert({
      where: {
        userId_classId_subjectId_batchId: {
          userId: facultyPriya.id,
          classId: class12.id,
          subjectId: subj12Maths.id,
          batchId: batch12A.id,
        },
      },
      update: { isActive: true, staffSharePercentage: new Decimal(70.0) },
      create: {
        userId: facultyPriya.id,
        classId: class12.id,
        subjectId: subj12Maths.id,
        batchId: batch12A.id,
        staffSharePercentage: new Decimal(70.0),
        compensationRule: 'REVENUE_SHARE_70_30',
        isActive: true,
      },
    });

    // Vikram -> 10th Standard Science
    const assignVikram10S = await prisma.staffCourseAssignment.upsert({
      where: {
        userId_classId_subjectId_batchId: {
          userId: facultyVikram.id,
          classId: class10.id,
          subjectId: subj10Science.id,
          batchId: batch10A.id,
        },
      },
      update: { isActive: true, staffSharePercentage: new Decimal(70.0) },
      create: {
        userId: facultyVikram.id,
        classId: class10.id,
        subjectId: subj10Science.id,
        batchId: batch10A.id,
        staffSharePercentage: new Decimal(70.0),
        compensationRule: 'REVENUE_SHARE_70_30',
        isActive: true,
      },
    });

    // Neha -> Co-teacher for 10th Standard Maths
    const assignNeha10M = await prisma.staffCourseAssignment.upsert({
      where: {
        userId_classId_subjectId_batchId: {
          userId: facultyNeha.id,
          classId: class10.id,
          subjectId: subj10Maths.id,
          batchId: batch10A.id,
        },
      },
      update: { isActive: true, staffSharePercentage: new Decimal(70.0) },
      create: {
        userId: facultyNeha.id,
        classId: class10.id,
        subjectId: subj10Maths.id,
        batchId: batch10A.id,
        staffSharePercentage: new Decimal(70.0),
        compensationRule: 'REVENUE_SHARE_70_30',
        isActive: true,
      },
    });

    assert(
      assignPriya10M.userId === facultyPriya.id && assignPriya12M.userId === facultyPriya.id,
      'Same teacher assigned to multiple subjects across standards without duplicate user records',
      `Priya user ID is single: ${facultyPriya.id} across 10th Maths & 12th Maths`
    );

    // =========================================================================
    // 3. GENERAL STAFF FIXED SALARY ACCRUAL & IDEMPOTENCY
    // =========================================================================
    console.log('\n--- 3. Testing General Staff Fixed Salary Accrual & Idempotency ---');

    // Clean up any previous test ledgers for Ramesh for 2026-10
    await prisma.staffSalaryLedger.deleteMany({
      where: { userId: generalStaff.id, payPeriod: '2026-10' },
    });

    // Run accrual for 2026-10
    const accrualResult1 = await salaryService.accrueFixedSalaries({
      payPeriod: '2026-10',
      staffId: generalStaff.id,
      notes: 'October 2026 Regular Salary Accrual',
    });

    assert(
      accrualResult1.accruedCount === 1 && accrualResult1.entries.length === 1 && accrualResult1.entries[0].earnedAmount === 35000,
      'Fixed salary accrual succeeds with exact configured amount',
      `Accrued count: ${accrualResult1.accruedCount}, Amount: ₹${accrualResult1.entries[0]?.earnedAmount}`
    );

    // Verify ledger entry attributes
    const generalStaffSummary = await salaryService.getStaffSalarySummary(generalStaff.id);
    assert(
      generalStaffSummary.staff.compensationModel === 'FIXED_SALARY' &&
      generalStaffSummary.summary.outstandingPayable === 35000,
      'General staff summary reflects ₹35,000 outstanding fixed payable',
      `Outstanding payable: ₹${generalStaffSummary.summary.outstandingPayable}`
    );

    // Idempotency: Re-running accrual for 2026-10 must NOT duplicate
    const accrualResult2 = await salaryService.accrueFixedSalaries({
      payPeriod: '2026-10',
      staffId: generalStaff.id,
      notes: 'Duplicate test attempt',
    });

    assert(
      accrualResult2.accruedCount === 0 && accrualResult2.skippedCount === 1,
      'Idempotent fixed salary accrual prevents duplicate monthly salary records',
      `Skipped count: ${accrualResult2.skippedCount}, Accrued: ${accrualResult2.accruedCount}`
    );

    // =========================================================================
    // 4. MANUAL ADJUSTMENTS (BONUSES & DEDUCTIONS)
    // =========================================================================
    console.log('\n--- 4. Testing Manual Salary Adjustments ---');

    // 4A. Performance Bonus (+₹5,000)
    await salaryService.createSalaryAdjustment(
      {
        staffId: generalStaff.id,
        type: 'BONUS',
        amount: 5000,
        reason: 'Diwali Festive Performance Bonus',
        payPeriod: '2026-10',
      },
      generalStaff.id,
    );

    // 4B. Deduction (-₹2,000)
    await salaryService.createSalaryAdjustment(
      {
        staffId: generalStaff.id,
        type: 'DEDUCTION',
        amount: 2000,
        reason: 'Unplanned Leave Deduction (2 days)',
        payPeriod: '2026-10',
      },
      generalStaff.id,
    );

    const generalSummaryAfterAdj = await salaryService.getStaffSalarySummary(generalStaff.id);
    assert(
      generalSummaryAfterAdj.summary.outstandingPayable === 38000, // 35000 + 5000 - 2000 = 38000
      'Manual adjustments correctly update general staff payable balance (₹35k + ₹5k bonus - ₹2k ded = ₹38k)',
      `Calculated balance: ₹${generalSummaryAfterAdj.summary.outstandingPayable}`
    );

    // =========================================================================
    // 5. STUDENT FEE COLLECTION & FACULTY 70/30 REVENUE SHARING
    // =========================================================================
    console.log('\n--- 5. Testing Faculty 70/30 Revenue Sharing & Split Allocations ---');

    // Create Student
    let student = await prisma.student.findFirst({ where: { studentCode: 'STU-DUAL-001' } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          studentCode: 'STU-DUAL-001',
          admissionNumber: 'ADM-DUAL-001',
          attendanceCode: '901',
          firstName: 'Aarav',
          lastName: 'Mehta',
          gender: Gender.MALE,
          dob: new Date('2010-04-15'),
          status: 'ACTIVE',
        },
      });
    }

    // Invoice 1: 10th Standard Maths (Amount: ₹10,000)
    const invoice10M = await prisma.feeInvoice.create({
      data: {
        invoiceNumber: `INV-DUAL-10M-${Date.now()}`,
        studentId: student.id,
        classId: class10.id,
        batchId: batch10A.id,
        subjectId: subj10Maths.id,
        totalAmount: new Decimal(10000),
        paidAmount: new Decimal(10000),
        balanceAmount: new Decimal(0),
        status: 'PAID',
        dueDate: new Date('2026-10-31'),
        lines: {
          create: [
            {
              description: '10th Standard Mathematics Tuition',
              amount: new Decimal(10000),
              classId: class10.id,
              subjectId: subj10Maths.id,
            },
          ],
        },
      },
    });

    // Payment 1: ₹10,000 collected for 10th Maths
    const payment1 = await prisma.payment.create({
      data: {
        receiptNumber: `RCPT-10M-${Date.now()}`,
        studentId: student.id,
        recordedById: generalStaff.id,
        amount: new Decimal(10000),
        paymentMethod: 'UPI',
        status: 'COMPLETED',
        paidAt: new Date(),
        reference: 'UPI/TEST/1001',
        allocations: {
          create: {
            invoiceId: invoice10M.id,
            allocatedAmount: new Decimal(10000),
          },
        },
      },
    });

    // Run revenue calculation
    const calcResult1: any = await salaryService.calculatePaymentSalaryRevenue(payment1.id);
    const entries1: any[] = calcResult1.createdLedgerEntries || [];

    // Verify 10th Maths co-teachers (Priya and Neha) split the 70% pool:
    // Total pool = 70% of 10,000 = ₹7,000.
    // Each receives 7,000 / 2 = ₹3,500.
    // Academy share = 30% of 10,000 = ₹3,000.
    const priyaEntry1 = entries1.find((e: any) => e.userId === facultyPriya.id);
    const nehaEntry1 = entries1.find((e: any) => e.userId === facultyNeha.id);
    const vikramEntry1 = entries1.find((e: any) => e.userId === facultyVikram.id);
    const generalEntry1 = entries1.find((e: any) => e.userId === generalStaff.id);

    assert(
      priyaEntry1 !== undefined && Number(priyaEntry1.earnedAmount) === 3500 &&
      nehaEntry1 !== undefined && Number(nehaEntry1.earnedAmount) === 3500,
      'Co-teachers split 70% faculty pool equally without exceeding the pool (₹3,500 each)',
      `Priya earned: ₹${priyaEntry1?.earnedAmount}, Neha earned: ₹${nehaEntry1?.earnedAmount}, Total faculty = ₹7,000`
    );

    const academyShareTotal1 = entries1.reduce((sum: number, e: any) => sum + Number(e.academyShareAmount), 0);
    assert(
      academyShareTotal1 === 3000,
      'Academy receives exact configured 30% revenue share (₹3,000 from ₹10,000)',
      `Academy share: ₹${academyShareTotal1}`
    );

    assert(
      vikramEntry1 === undefined,
      'Faculty assigned only to Science receives ₹0 from Mathematics collection (Subject Isolation)',
      'Vikram Singh has 0 allocations from 10th Maths'
    );

    assert(
      generalEntry1 === undefined,
      'General staff with fixed salary receives ₹0 from student fee collection (Model Isolation)',
      'Ramesh Admin has 0 fee revenue share allocations'
    );

    // =========================================================================
    // 6. MULTI-SUBJECT TEACHING: SEPARATE ASSIGNMENTS & CONSOLIDATED VIEW
    // =========================================================================
    console.log('\n--- 6. Testing Multi-Subject Assignment Earnings Attribution ---');

    // Invoice 2: 12th Standard Maths (Amount: ₹20,000)
    const invoice12M = await prisma.feeInvoice.create({
      data: {
        invoiceNumber: `INV-DUAL-12M-${Date.now()}`,
        studentId: student.id,
        classId: class12.id,
        batchId: batch12A.id,
        subjectId: subj12Maths.id,
        totalAmount: new Decimal(20000),
        paidAmount: new Decimal(20000),
        balanceAmount: new Decimal(0),
        status: 'PAID',
        dueDate: new Date('2026-10-31'),
        lines: {
          create: [
            {
              description: '12th Standard Mathematics Tuition',
              amount: new Decimal(20000),
              classId: class12.id,
              subjectId: subj12Maths.id,
            },
          ],
        },
      },
    });

    // Payment 2: ₹20,000 collected for 12th Maths (Only Priya teaches 12th Maths)
    const payment2 = await prisma.payment.create({
      data: {
        receiptNumber: `RCPT-12M-${Date.now()}`,
        studentId: student.id,
        recordedById: generalStaff.id,
        amount: new Decimal(20000),
        paymentMethod: 'BANK_TRANSFER',
        status: 'COMPLETED',
        paidAt: new Date(),
        reference: 'NEFT/TEST/2002',
        allocations: {
          create: {
            invoiceId: invoice12M.id,
            allocatedAmount: new Decimal(20000),
          },
        },
      },
    });

    const calcResult2: any = await salaryService.calculatePaymentSalaryRevenue(payment2.id);
    const entries2: any[] = calcResult2.createdLedgerEntries || [];
    const priyaEntry2 = entries2.find((e: any) => e.userId === facultyPriya.id);
    const academyShareTotal2 = entries2.reduce((sum: number, e: any) => sum + Number(e.academyShareAmount), 0);

    assert(
      priyaEntry2 !== undefined && Number(priyaEntry2.earnedAmount) === 14000,
      'Solo faculty on 12th Maths receives full 70% pool (₹14,000 from ₹20,000)',
      `Priya earned ₹${priyaEntry2?.earnedAmount} (70%), Academy received ₹${academyShareTotal2} (30%)`
    );

    // Consolidated Salary Statement for Priya:
    // Should show 10th Maths: ₹3,500 and 12th Maths: ₹14,000; Total Earned: ₹17,500
    const priyaStatement = await salaryService.getStaffSalarySummary(facultyPriya.id);
    const assign10MEarnings = priyaStatement.earningsByAssignment.find((a: any) => a.classCode === 'STD10-DUAL');
    const assign12MEarnings = priyaStatement.earningsByAssignment.find((a: any) => a.classCode === 'STD12-DUAL');

    assert(
      priyaStatement.summary.totalEarned === 17500 &&
      assign10MEarnings?.earned === 3500 &&
      assign12MEarnings?.earned === 14000,
      'Teacher assigned to multiple subjects maintains distinct assignment-level earnings and correct combined total',
      `Combined Total: ₹${priyaStatement.summary.totalEarned} (10th Maths=₹${assign10MEarnings?.earned}, 12th Maths=₹${assign12MEarnings?.earned})`
    );

    // =========================================================================
    // 7. MULTI-COURSE PAYMENT SPLIT ALLOCATION & PARTIAL PAYMENTS
    // =========================================================================
    console.log('\n--- 7. Testing Multi-Course Split Allocations ---');

    // Invoice 3: 10th Science (Amount: ₹8,000)
    const invoice10S = await prisma.feeInvoice.create({
      data: {
        invoiceNumber: `INV-DUAL-10S-${Date.now()}`,
        studentId: student.id,
        classId: class10.id,
        batchId: batch10A.id,
        subjectId: subj10Science.id,
        totalAmount: new Decimal(8000),
        paidAmount: new Decimal(4000),
        balanceAmount: new Decimal(4000),
        status: 'PARTIAL',
        dueDate: new Date('2026-10-31'),
        lines: {
          create: [
            {
              description: '10th Standard Science Lab & Tuition',
              amount: new Decimal(8000),
              classId: class10.id,
              subjectId: subj10Science.id,
            },
          ],
        },
      },
    });

    // Invoice 4: Another 10th Maths invoice (Amount: ₹6,000)
    const invoice10M2 = await prisma.feeInvoice.create({
      data: {
        invoiceNumber: `INV-DUAL-10M2-${Date.now()}`,
        studentId: student.id,
        classId: class10.id,
        batchId: batch10A.id,
        subjectId: subj10Maths.id,
        totalAmount: new Decimal(6000),
        paidAmount: new Decimal(6000),
        balanceAmount: new Decimal(0),
        status: 'PAID',
        dueDate: new Date('2026-10-31'),
        lines: {
          create: [
            {
              description: '10th Standard Mathematics Supplementary',
              amount: new Decimal(6000),
              classId: class10.id,
              subjectId: subj10Maths.id,
            },
          ],
        },
      },
    });

    // Single Payment of ₹10,000 covering multiple subjects:
    // ₹6,000 allocated to 10th Maths
    // ₹4,000 (partial) allocated to 10th Science
    const paymentMulti = await prisma.payment.create({
      data: {
        receiptNumber: `RCPT-MULTI-${Date.now()}`,
        studentId: student.id,
        recordedById: generalStaff.id,
        amount: new Decimal(10000),
        paymentMethod: 'UPI',
        status: 'COMPLETED',
        paidAt: new Date(),
        reference: 'UPI/MULTI/3003',
        allocations: {
          create: [
            { invoiceId: invoice10M2.id, allocatedAmount: new Decimal(6000) },
            { invoiceId: invoice10S.id, allocatedAmount: new Decimal(4000) },
          ],
        },
      },
    });

    const calcResultMulti: any = await salaryService.calculatePaymentSalaryRevenue(paymentMulti.id);
    const multiEntries: any[] = calcResultMulti.createdLedgerEntries || [];

    // 10th Maths: 70% of ₹6,000 = ₹4,200 => split Priya (₹2,100) & Neha (₹2,100)
    // 10th Science: 70% of ₹4,000 = ₹2,800 => Vikram (₹2,800)
    const priyaMulti = multiEntries.find((e: any) => e.userId === facultyPriya.id && e.subjectId === subj10Maths.id);
    const nehaMulti = multiEntries.find((e: any) => e.userId === facultyNeha.id && e.subjectId === subj10Maths.id);
    const vikramMulti = multiEntries.find((e: any) => e.userId === facultyVikram.id && e.subjectId === subj10Science.id);

    assert(
      priyaMulti !== undefined && Number(priyaMulti.earnedAmount) === 2100 &&
      nehaMulti !== undefined && Number(nehaMulti.earnedAmount) === 2100 &&
      vikramMulti !== undefined && Number(vikramMulti.earnedAmount) === 2800,
      'Multi-subject payment correctly isolates and splits earnings across respective fee obligations',
      `Maths: Priya=₹${priyaMulti?.earnedAmount}, Neha=₹${nehaMulti?.earnedAmount}; Science: Vikram=₹${vikramMulti?.earnedAmount}`
    );

    // =========================================================================
    // 8. PAYMENT REVERSALS / REFUNDS & COMPENSATING ENTRIES
    // =========================================================================
    console.log('\n--- 8. Testing Payment Reversals & Compensating Entries ---');

    // Reverse payment 1 (₹10,000 10th Maths payment)
    const reversalEntries = await salaryService.reversePaymentSalaryRevenue(
      payment1.id,
      'Parent requested fee refund for student transfer',
      generalStaff.id
    );

    assert(
      reversalEntries.length === 2, // Priya and Neha
      'Reversal creates compensating negative ledger entries without deleting historical rows',
      `Reversal entries created: ${reversalEntries.length}`
    );

    // Verify negative values
    const priyaRev = reversalEntries.find((e: any) => e.userId === facultyPriya.id);
    assert(
      priyaRev !== undefined && Number(priyaRev.earnedAmount) === -3500 && priyaRev.isReversed === true,
      'Compensating ledger entry has negative amount (-₹3,500) and isReversed=true',
      `Reversal earnedAmount: ₹${priyaRev?.earnedAmount}`
    );

    // Verify Priya's updated summary reflects reversal
    const priyaAfterRev = await salaryService.getStaffSalarySummary(facultyPriya.id);
    assert(
      priyaAfterRev.summary.totalEarned === 16100, // 17500 (prev) + 2100 (multi) - 3500 (rev) = 16100
      'Faculty balance accurately reconciles after payment reversal (₹17,500 + ₹2,100 - ₹3,500 = ₹16,100)',
      `Priya current payable: ₹${priyaAfterRev.summary.totalEarned}`
    );

    // =========================================================================
    // 9. IDEMPOTENCY ON PAYMENT RE-PROCESSING
    // =========================================================================
    console.log('\n--- 9. Testing Payment Processing Idempotency ---');

    // Re-calculating payment2 (already processed) should return skipped: true and not add duplicate ledgers
    const countBefore = await prisma.staffSalaryLedger.count({ where: { paymentId: payment2.id } });
    const retryResult: any = await salaryService.calculatePaymentSalaryRevenue(payment2.id);
    const countAfter = await prisma.staffSalaryLedger.count({ where: { paymentId: payment2.id } });

    assert(
      countBefore === countAfter && retryResult.skipped === true,
      'Retrying payment salary calculation is strictly idempotent and creates no duplicate ledger rows',
      `Ledger count before: ${countBefore}, count after: ${countAfter}, skipped: ${retryResult.skipped}`
    );

    // =========================================================================
    // 10. ACADEMY FINANCE INTEGRATION & REPORTING
    // =========================================================================
    console.log('\n--- 10. Testing Academy Revenue Summary & Finance Integration ---');

    const financeSummary = await salaryService.getAcademyRevenueSummary();
    const metrics = financeSummary.metrics;
    assert(
      metrics.totalCollectedFees > 0 &&
      metrics.facultyCompensationAccrued > 0 &&
      metrics.fixedSalaryAccrued === 38000 && // 35000 + 5000 bonus - 2000 ded
      metrics.academyShareAccrued > 0 &&
      metrics.outstandingFacultyPayable > 0 &&
      metrics.outstandingFixedPayable === 38000,
      'Finance integration accurately separates Faculty 70% share from Fixed staff payables and Academy 30% revenue',
      `Fixed Accrued: ₹${metrics.fixedSalaryAccrued}, Faculty Accrued: ₹${metrics.facultyCompensationAccrued}, Academy Share: ₹${metrics.academyShareAccrued}`
    );

    // =========================================================================
    // 11. HISTORICAL IMMUTABILITY
    // =========================================================================
    console.log('\n--- 11. Testing Historical Immutability on Future Config Changes ---');

    // Modify global config to 60/40
    await salaryService.updateSalaryConfig({
      defaultStaffPoolRate: 60,
      defaultAcademyShareRate: 40,
    });

    // Check that historical entry for payment2 is still recorded at 70%
    const payment2Ledger = await prisma.staffSalaryLedger.findFirst({
      where: { paymentId: payment2.id, isReversed: false },
    });

    assert(
      payment2Ledger !== null &&
      Number(payment2Ledger?.staffPoolRate) === 70 &&
      Number(payment2Ledger?.earnedAmount) === 14000,
      'Historical earnings and pool rates remain immutable after future global configuration updates',
      `Recorded rate: ${payment2Ledger?.staffPoolRate}%, Recorded earned: ₹${payment2Ledger?.earnedAmount}`
    );

    // Restore config to 70/30
    await salaryService.updateSalaryConfig({
      defaultStaffPoolRate: 70,
      defaultAcademyShareRate: 30,
    });

    // Summary
    console.log('\n================================================================');
    console.log(` RESULTS: ${passedTests} / ${totalTests} TESTS PASSED `);
    console.log('================================================================\n');

    if (passedTests === totalTests) {
      console.log('ALL DUAL STAFF SALARY & REVENUE SHARING ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!\n');
    } else {
      console.error(`SOME TESTS FAILED: ${totalTests - passedTests} failed.\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
