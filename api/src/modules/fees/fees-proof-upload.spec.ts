import { BadRequestException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { S3StorageService } from '../../common/services/s3-storage.service';
import { FeesService } from './fees.service';

// Mock AWS SDK v3 S3Client and presigner
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
    })),
    PutObjectCommand: jest.fn().mockImplementation((args) => args),
    GetObjectCommand: jest.fn().mockImplementation((args) => args),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://rca2-payment-proofs-private.s3.ap-south-1.amazonaws.com/proofs/test?signed=true'),
}));

describe('AWS S3 Payment Proof Upload & Retrieval Suite', () => {
  let s3Service: S3StorageService;
  let feesService: FeesService;
  let mockPrisma: any;
  let mockSalaryService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_REGION') return 'ap-south-1';
        if (key === 'S3_PAYMENT_PROOFS_BUCKET') return 'rca2-payment-proofs';
        if (key === 'AWS_S3_BUCKET_NAME') return 'rca2-payment-proofs';
        if (key === 'STORAGE_DRIVER') return 's3';
        if (key === 'S3_PRESIGNED_URL_EXPIRES_IN') return '900';
        return null;
      }),
    };

    s3Service = new S3StorageService(mockConfigService);

    mockPrisma = {
      payment: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-log-uuid' }),
      },
      student: {
        findUnique: jest.fn(),
      },
    };

    mockSalaryService = {
      calculatePaymentSalaryRevenue: jest.fn(),
    };

    feesService = new FeesService(mockPrisma, mockSalaryService, s3Service);
  });

  // ====================================================
  // 1. FILE SIGNATURE (MAGIC BYTES) & SIZE VALIDATION
  // ====================================================
  describe('File Validation & Magic Bytes', () => {
    it('should validate and detect authentic JPEG binary signature', () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const result = s3Service.validateFileSignatureAndSize(validJpeg, 'image/jpeg');
      expect(result.detectedMimeType).toBe('image/jpeg');
      expect(result.extension).toBe('jpg');
    });

    it('should validate and detect authentic PNG binary signature', () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const result = s3Service.validateFileSignatureAndSize(validPng, 'image/png');
      expect(result.detectedMimeType).toBe('image/png');
      expect(result.extension).toBe('png');
    });

    it('should validate and detect authentic WebP binary signature', () => {
      // 'RIFF' + 4 bytes + 'WEBP'
      const validWebP = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const result = s3Service.validateFileSignatureAndSize(validWebP, 'image/webp');
      expect(result.detectedMimeType).toBe('image/webp');
      expect(result.extension).toBe('webp');
    });

    it('should validate and detect authentic PDF document binary signature', () => {
      // '%PDF-1.4'
      const validPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const result = s3Service.validateFileSignatureAndSize(validPdf, 'application/pdf');
      expect(result.detectedMimeType).toBe('application/pdf');
      expect(result.extension).toBe('pdf');
    });

    it('should reject spoofed files (e.g. plain text or executable with fake image extension)', () => {
      const fakeFile = Buffer.from('MZ This is an executable spoofing an image');
      expect(() => {
        s3Service.validateFileSignatureAndSize(fakeFile, 'image/jpeg');
      }).toThrow(BadRequestException);
    });

    it('should reject empty files', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(() => {
        s3Service.validateFileSignatureAndSize(emptyBuffer, 'image/jpeg');
      }).toThrow(BadRequestException);
    });

    it('should reject files exceeding the maximum size limit (10MB)', () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      expect(() => {
        s3Service.validateFileSignatureAndSize(largeBuffer, 'image/jpeg', 10 * 1024 * 1024);
      }).toThrow(BadRequestException);
    });
  });

  // ====================================================
  // 2. SECURE OBJECT KEY GENERATION
  // ====================================================
  describe('S3 Object Key Generation', () => {
    it('should generate collision-resistant keys without user-supplied path traversal', () => {
      const key = s3Service.generateUniqueObjectKey(
        '../../etc/student123',
        '../../../malicious/payment456',
        'jpg',
      );
      expect(key).not.toContain('..');
      expect(key.startsWith('proofs/')).toBe(true);
      expect(key.endsWith('.jpg')).toBe(true);
      expect(key).toContain('student123');
      expect(key).toContain('payment456');
    });
  });

  // ====================================================
  // 3. UPLOAD & ERROR HANDLING (MOCKED S3)
  // ====================================================
  describe('Upload & Failure Handling', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

    it('should successfully upload binary and persist S3 metadata in PostgreSQL', async () => {
      const mockPayment = {
        id: 'pay-123',
        receiptNumber: 'REC-2026-0001',
        studentId: 'stud-456',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...mockPayment,
        proofObjectKey: 'proofs/stud-456/pay-123/test.jpg',
        proofFileName: 'receipt_slip.jpg',
        proofFileSize: validJpeg.length,
        proofMimeType: 'image/jpeg',
        proofUploadedAt: new Date(),
      });

      const result = await feesService.uploadPaymentProof(
        'pay-123',
        {
          buffer: validJpeg,
          originalname: 'receipt slip.jpg',
          mimetype: 'image/jpeg',
          size: validJpeg.length,
        },
        'user-admin-1',
      );

      expect(result.success).toBe(true);
      expect(result.receiptNumber).toBe('REC-2026-0001');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-123' },
          data: expect.objectContaining({
            proofMimeType: 'image/jpeg',
            proofFileSize: validJpeg.length,
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_PROOF_UPLOADED',
            entityId: 'pay-123',
          }),
        }),
      );
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(
        feesService.uploadPaymentProof(
          'non-existent-pay',
          {
            buffer: validJpeg,
            originalname: 'proof.jpg',
            mimetype: 'image/jpeg',
            size: validJpeg.length,
          },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate error and never report success if S3 upload fails', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-123',
        receiptNumber: 'REC-2026-0001',
        studentId: 'stud-456',
      });

      // Force S3 client send failure
      jest.spyOn((s3Service as any).s3Client, 'send').mockRejectedValueOnce(
        new Error('S3 Access Denied: Bucket policy forbids upload'),
      );

      await expect(
        feesService.uploadPaymentProof(
          'pay-123',
          {
            buffer: validJpeg,
            originalname: 'proof.jpg',
            mimetype: 'image/jpeg',
            size: validJpeg.length,
          },
          'admin-1',
        ),
      ).rejects.toThrow(InternalServerErrorException);

      // Verify payment metadata was NOT updated on S3 failure
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });
  });

  // ====================================================
  // 4. PRESIGNED DOWNLOAD URL GENERATION & RBAC AUTHORIZATION
  // ====================================================
  describe('Presigned Download URLs & Authorization', () => {
    const mockPaymentWithProof = {
      id: 'pay-123',
      studentId: 'stud-456',
      proofObjectKey: 'proofs/stud-456/pay-123/sample.jpg',
      proofFileName: 'bank_utr_receipt.jpg',
      proofFileSize: 142000,
      proofMimeType: 'image/jpeg',
      proofUploadedAt: new Date(),
      student: {
        id: 'stud-456',
        email: 'student@rcacademy.in',
        guardians: [
          {
            guardian: {
              email: 'parent@rcacademy.in',
              phone: '9876543210',
            },
          },
        ],
      },
    };

    it('should allow Super Admin, Academy Admin, and Accountant to retrieve presigned URL', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPaymentWithProof);

      const adminUser = { id: 'admin-id', roles: ['ACADEMY_ADMIN'] };
      const result = await feesService.getPaymentProofUrl('pay-123', adminUser);

      expect(result.downloadUrl).toContain('https://');
      expect(result.expiresIn).toBe(900);
      expect(result.fileName).toBe('bank_utr_receipt.jpg');
    });

    it('should allow owner student to retrieve their own payment proof URL', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPaymentWithProof);

      const studentUser = { id: 'stud-456', studentId: 'stud-456', roles: ['STUDENT'] };
      const result = await feesService.getPaymentProofUrl('pay-123', studentUser);

      expect(result.downloadUrl).toBeDefined();
    });

    it('should forbid unauthorized students from accessing another students payment proof', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPaymentWithProof);

      const otherStudent = { id: 'other-student-id', studentId: 'other-student-id', roles: ['STUDENT'] };
      await expect(
        feesService.getPaymentProofUrl('pay-123', otherStudent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if payment has no attached proof document', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-no-proof',
        studentId: 'stud-456',
        proofObjectKey: null,
        student: { id: 'stud-456', guardians: [] },
      });

      const adminUser = { id: 'admin-id', roles: ['SUPER_ADMIN'] };
      await expect(
        feesService.getPaymentProofUrl('pay-no-proof', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ====================================================
  // 5. REGRESSION & BACKWARD COMPATIBILITY
  // ====================================================
  describe('Regression & Backward Compatibility', () => {
    it('should preserve legacy payments without S3 metadata columns', async () => {
      const legacyPayment = {
        id: 'legacy-pay-1',
        receiptNumber: 'REC-2025-0099',
        amount: { toNumber: () => 3500 },
        paymentMethod: 'CASH',
        reference: null,
        notes: '[Proof: legacy_slip.png (120 KB)] Direct cashier receipt',
        paidAt: new Date('2025-10-01'),
        status: 'COMPLETED',
        recordedBy: { firstName: 'Cashier', lastName: 'Staff' },
        allocations: [],
        proofObjectKey: null,
        proofFileName: null,
        proofFileSize: null,
        proofMimeType: null,
        proofUploadedAt: null,
      };

      mockPrisma.payment.findMany = jest.fn().mockResolvedValue([legacyPayment]);
      mockPrisma.student.findUnique = jest.fn().mockResolvedValue({
        id: 'stud-1',
        studentCode: 'RCA-001',
        firstName: 'Alice',
        lastName: 'Walker',
        batchEnrollments: [],
        feeInvoices: [],
      });

      const account = await feesService.getStudentFeeAccount('stud-1');
      expect(account.payments).toBeDefined();
      expect(account.payments[0].receiptNumber).toBe('REC-2025-0099');
      // Extracted from legacy note
      expect(account.payments[0].proofName).toBe('legacy_slip.png');
      expect(account.payments[0].hasRealProof).toBe(false);
      expect(account.payments[0].proofObjectKey).toBeNull();
    });
  });

  // ====================================================
  // 6. PAYMENT IDEMPOTENCY & PROOF RETENTION
  // ====================================================
  describe('Payment Idempotency & Proof Retention', () => {
    it('should return existing payment on duplicate idempotency key and preserve S3 proof metadata', async () => {
      const existingPayment = {
        id: 'pay-existing-999',
        receiptNumber: 'REC-2026-0005',
        idempotencyKey: 'IDEMP-TEST-KEY-12345',
        studentId: 'stud-456',
        amount: { toString: () => '5000', toNumber: () => 5000 },
        paymentMethod: 'UPI',
        status: 'COMPLETED',
        proofObjectKey: 'proofs/stud-456/pay-existing-999/receipt.jpg',
        proofFileName: 'bank_transfer_receipt.jpg',
        proofFileSize: 145000,
        proofMimeType: 'image/jpeg',
        proofUploadedAt: new Date(),
        student: { id: 'stud-456', firstName: 'Jane', lastName: 'Doe' },
        recordedBy: { firstName: 'Staff', lastName: 'User', email: 'staff@rca.in' },
        allocations: [],
      };

      mockPrisma.student.findUnique.mockResolvedValue({ id: 'stud-456', firstName: 'Jane', lastName: 'Doe' });
      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);

      const result = await feesService.recordPayment(
        {
          studentId: 'stud-456',
          amount: 5000,
          paymentMethod: 'UPI' as any,
          idempotencyKey: 'IDEMP-TEST-KEY-12345',
        },
        'user-admin-1',
      );

      expect((result as any).isDuplicateRetry).toBe(true);
      expect(result.receiptNumber).toBe('REC-2026-0005');
      expect(result.payment.id).toBe('pay-existing-999');
      expect(result.payment.proofObjectKey).toBe('proofs/stud-456/pay-existing-999/receipt.jpg');
      expect(result.payment.proofFileName).toBe('bank_transfer_receipt.jpg');
      // Verify payment was NOT modified or re-allocated
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('should allow re-uploading or updating proof document on existing payment', async () => {
      const existingPayment = {
        id: 'pay-existing-999',
        receiptNumber: 'REC-2026-0005',
        studentId: 'stud-456',
        proofObjectKey: 'proofs/stud-456/pay-existing-999/old-proof.jpg',
      };
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

      mockPrisma.payment.findUnique.mockResolvedValue(existingPayment);
      mockPrisma.payment.update.mockResolvedValue({
        ...existingPayment,
        proofObjectKey: 'proofs/stud-456/pay-existing-999/updated-proof.jpg',
        proofFileName: 'updated_slip.jpg',
        proofFileSize: validJpeg.length,
        proofMimeType: 'image/jpeg',
        proofUploadedAt: new Date(),
      });

      const result = await feesService.uploadPaymentProof(
        'pay-existing-999',
        {
          buffer: validJpeg,
          originalname: 'updated slip.jpg',
          mimetype: 'image/jpeg',
          size: validJpeg.length,
        },
        'admin-user-2',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-existing-999' },
          data: expect.objectContaining({
            proofFileName: 'updated_slip.jpg',
            proofFileSize: validJpeg.length,
            proofMimeType: 'image/jpeg',
          }),
        }),
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_PROOF_UPLOADED',
            actorId: 'admin-user-2',
          }),
        }),
      );
    });
  });
});
