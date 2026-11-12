import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { S3StorageService } from '../../common/services/s3-storage.service';
import { CreateExpenseDto, UpdateExpenseDto, QueryExpenseDto } from './dto/expense.dto';
import { ExpenseStatus, ExpenseCategory, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3StorageService: S3StorageService,
  ) {}

  getS3StorageService(): S3StorageService {
    return this.s3StorageService;
  }

  /**
   * Create an expense entry. Admins submit expenses with optional proof receipt.
   * By default, expenses start in PENDING status until approved by Super Admin.
   */
  async createExpense(
    dto: CreateExpenseDto,
    file?: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor?: any,
  ) {
    if (!actor?.id) {
      throw new BadRequestException('Actor context is required to create expense');
    }

    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();

    const created = await this.prisma.expense.create({
      data: {
        title: dto.title.trim(),
        category: dto.category || ExpenseCategory.OTHER,
        amount: new Decimal(dto.amount),
        expenseDate,
        paymentMethod: dto.paymentMethod || 'CASH',
        referenceNumber: dto.referenceNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        proofUrl: dto.proofUrl?.trim() || null,
        status: ExpenseStatus.PENDING,
        createdById: actor.id,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
      },
    });

    // If binary proof file was uploaded in the same request, upload and attach it
    if (file && file.buffer) {
      try {
        const uploadResult = await this.s3StorageService.uploadExpenseProof({
          buffer: file.buffer,
          originalFileName: file.originalname,
          declaredMimeType: file.mimetype,
          sizeBytes: file.size,
          expenseId: created.id,
          actorId: actor.id,
        });

        const updated = await this.prisma.expense.update({
          where: { id: created.id },
          data: {
            proofObjectKey: uploadResult.objectKey,
            proofFileName: uploadResult.fileName,
            proofFileSize: uploadResult.fileSize,
            proofMimeType: uploadResult.mimeType,
            proofUploadedAt: new Date(),
          },
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true, email: true, designation: true },
            },
          },
        });

        return updated;
      } catch (err: any) {
        this.logger.error(`Expense proof upload failed: ${err.message}`, err.stack);
        // Still return the created expense record even if proof upload failed
      }
    }

    return created;
  }

  /**
   * Retrieve list of expenses with filters, pagination, and KPI summary stats.
   */
  async findAll(query: QueryExpenseDto, user?: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.category) {
      where.category = query.category;
    }

    // Month filter: YYYY-MM
    if (query.month) {
      const [yearStr, monthStr] = query.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      if (!isNaN(year) && !isNaN(month)) {
        const start = new Date(year, month, 1, 0, 0, 0, 0);
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        where.expenseDate = { gte: start, lte: end };
      }
    } else if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.expenseDate.lte = new Date(query.endDate);
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { referenceNumber: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true, designation: true },
          },
          approvedBy: {
            select: { id: true, firstName: true, lastName: true, email: true, designation: true },
          },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);

    // Compute KPI stats across all expenses (or current month if filtered)
    const statsWhere: Prisma.ExpenseWhereInput = query.month
      ? { expenseDate: where.expenseDate }
      : {};

    const allStats = await this.prisma.expense.findMany({
      where: statsWhere,
      select: {
        status: true,
        amount: true,
      },
    });

    let totalAmount = new Decimal(0);
    let approvedAmount = new Decimal(0);
    let pendingAmount = new Decimal(0);
    let rejectedAmount = new Decimal(0);

    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    for (const s of allStats) {
      totalAmount = totalAmount.add(s.amount);
      if (s.status === ExpenseStatus.APPROVED) {
        approvedAmount = approvedAmount.add(s.amount);
        approvedCount++;
      } else if (s.status === ExpenseStatus.PENDING) {
        pendingAmount = pendingAmount.add(s.amount);
        pendingCount++;
      } else if (s.status === ExpenseStatus.REJECTED) {
        rejectedAmount = rejectedAmount.add(s.amount);
        rejectedCount++;
      }
    }

    return {
      items,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      summary: {
        totalAmount: totalAmount.toNumber(),
        totalCount: allStats.length,
        approvedAmount: approvedAmount.toNumber(),
        approvedCount,
        pendingAmount: pendingAmount.toNumber(),
        pendingCount,
        rejectedAmount: rejectedAmount.toNumber(),
        rejectedCount,
      },
    };
  }

  /**
   * Find single expense record.
   */
  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  /**
   * Update expense details. Only pending expenses can be edited by admins.
   */
  async updateExpense(id: string, dto: UpdateExpenseDto, user: any) {
    const existing = await this.findOne(id);

    const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');
    if (!isSuperAdmin && existing.status !== ExpenseStatus.PENDING) {
      throw new ForbiddenException('Only pending expenses can be edited');
    }

    const data: Prisma.ExpenseUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = new Decimal(dto.amount);
    if (dto.expenseDate !== undefined) data.expenseDate = new Date(dto.expenseDate);
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.referenceNumber !== undefined) data.referenceNumber = dto.referenceNumber?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.proofUrl !== undefined) data.proofUrl = dto.proofUrl?.trim() || null;

    return this.prisma.expense.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
      },
    });
  }

  /**
   * Super Admin approves an expense.
   * Only approved expenses flow into Executive Finance Analytics!
   */
  async approveExpense(id: string, superAdminUser: any) {
    const existing = await this.findOne(id);

    if (existing.status === ExpenseStatus.APPROVED) {
      return existing;
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.APPROVED,
        approvedById: superAdminUser.id,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
      },
    });
  }

  /**
   * Super Admin rejects an expense with an optional or required reason.
   */
  async rejectExpense(id: string, reason: string, superAdminUser: any) {
    await this.findOne(id);

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.REJECTED,
        rejectionReason: reason?.trim() || 'Expense rejected by Super Admin',
        approvedById: superAdminUser.id,
        approvedAt: new Date(),
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
      },
    });
  }

  /**
   * Upload or replace proof document for an expense.
   */
  async uploadProof(
    id: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    actor: any,
  ) {
    const existing = await this.findOne(id);

    const uploadResult = await this.s3StorageService.uploadExpenseProof({
      buffer: file.buffer,
      originalFileName: file.originalname,
      declaredMimeType: file.mimetype,
      sizeBytes: file.size,
      expenseId: existing.id,
      actorId: actor.id,
    });

    return this.prisma.expense.update({
      where: { id: existing.id },
      data: {
        proofObjectKey: uploadResult.objectKey,
        proofFileName: uploadResult.fileName,
        proofFileSize: uploadResult.fileSize,
        proofMimeType: uploadResult.mimeType,
        proofUploadedAt: new Date(),
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, designation: true },
        },
      },
    });
  }

  /**
   * Generates view/download URL for the expense proof attachment.
   */
  async getProofUrl(id: string, user: any) {
    const expense = await this.findOne(id);

    if (expense.proofUrl && !expense.proofObjectKey) {
      return {
        downloadUrl: expense.proofUrl,
        fileName: expense.proofFileName || 'receipt',
        mimeType: expense.proofMimeType || 'application/octet-stream',
      };
    }

    if (!expense.proofObjectKey) {
      throw new NotFoundException('No proof document attached to this expense');
    }

    const presigned = await this.s3StorageService.getPresignedDownloadUrl(
      expense.proofObjectKey,
      expense.proofFileName || `expense-${expense.id}`,
      '/api/v1/expenses/proofs/local-file',
    );

    return {
      downloadUrl: presigned.downloadUrl,
      fileName: expense.proofFileName || 'receipt',
      mimeType: expense.proofMimeType || 'application/octet-stream',
      fileSize: expense.proofFileSize,
      uploadedAt: expense.proofUploadedAt,
    };
  }

  /**
   * Delete expense entry.
   */
  async deleteExpense(id: string, user: any) {
    const existing = await this.findOne(id);
    const isSuperAdmin = user?.roles?.includes('SUPER_ADMIN');

    if (!isSuperAdmin) {
      if (existing.createdById !== user.id || existing.status !== ExpenseStatus.PENDING) {
        throw new ForbiddenException('You can only delete your own pending expenses');
      }
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }
}

