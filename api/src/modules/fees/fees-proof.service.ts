import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { S3StorageService } from '../../common/services/s3-storage.service';

@Injectable()
export class FeesProofService {
  private readonly logger = new Logger(FeesProofService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  /**
   * Securely uploads proof binary to private S3 and persists object key & metadata in PostgreSQL
   */
  async uploadPaymentProof(
    paymentId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actorId: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Payment proof file is required');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { student: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // 1. Upload binary to private S3 using AWS SDK v3 & default credential provider chain
    const uploadResult = await this.s3StorageService.uploadPaymentProof({
      buffer: file.buffer,
      originalFileName: file.originalname,
      declaredMimeType: file.mimetype,
      sizeBytes: file.size,
      paymentId: payment.id,
      studentId: payment.studentId,
      actorId,
    });

    // 2. Persist S3 object key and metadata into PostgreSQL
    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        proofObjectKey: uploadResult.objectKey,
        proofFileName: uploadResult.fileName,
        proofFileSize: uploadResult.fileSize,
        proofMimeType: uploadResult.mimeType,
        proofUploadedAt: new Date(),
      },
    });

    // 3. Write immutable audit log
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'PAYMENT_PROOF_UPLOADED',
        entityType: 'Payment',
        entityId: payment.id,
        details: {
          receiptNumber: payment.receiptNumber,
          studentId: payment.studentId,
          objectKey: uploadResult.objectKey,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          mimeType: uploadResult.mimeType,
          storageDriver: uploadResult.storageDriver,
        },
      },
    });

    this.logger.log(
      `Payment proof successfully attached to payment ${payment.receiptNumber} (Key: ${uploadResult.objectKey})`,
    );

    return {
      success: true,
      paymentId: updatedPayment.id,
      receiptNumber: updatedPayment.receiptNumber,
      proofObjectKey: updatedPayment.proofObjectKey,
      proofFileName: updatedPayment.proofFileName,
      proofFileSize: updatedPayment.proofFileSize,
      proofMimeType: updatedPayment.proofMimeType,
      proofUploadedAt: updatedPayment.proofUploadedAt,
    };
  }

  /**
   * Generates a short-lived presigned download URL after verifying user authorization
   */
  async getPaymentProofUrl(paymentId: string, user: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            guardians: {
              include: {
                guardian: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    // Role-based access validation
    const userRoles: string[] = Array.isArray(user?.roles)
      ? user.roles
      : [user?.role].filter(Boolean);
    const isStaffOrAdmin = userRoles.some((r) =>
      ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'ACCOUNTANT', 'TEACHER', 'STAFF'].includes(r),
    );

    if (!isStaffOrAdmin) {
      const isOwnerStudent =
        user?.studentId === payment.studentId ||
        user?.id === payment.studentId ||
        (user?.email && user.email === payment.student.email);
      const isGuardian = payment.student.guardians.some(
        (g) =>
          (user?.email && g.guardian.email === user.email) ||
          (user?.phone && g.guardian.phone === user.phone),
      );
      if (!isOwnerStudent && !isGuardian) {
        throw new ForbiddenException(
          'You do not have authorization to access this payment proof document',
        );
      }
    }

    if (!payment.proofObjectKey) {
      throw new NotFoundException('No proof document attached to this payment record');
    }

    const { downloadUrl, expiresIn } = await this.s3StorageService.getPresignedDownloadUrl(
      payment.proofObjectKey,
      payment.proofFileName || undefined,
    );

    return {
      downloadUrl,
      expiresIn,
      fileName: payment.proofFileName,
      fileSize: payment.proofFileSize,
      mimeType: payment.proofMimeType,
      uploadedAt: payment.proofUploadedAt,
    };
  }

  getS3StorageService(): S3StorageService {
    return this.s3StorageService;
  }
}

