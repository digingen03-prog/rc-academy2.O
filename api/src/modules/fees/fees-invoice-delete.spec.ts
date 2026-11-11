/// <reference types="jest" />
import { NotFoundException } from '@nestjs/common';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';
import { UserRoleType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

// Mock AWS SDK v3 S3Client and presigner
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
    })),
    PutObjectCommand: jest.fn().mockImplementation((args: any) => args),
    GetObjectCommand: jest.fn().mockImplementation((args: any) => args),
    DeleteObjectCommand: jest.fn().mockImplementation((args: any) => args),
  };
});

describe('Super Admin Invoice & Payment Proof Deletion Suite', () => {
  let feesService: FeesService;
  let mockPrisma: any;
  let mockSalaryService: any;
  let mockS3Service: any;

  beforeEach(() => {
    mockS3Service = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    mockSalaryService = {
      calculatePaymentSalaryRevenue: jest.fn(),
      reversePaymentSalaryRevenue: jest.fn(),
    };

    mockPrisma = {
      feeInvoice: {
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      payment: {
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      paymentAllocation: {
        deleteMany: jest.fn(),
      },
      feeAdjustment: {
        deleteMany: jest.fn(),
      },
      feeInvoiceLine: {
        deleteMany: jest.fn(),
      },
      staffSalaryLedger: {
        deleteMany: jest.fn(),
      },
      paymentRevenueException: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => {
        return cb(mockPrisma);
      }),
    };

    feesService = new FeesService(mockPrisma, mockSalaryService, mockS3Service);
  });

  describe('RBAC Guard & Roles Definition', () => {
    it('should enforce SUPER_ADMIN-only access on deleteInvoice controller method', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, FeesController.prototype.deleteInvoice);
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRoleType.SUPER_ADMIN]);
      expect(roles).not.toContain(UserRoleType.ACADEMY_ADMIN);
      expect(roles).not.toContain(UserRoleType.ACCOUNTANT);
    });

    it('should enforce SUPER_ADMIN-only access on clearAllInvoices controller method', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, FeesController.prototype.clearAllInvoices);
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRoleType.SUPER_ADMIN]);
      expect(roles).not.toContain(UserRoleType.ACADEMY_ADMIN);
      expect(roles).not.toContain(UserRoleType.ACCOUNTANT);
    });
  });

  describe('Invoice Deletion & Proof Clearing Logic', () => {
    it('should delete invoice and clear associated payment and proof file when paid by student', async () => {
      const invoiceId = 'inv-oct-2026';
      const proofKey = 'proofs/stud-1/pay-1/oct-receipt.jpg';

      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: invoiceId,
        invoiceNumber: 'INV-2026-OCT-001',
        totalAmount: new Decimal(5000),
        paidAmount: new Decimal(5000),
        balanceAmount: new Decimal(0),
        allocations: [
          {
            id: 'alloc-1',
            invoiceId,
            paymentId: 'pay-1',
            allocatedAmount: new Decimal(5000),
            payment: {
              id: 'pay-1',
              receiptNumber: 'REC-OCT-001',
              amount: new Decimal(5000),
              proofObjectKey: proofKey,
              allocations: [
                { id: 'alloc-1', invoiceId },
              ],
            },
          },
        ],
      });

      const result = await feesService.deleteInvoiceById(invoiceId, 'super-admin-uuid');

      expect(result.success).toBe(true);
      expect(result.message).toContain('INV-2026-OCT-001 successfully deleted');

      // Check DB cascades executed
      expect(mockPrisma.staffSalaryLedger.deleteMany).toHaveBeenCalledWith({
        where: { paymentId: { in: ['pay-1'] } },
      });
      expect(mockPrisma.paymentRevenueException.deleteMany).toHaveBeenCalledWith({
        where: { paymentId: { in: ['pay-1'] } },
      });
      expect(mockPrisma.paymentAllocation.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId },
      });
      expect(mockPrisma.payment.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['pay-1'] } },
      });
      expect(mockPrisma.feeInvoice.delete).toHaveBeenCalledWith({
        where: { id: invoiceId },
      });

      // Crucial: check S3 storage proof file was deleted
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith(proofKey);
    });

    it('should delete unpaid invoice cleanly without calling s3 deleteFile', async () => {
      const invoiceId = 'inv-unpaid-1';

      mockPrisma.feeInvoice.findUnique.mockResolvedValue({
        id: invoiceId,
        invoiceNumber: 'INV-2026-NOV-002',
        totalAmount: new Decimal(5000),
        paidAmount: new Decimal(0),
        balanceAmount: new Decimal(5000),
        allocations: [],
      });

      const result = await feesService.deleteInvoiceById(invoiceId, 'super-admin-uuid');

      expect(result.success).toBe(true);
      expect(mockPrisma.feeInvoice.delete).toHaveBeenCalledWith({
        where: { id: invoiceId },
      });
      expect(mockS3Service.deleteFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      mockPrisma.feeInvoice.findUnique.mockResolvedValue(null);

      await expect(feesService.deleteInvoiceById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear all invoices, payments and proofs in clearAllInvoices', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        { proofObjectKey: 'proofs/s1/p1/file1.png' },
        { proofObjectKey: 'proofs/s2/p2/file2.pdf' },
      ]);
      mockPrisma.payment.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.feeAdjustment.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.feeInvoiceLine.deleteMany.mockResolvedValue({ count: 4 });
      mockPrisma.feeInvoice.deleteMany.mockResolvedValue({ count: 2 });

      const result = await feesService.clearAllInvoices('super-admin-uuid');

      expect(result.success).toBe(true);
      expect(mockPrisma.feeInvoice.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.payment.deleteMany).toHaveBeenCalled();
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('proofs/s1/p1/file1.png');
      expect(mockS3Service.deleteFile).toHaveBeenCalledWith('proofs/s2/p2/file2.pdf');
    });
  });
});

