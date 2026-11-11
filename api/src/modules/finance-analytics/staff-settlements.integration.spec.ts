import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { SalaryService } from '../salary/salary.service';
import { FinanceAnalyticsService } from './finance-analytics.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('Staff Settlements Integration Suite (I1 - I4)', () => {
  let salaryService: SalaryService;
  let analyticsService: FinanceAnalyticsService;
  let mockPrisma: any;

  beforeEach(async () => {
    // In-memory mock store for StaffAccrualLedger, AuditLog, etc.
    const accrualStore: any[] = [];
    const auditLogs: any[] = [];

    mockPrisma = {
      staffAccrualLedger: {
        findMany: jest.fn().mockImplementation((args: any) => {
          let list = [...accrualStore];
          if (args?.where?.studentId) {
            list = list.filter((x) => x.studentId === args.where.studentId);
          }
          if (args?.where?.staffId) {
            list = list.filter((x) => x.staffId === args.where.staffId);
          }
          if (args?.where?.payPeriod) {
            list = list.filter((x) => x.payPeriod === args.where.payPeriod);
          }
          if (args?.where?.type) {
            list = list.filter((x) => x.type === args.where.type);
          }
          return Promise.resolve(list);
        }),
        create: jest.fn().mockImplementation((args: any) => {
          const { staffId, studentId, payPeriod, type, invoiceId } = args.data;
          // Emulate unique constraint @@unique([staffId, studentId, payPeriod, type, invoiceId])
          const duplicate = accrualStore.find(
            (x) =>
              x.staffId === staffId &&
              x.studentId === studentId &&
              x.payPeriod === payPeriod &&
              x.type === type &&
              (x.invoiceId === (invoiceId || null) || (!x.invoiceId && !invoiceId)),
          );

          if (duplicate) {
            const error: any = new Error('Unique constraint failed on the fields: (`staffId`,`studentId`,`payPeriod`,`type`,`invoiceId`)');
            error.code = 'P2002';
            return Promise.reject(error);
          }

          const created = {
            id: `ledger-${accrualStore.length + 1}`,
            ...args.data,
            occurredAt: args.data.occurredAt || new Date(),
            studentFeePaid: args.data.studentFeePaid || new Decimal(0),
            staff: { id: staffId, firstName: 'Suresh', lastName: 'Raman' },
            student: { id: studentId, firstName: 'Rahul', lastName: 'Verma' },
            assignment: {
              id: args.data.assignmentId,
              classId: 'course-bio-12',
              class: { id: 'course-bio-12', name: 'Class 12 - Biology' },
            },
          };
          accrualStore.push(created);
          return Promise.resolve(created);
        }),
        update: jest.fn().mockImplementation((args: any) => {
          const idx = accrualStore.findIndex((x) => x.id === args.where.id);
          if (idx !== -1) {
            accrualStore[idx] = { ...accrualStore[idx], ...args.data };
            return Promise.resolve(accrualStore[idx]);
          }
          return Promise.reject(new Error('Not found'));
        }),
      },
      auditLog: {
        create: jest.fn().mockImplementation((args: any) => {
          auditLogs.push(args.data);
          return Promise.resolve({ id: `log-${auditLogs.length}`, ...args.data });
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve([...auditLogs])),
      },
      staffCourseAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'assign-suresh-1',
            userId: 'staff-suresh',
            classId: 'course-bio-12',
            isActive: true,
            compensationRule: {
              mode: 'STUDENT_TIER_BASED',
              config: {
                allSubjects: { type: 'FIXED_AMOUNT', value: 1166 },
                twoSubjects: { type: 'FIXED_AMOUNT', value: 1260 },
                singleSubject: { type: 'FIXED_AMOUNT', value: 1260 },
              },
            },
            class: { id: 'course-bio-12', name: 'Class 12 - Biology' },
            user: { id: 'staff-suresh', firstName: 'Suresh', lastName: 'Raman' },
          },
        ]),
      },
      studentBatchEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      courseFeeConfig: {
        findMany: jest.fn().mockResolvedValue([
          {
            classId: 'course-bio-12',
            amount: new Decimal(5000),
            allSubjectsFee: new Decimal(5000),
            twoSubjectsFee: new Decimal(3600),
            singleSubjectFee: new Decimal(1800),
            isActive: true,
          },
        ]),
      },
      user: {
        findUnique: jest.fn().mockImplementation((args: any) => {
          if (args.where.id === 'staff-suresh') {
            return Promise.resolve({
              id: 'staff-suresh',
              firstName: 'Suresh',
              lastName: 'Raman',
              name: 'Suresh Raman',
              staffAssignments: [
                {
                  id: 'assign-suresh-1',
                  class: { id: 'course-bio-12', name: 'Class 12 - Biology' },
                },
              ],
            });
          }
          return Promise.resolve(null);
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      }),
    };

    salaryService = new SalaryService(mockPrisma);
    analyticsService = new FinanceAnalyticsService(mockPrisma);
  });

  // I1. Two concurrent enrollment requests for same student -> exactly ONE StaffAccrualLedger row (unique constraint works).
  it('I1: concurrent enrollment requests produce exactly ONE StaffAccrualLedger row due to P2002 handling', async () => {
    const studentId = 'student-rahul-1';
    const classId = 'course-bio-12';
    const payPeriod = '2026-11';

    // Fire two concurrent enrollment accrual calls
    const [res1, res2] = await Promise.all([
      salaryService.accrueForEnrollment({
        studentId,
        classId,
        studentTier: 'ALL',
        payPeriod,
      }),
      salaryService.accrueForEnrollment({
        studentId,
        classId,
        studentTier: 'ALL',
        payPeriod,
      }),
    ]);

    const totalCreatedCount = (res1.length || 0) + (res2.length || 0);
    expect(totalCreatedCount).toBe(1);

    const rows = await mockPrisma.staffAccrualLedger.findMany({
      where: { studentId, payPeriod, type: 'ACCRUAL' },
    });
    expect(rows.length).toBe(1);
    expect(Number(rows[0].amount)).toBe(1166);
  });

  // I2. Bounced payment -> REVERSAL row created, entitlement unchanged, AuditLog written.
  it('I2: bounced payment creates REVERSAL row with amount=0, leaves entitlement unchanged, and writes AuditLog', async () => {
    const studentId = 'student-rahul-2';
    const classId = 'course-bio-12';
    const payPeriod = '2026-11';

    // 1. Initial enrollment
    await salaryService.accrueForEnrollment({
      studentId,
      classId,
      studentTier: 'ALL',
      payPeriod,
    });

    const initialLedgers = await mockPrisma.staffAccrualLedger.findMany({
      where: { studentId, payPeriod },
    });
    expect(initialLedgers.length).toBe(1);
    expect(Number(initialLedgers[0].amount)).toBe(1166);

    // 2. Bounced payment event
    await salaryService.accrueForPayment({
      paymentId: 'payment-bounced-99',
      studentId,
      allocatedAmount: 0,
      isReversal: true,
      reversalReason: 'Cheque bounced NSF',
      payPeriod,
    });

    const allLedgers = await mockPrisma.staffAccrualLedger.findMany({
      where: { studentId, payPeriod },
    });
    // Should have 1 ACCRUAL and 1 REVERSAL
    expect(allLedgers.length).toBe(2);

    const reversalRow = allLedgers.find((x: any) => x.type === 'REVERSAL');
    expect(reversalRow).toBeDefined();
    expect(Number(reversalRow.amount)).toBe(0); // Business Rule: amount = 0, entitlement unchanged

    const accrualRow = allLedgers.find((x: any) => x.type === 'ACCRUAL');
    expect(Number(accrualRow.amount)).toBe(1166); // Staff entitlement preserved

    // Verify AuditLog written
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REVERSAL_LOGGED',
          entityType: 'StaffAccrualLedger',
        }),
      }),
    );
  });

  // I3. GET /staff-settlements returns realizedAmount that increases as student payments are added.
  it('I3: GET /staff-settlements returns realizedAmount that increases as student payments are added', async () => {
    const studentId = 'student-rahul-3';
    const classId = 'course-bio-12';
    const payPeriod = '2026-11';

    // 1. Enroll student in ALL subjects (Entitlement = 1166, Course Fee = 5000)
    await salaryService.accrueForEnrollment({
      studentId,
      classId,
      studentTier: 'ALL',
      payPeriod,
    });

    // Baseline: 0 payments
    let settlements = await analyticsService.getStaffSettlements(payPeriod);
    const sureshBefore = settlements.find((s: any) => s.staffId === 'staff-suresh');
    expect(sureshBefore.totalEntitlement).toBe(1166);
    expect(sureshBefore.realizedAmount).toBe(0);
    expect(sureshBefore.pendingAmount).toBe(1166);

    // 2. Student pays 50% (₹2,500 of ₹5,000)
    await salaryService.accrueForPayment({
      paymentId: 'pay-part-1',
      studentId,
      allocatedAmount: 2500,
      payPeriod,
    });

    settlements = await analyticsService.getStaffSettlements(payPeriod);
    const sureshMid = settlements.find((s: any) => s.staffId === 'staff-suresh');
    // Realized should be ~50% of 1166 = 583
    expect(sureshMid.realizedAmount).toBe(583);
    expect(sureshMid.pendingAmount).toBe(1166 - 583);

    // 3. Student pays remaining ₹2,500 (total ₹5,000 paid)
    await salaryService.accrueForPayment({
      paymentId: 'pay-part-2',
      studentId,
      allocatedAmount: 2500,
      payPeriod,
    });

    settlements = await analyticsService.getStaffSettlements(payPeriod);
    const sureshFull = settlements.find((s: any) => s.staffId === 'staff-suresh');
    // 100% realized
    expect(sureshFull.realizedAmount).toBe(1166);
    expect(sureshFull.pendingAmount).toBe(0);
  });

  // I4. GET /staff-settlements/:id/history runningTotal is monotonic and matches sum(accrualLedger where type=ACCRUAL).
  it('I4: history runningTotal is monotonic and matches sum of ACCRUAL ledger entries', async () => {
    const classId = 'course-bio-12';
    const payPeriod = '2026-11';

    // Enroll 3 students sequentially
    await salaryService.accrueForEnrollment({
      studentId: 'student-A',
      classId,
      studentTier: 'ALL', // 1166
      enrollmentDate: new Date('2026-11-01T10:00:00Z'),
      payPeriod,
    });

    await salaryService.accrueForEnrollment({
      studentId: 'student-B',
      classId,
      studentTier: 'TWO_SUBJECTS', // 1260
      enrollmentDate: new Date('2026-11-02T10:00:00Z'),
      payPeriod,
    });

    await salaryService.accrueForEnrollment({
      studentId: 'student-C',
      classId,
      studentTier: 'SINGLE', // 1260
      enrollmentDate: new Date('2026-11-03T10:00:00Z'),
      payPeriod,
    });

    const history = await analyticsService.getStaffSettlementHistory('staff-suresh', payPeriod);

    expect(history.summary.totalEntitlement).toBe(1166 + 1260 + 1260); // 3686

    const running = history.runningTotal;
    expect(running.length).toBe(3);

    // Verify monotonic increase
    for (let i = 1; i < running.length; i++) {
      expect(running[i].cumulative).toBeGreaterThanOrEqual(running[i - 1].cumulative);
    }

    expect(running[0].cumulative).toBe(1166);
    expect(running[1].cumulative).toBe(1166 + 1260); // 2426
    expect(running[2].cumulative).toBe(1166 + 1260 + 1260); // 3686

    const accrualSum = history.accrualLedger
      .filter((x: any) => x.type === 'ACCRUAL')
      .reduce((sum: number, x: any) => sum + x.amount, 0);

    expect(running[running.length - 1].cumulative).toBe(accrualSum);
  });
});

