import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export interface UploadProofParams {
  buffer: Buffer;
  originalFileName: string;
  declaredMimeType: string;
  sizeBytes: number;
  paymentId: string;
  studentId: string;
  actorId: string;
}

export interface UploadProofResult {
  objectKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageDriver: 's3' | 'local';
}

@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly storageDriver: string;
  private readonly localRoot: string;
  private readonly presignedExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'ap-south-1';
    this.bucketName =
      this.configService.get<string>('S3_PAYMENT_PROOFS_BUCKET') ||
      this.configService.get<string>('AWS_S3_BUCKET_NAME') ||
      this.configService.get<string>('S3_BUCKET_NAME') ||
      'rca2-payment-proofs';
    this.storageDriver = this.configService.get<string>('STORAGE_DRIVER') || 's3';
    this.localRoot = this.configService.get<string>('STORAGE_LOCAL_ROOT') || './storage/uploads';
    this.presignedExpirySeconds =
      parseInt(this.configService.get<string>('S3_PRESIGNED_URL_EXPIRES_IN') || '900', 10);

    // Initialize S3Client with the default credential provider chain:
    // Resolves from EC2 IAM Instance Profile / ECS task role / default AWS provider chain.
    // Absolutely NO hardcoded credentials.
    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  /**
   * Validates file size and detects true MIME type via magic bytes
   */
  validateFileSignatureAndSize(buffer: Buffer, declaredMimeType: string, maxSizeBytes = 10 * 1024 * 1024): {
    detectedMimeType: string;
    extension: string;
  } {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (buffer.length > maxSizeBytes) {
      throw new BadRequestException(`File size exceeds maximum allowed limit of ${maxSizeBytes / (1024 * 1024)} MB`);
    }

    // Inspect real magic bytes
    let detectedMimeType: string | null = null;
    let extension = 'bin';

    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      detectedMimeType = 'image/jpeg';
      extension = 'jpg';
    } else if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      detectedMimeType = 'image/png';
      extension = 'png';
    } else if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 && // 'RIFF'
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50 // 'WEBP'
    ) {
      detectedMimeType = 'image/webp';
      extension = 'webp';
    } else if (
      buffer.length >= 4 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 // '%PDF'
    ) {
      detectedMimeType = 'application/pdf';
      extension = 'pdf';
    }

    if (!detectedMimeType) {
      throw new BadRequestException(
        'Invalid file type. File binary signature does not match supported image (JPEG, PNG, WebP) or PDF formats.',
      );
    }

    return { detectedMimeType, extension };
  }

  /**
   * Generates a collision-resistant unique S3 object key.
   * NEVER incorporates raw user-supplied filenames into the key to avoid directory traversal.
   */
  generateUniqueObjectKey(studentId: string, paymentId: string, extension: string): string {
    const timestamp = Date.now();
    const randomUuid = crypto.randomUUID();
    const safeStudentId = studentId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePaymentId = paymentId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `proofs/${safeStudentId}/${safePaymentId}/${timestamp}-${randomUuid}.${extension}`;
  }

  /**
   * Uploads real binary file to private AWS S3 bucket.
   * If in local development with STORAGE_DRIVER=local and AWS is not configured, saves safely to local storage root.
   */
  async uploadPaymentProof(params: UploadProofParams): Promise<UploadProofResult> {
    const { detectedMimeType, extension } = this.validateFileSignatureAndSize(
      params.buffer,
      params.declaredMimeType,
    );

    const objectKey = this.generateUniqueObjectKey(params.studentId, params.paymentId, extension);
    const sanitizedFileName = path.basename(params.originalFileName).replace(/[^a-zA-Z0-9._-]/g, '_');

    // S3 Storage (Default & Production Driver)
    if (this.storageDriver === 's3') {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          Body: params.buffer,
          ContentType: detectedMimeType,
          Metadata: {
            studentid: params.studentId,
            paymentid: params.paymentId,
            actorid: params.actorId,
            originalfilename: encodeURIComponent(sanitizedFileName),
          },
          // Keep bucket private - NO public ACL
          ServerSideEncryption: 'AES256',
        });

        await this.s3Client.send(command);
        this.logger.log(`Uploaded payment proof to private S3: s3://${this.bucketName}/${objectKey}`);

        return {
          objectKey,
          fileName: sanitizedFileName,
          fileSize: params.buffer.length,
          mimeType: detectedMimeType,
          storageDriver: 's3',
        };
      } catch (err: any) {
        this.logger.error(`Failed to upload proof to S3 (${this.bucketName}): ${err.message}`, err.stack);
        throw new InternalServerErrorException(
          `Failed to upload payment proof to secure storage: ${err.message || 'S3 upload error'}`,
        );
      }
    }

    // Local Driver Fallback (when STORAGE_DRIVER=local)
    try {
      const targetDir = path.join(this.localRoot, path.dirname(objectKey));
      fs.mkdirSync(targetDir, { recursive: true });
      const targetFilePath = path.join(this.localRoot, objectKey);
      fs.writeFileSync(targetFilePath, params.buffer);
      this.logger.log(`Saved payment proof locally: ${targetFilePath}`);

      return {
        objectKey,
        fileName: sanitizedFileName,
        fileSize: params.buffer.length,
        mimeType: detectedMimeType,
        storageDriver: 'local',
      };
    } catch (err: any) {
      this.logger.error(`Failed to save proof locally: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Failed to persist file: ${err.message}`);
    }
  }

  /**
   * Generates a short-lived presigned download URL for an authorized user.
   */
  async getPresignedDownloadUrl(objectKey: string, fileName?: string): Promise<{ downloadUrl: string; expiresIn: number }> {
    if (!objectKey) {
      throw new BadRequestException('Object key is required');
    }

    if (this.storageDriver === 's3') {
      try {
        const downloadName = fileName || path.basename(objectKey);
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: objectKey,
          ResponseContentDisposition: `inline; filename="${encodeURIComponent(downloadName)}"`,
        });

        const downloadUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: this.presignedExpirySeconds,
        });

        return {
          downloadUrl,
          expiresIn: this.presignedExpirySeconds,
        };
      } catch (err: any) {
        this.logger.error(`Failed to generate presigned download URL: ${err.message}`, err.stack);
        throw new InternalServerErrorException('Could not generate download URL for payment proof');
      }
    }

    // Local Driver Fallback URL
    return {
      downloadUrl: `/api/v1/fees/proofs/local-file?key=${encodeURIComponent(objectKey)}`,
      expiresIn: this.presignedExpirySeconds,
    };
  }

  /**
   * Helper to retrieve local file buffer if local driver is active
   */
  getLocalFileBuffer(objectKey: string): { buffer: Buffer; mimeType: string } {
    const safeKey = path.normalize(objectKey).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(this.localRoot, safeKey);
    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('File not found in local storage');
    }
    const buffer = fs.readFileSync(fullPath);
    const { detectedMimeType } = this.validateFileSignatureAndSize(buffer, 'application/octet-stream');
    return { buffer, mimeType: detectedMimeType };
  }
}
