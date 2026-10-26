import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentsService } from './students.service';
import { PaymentMethod, InvoiceStatus, Prisma } from '@prisma/client';

describe('Student Advance Management & Allocation Suite', () => {
  let studentsService: StudentsService;
  let mockPrisma: any;
  let mockAttendanceCodeService: any;
  let mockFeesService: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'student-123' }]),
      student: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      studentAdvance: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      studentAdvanceAllocation: {
        create: jest.fn(),
      },
      feeInvoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
      },
      batch: {
        findUnique: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-uuid' }),
      },
    };

    mockAttendanceCodeService = {
      allocateCode: jest.fn().mockResolvedValue('101'),
    };

    mockFeesService = {
      createCourseInvoiceForEnrollment: jest.fn().mockResolvedValue({ id: 'inv-123' }),
    };

    studentsService = new StudentsService(
      mockPrisma,
      mockAttendanceCodeService,
      mockFeesService,
    );
  });

  describe('Scenario 1 & 2: Admission Form Advance Collection', () => {
    it('Scenario 1: should create student with no advance without creating advance transaction', async () => {
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-1',
        classId: 'class-1',
        name: 'Batch 2026',
        class: { id: 'class-1', name: 'Grade 10', code: 'G10', subjects: [] },
      });
      mockPrisma.student.findFirst.mockResolvedValue(null);
      mockPrisma.student.create.mockResolvedValue({
        id: 'student-1',
        studentCode: 'RCA-2026-001',
        admissionNumber: 'ADM-1001',
        firstName: 'John',
        lastName: 'Doe',
        dob: new Date('2008-01-01'),
        gender: 'MALE',
        batchEnrollments: [{ id: 'en-1', batchId: 'batch-1' }],
      });

      const res = await studentsService.create({
        firstName: 'John',
        lastName: 'Doe',
        dob: '2008-01-01',
        gender: 'MALE' as any,
        batchId: 'batch-1',
        advanceAmount: 0,
      });

      expect(res).toBeDefined();
      expect(mockPrisma.studentAdvance.create).not.toHaveBeenCalled();
    });

    it('Scenario 2: should create student with ₹2,000 advance and generate unique receipt', async () => {
      mockPrisma.batch.findUnique.mockResolvedValue({
        id: 'batch-1',
        classId: 'class-1',
        name: 'Batch 2026',
        class: { id: 'class-1', name: 'Grade 10', code: 'G10', subjects: [] },
      });
      mockPrisma.student.findFirst.mockResolvedValue(null);
      mockPrisma.student.create.mockResolvedValue({
        id: 'student-1',
        studentCode: 'RCA-2026-001',
        admissionNumber: 'ADM-1001',
        firstName: 'Rahul',
        lastName: 'Sharma',
        dob: new Date('2008-01-01'),
        gender: 'MALE',
        batchEnrollments: [{ id: 'en-1', batchId: 'batch-1' }],
      });
      mockPrisma.studentAdvance.create.mockResolvedValue({
        id: 'adv-1',
        receiptNumber: 'ADV-2026-00001',
        amount: new Prisma.Decimal(2000),
        paymentMethod: PaymentMethod.UPI,
      });

      const res = await studentsService.create(
        {
          firstName: 'Rahul',
          lastName: 'Sharma',
          dob: '2008-01-01',
          gender: 'MALE' as any,
          batchId: 'batch-1',
          advanceAmount: 2000,
          advancePaymentDate: '2026-10-24',
          advancePaymentMethod: PaymentMethod.UPI,
          advanceReference: 'UPI-REF-999',
        },
        'admin-user-id',
      );

      expect(res).toBeDefined();
      expect(mockPrisma.studentAdvance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'student-1',
            amount: new Prisma.Decimal(2000),
            paymentMethod: PaymentMethod.UPI,
            reference: 'UPI-REF-999',
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STUDENT_ADVANCE_COLLECTED_AT_ADMISSION',
          }),
        }),
      );
    });
  });

  describe('Scenario 3 & 4: Existing Student Advance Collection & Balances', () => {
    it('Scenario 3: should record an additional ₹500 advance creating an immutable financial entry', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1', firstName: 'Rahul' });
      mockPrisma.studentAdvance.findFirst.mockResolvedValue(null); // No recent duplicate
      mockPrisma.studentAdvance.create.mockResolvedValue({
        id: 'adv-2',
        receiptNumber: 'ADV-2026-00002',
        amount: new Prisma.Decimal(500),
        paymentMethod: PaymentMethod.CASH,
      });
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          receiptNumber: 'ADV-2026-00001',
          amount: new Prisma.Decimal(2000),
          paymentMethod: PaymentMethod.UPI,
          paymentDate: new Date('2026-10-20'),
          recordedBy: { firstName: 'Admin', lastName: 'User' },
          allocations: [],
          createdAt: new Date(),
        },
        {
          id: 'adv-2',
          receiptNumber: 'ADV-2026-00002',
          amount: new Prisma.Decimal(500),
          paymentMethod: PaymentMethod.CASH,
          paymentDate: new Date('2026-10-24'),
          recordedBy: { firstName: 'Admin', lastName: 'User' },
          allocations: [],
          createdAt: new Date(),
        },
      ]);

      const result = await studentsService.recordAdvance(
        'student-1',
        {
          amount: 500,
          paymentDate: '2026-10-24',
          paymentMethod: PaymentMethod.CASH,
          notes: 'Top-up advance',
        },
        'admin-user-id',
      );

      expect(result.receiptNumber).toBe('ADV-2026-00002');
      expect(mockPrisma.studentAdvance.create).toHaveBeenCalled();
      expect(result.summary.totalCollected).toBe(2500);
      expect(result.summary.totalUtilized).toBe(0);
      expect(result.summary.availableBalance).toBe(2500);
    });

    it('Scenario 4: should accurately calculate total collected, utilized, and available balance from transaction records', async () => {
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          receiptNumber: 'ADV-2026-00001',
          amount: new Prisma.Decimal(2000),
          paymentMethod: PaymentMethod.UPI,
          paymentDate: new Date('2026-10-20'),
          recordedBy: { firstName: 'Admin', lastName: 'User' },
          allocations: [
            {
              id: 'alloc-1',
              allocatedAmount: new Prisma.Decimal(500),
              allocatedAt: new Date('2026-10-21'),
              invoiceId: 'inv-1',
              invoice: { invoiceNumber: 'INV-001' },
              allocatedBy: { firstName: 'Admin', lastName: 'User' },
            },
          ],
          createdAt: new Date(),
        },
        {
          id: 'adv-2',
          receiptNumber: 'ADV-2026-00002',
          amount: new Prisma.Decimal(500),
          paymentMethod: PaymentMethod.CASH,
          paymentDate: new Date('2026-10-24'),
          recordedBy: { firstName: 'Admin', lastName: 'User' },
          allocations: [],
          createdAt: new Date(),
        },
      ]);

      const summary = await studentsService.getStudentAdvanceSummary('student-1');

      expect(summary.totalCollected).toBe(2500);
      expect(summary.totalUtilized).toBe(500);
      expect(summary.availableBalance).toBe(2000);
      expect(summary.history.length).toBe(3); // 2 deposits + 1 allocation
    });
  });

  describe('Scenario 5, 6, 7 & 8: Fee Invoice Allocation Workflow', () => {
    it('Scenario 5: should allocate ₹1,000 against ₹1,000 invoice, mark it PAID, and update balances', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        studentId: 'student-1',
        totalAmount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(0),
        balanceAmount: new Prisma.Decimal(1000),
        status: InvoiceStatus.UNPAID,
      });

      // Student has ₹2,500 advance available
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          receiptNumber: 'ADV-2026-00001',
          amount: new Prisma.Decimal(2500),
          paymentMethod: PaymentMethod.UPI,
          paymentDate: new Date('2026-10-20'),
          recordedBy: { firstName: 'Admin', lastName: 'User' },
          allocations: [],
          createdAt: new Date(),
        },
      ]);

      mockPrisma.studentAdvanceAllocation.create.mockResolvedValue({
        id: 'alloc-1',
        advanceId: 'adv-1',
        invoiceId: 'inv-1',
        allocatedAmount: new Prisma.Decimal(1000),
      });

      mockPrisma.feeInvoice.update.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        totalAmount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(1000),
        balanceAmount: new Prisma.Decimal(0),
        status: InvoiceStatus.PAID,
      });

      const result = await studentsService.allocateAdvance(
        'student-1',
        { invoiceId: 'inv-1', amount: 1000, notes: 'Settle annual fee' },
        'admin-user-id',
      );

      expect(result.success).toBe(true);
      expect(result.allocatedAmount).toBe(1000);
      expect(result.invoice.status).toBe(InvoiceStatus.PAID);
      expect(result.invoice.balanceAmount).toBe(0);

      // Verify invoice updated
      expect(mockPrisma.feeInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: expect.objectContaining({
            paidAmount: new Prisma.Decimal(1000),
            balanceAmount: new Prisma.Decimal(0),
            status: InvoiceStatus.PAID,
          }),
        }),
      );
    });

    it('Scenario 6: should reject an allocation greater than available advance balance', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        studentId: 'student-1',
        totalAmount: new Prisma.Decimal(5000),
        balanceAmount: new Prisma.Decimal(5000),
        status: InvoiceStatus.UNPAID,
      });

      // Student has only ₹500 advance available
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          amount: new Prisma.Decimal(500),
          allocations: [],
        },
      ]);

      await expect(
        studentsService.allocateAdvance(
          'student-1',
          { invoiceId: 'inv-1', amount: 1000 },
          'admin-user-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 7: should reject an allocation greater than remaining invoice balance', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        studentId: 'student-1',
        totalAmount: new Prisma.Decimal(1000),
        balanceAmount: new Prisma.Decimal(300), // only 300 remaining
        status: InvoiceStatus.PARTIAL,
      });

      // Student has ₹2,000 advance available
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          amount: new Prisma.Decimal(2000),
          allocations: [],
        },
      ]);

      await expect(
        studentsService.allocateAdvance(
          'student-1',
          { invoiceId: 'inv-1', amount: 500 },
          'admin-user-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 8: should NOT create a duplicate payment receipt during advance allocation', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-2026-0001',
        studentId: 'student-1',
        totalAmount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(0),
        balanceAmount: new Prisma.Decimal(1000),
        status: InvoiceStatus.UNPAID,
      });
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          amount: new Prisma.Decimal(1000),
          allocations: [],
        },
      ]);
      mockPrisma.studentAdvanceAllocation.create.mockResolvedValue({ id: 'alloc-1' });
      mockPrisma.feeInvoice.update.mockResolvedValue({
        id: 'inv-1',
        totalAmount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(1000),
        balanceAmount: new Prisma.Decimal(0),
        status: InvoiceStatus.PAID,
      });

      // Attach payment spy if mock had it
      const paymentCreateSpy = jest.fn();
      mockPrisma.payment = { create: paymentCreateSpy };

      await studentsService.allocateAdvance(
        'student-1',
        { invoiceId: 'inv-1', amount: 1000 },
        'admin-user-id',
      );

      // Verify no payment was created
      expect(paymentCreateSpy).not.toHaveBeenCalled();
    });

    it('Scenario 9: should acquire row-level lock on student to prevent concurrent double-spending', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        studentId: 'student-1',
        balanceAmount: new Prisma.Decimal(1000),
        status: InvoiceStatus.UNPAID,
      });
      mockPrisma.studentAdvance.findMany.mockResolvedValue([
        {
          id: 'adv-1',
          amount: new Prisma.Decimal(1000),
          allocations: [],
        },
      ]);
      mockPrisma.studentAdvanceAllocation.create.mockResolvedValue({ id: 'alloc-1' });
      mockPrisma.feeInvoice.update.mockResolvedValue({
        id: 'inv-1',
        totalAmount: new Prisma.Decimal(1000),
        paidAmount: new Prisma.Decimal(1000),
        balanceAmount: new Prisma.Decimal(0),
        status: InvoiceStatus.PAID,
      });

      await studentsService.allocateAdvance(
        'student-1',
        { invoiceId: 'inv-1', amount: 500 },
        'admin-user-id',
      );

      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT id FROM students WHERE id = $1 FOR UPDATE',
        'student-1',
      );
    });

    it('Scenario 10: should reject invalid negative or zero advance amount', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });

      await expect(
        studentsService.recordAdvance(
          'student-1',
          { amount: -100, paymentDate: '2026-10-24', paymentMethod: PaymentMethod.CASH },
          'admin-user-id',
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        studentsService.recordAdvance(
          'student-1',
          { amount: 0, paymentDate: '2026-10-24', paymentMethod: PaymentMethod.CASH },
          'admin-user-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('Scenario 11: should handle idempotent duplicate retry within 5 seconds without duplicate entries', async () => {
      mockPrisma.student.findUnique.mockResolvedValue({ id: 'student-1' });
      const recentAdvance = {
        id: 'adv-recent',
        receiptNumber: 'ADV-2026-00001',
        amount: new Prisma.Decimal(500),
      };
      mockPrisma.studentAdvance.findFirst.mockResolvedValue(recentAdvance);
      mockPrisma.studentAdvance.findMany.mockResolvedValue([recentAdvance]);

      const res = await studentsService.recordAdvance(
        'student-1',
        { amount: 500, paymentDate: '2026-10-24', paymentMethod: PaymentMethod.CASH },
        'admin-user-id',
      );

      expect(res.isDuplicateRetry).toBe(true);
      expect(res.receiptNumber).toBe('ADV-2026-00001');
      expect(mockPrisma.studentAdvance.create).not.toHaveBeenCalled();
    });
  });
});
