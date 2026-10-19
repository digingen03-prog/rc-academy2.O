import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  RecordPaymentDto,
  CreateInvoiceDto,
  CreateFeePlanDto,
  ReversePaymentDto,
} from './dto/record-payment.dto';
import {
  CreateCourseFeeConfigDto,
  UpdateCourseFeeConfigDto,
  CreateCourseInvoiceDto,
  ApplyFeeAdjustmentDto,
} from './dto/course-fee.dto';
import { InvoiceStatus, PaymentStatus, FeeAdjustmentType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SalaryService } from '../salary/salary.service';

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly salaryService: SalaryService,
  ) {}

  // ==========================================
  // 1. COURSE FEE CONFIGURATION
  // ==========================================

  async getCourseFeeConfigs(query: {
    academicYearId?: string;
    classId?: string;
    subjectId?: string;
    batchId?: string;
    isActive?: boolean;
  }) {
    const where: any = {};
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (query.classId) where.classId = query.classId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.prisma.courseFeeConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        academicYear: true,
        class: true,
        subject: true,
        batch: true,
        _count: {
          select: { invoices: true },
        },
      },
    });
  }

  async getCourseFeeConfigById(id: string) {
    const config = await this.prisma.courseFeeConfig.findUnique({
      where: { id },
      include: {
        academicYear: true,
        class: true,
        subject: true,
        batch: true,
        invoices: {
          take: 20,
          include: {
            student: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(`Course fee configuration with ID ${id} not found`);
    }

    return config;
  }

  async createCourseFeeConfig(dto: CreateCourseFeeConfigDto, actorId?: string) {
    // Validate academic year and class
    const [academicYear, courseClass] = await Promise.all([
      this.prisma.academicYear.findUnique({ where: { id: dto.academicYearId } }),
      this.prisma.class.findUnique({ where: { id: dto.classId } }),
    ]);

    if (!academicYear) {
      throw new NotFoundException(`Academic year ${dto.academicYearId} not found`);
    }
    if (!courseClass) {
      throw new NotFoundException(`Course/Class ${dto.classId} not found`);
    }

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
      if (!subject) throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    }

    if (dto.batchId) {
      const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
      if (!batch) throw new NotFoundException(`Batch ${dto.batchId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const config = await tx.courseFeeConfig.create({
        data: {
          name: dto.name.trim(),
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          subjectId: dto.subjectId || null,
          batchId: dto.batchId || null,
          amount: new Decimal(dto.amount),
          billingPeriod: dto.billingPeriod || 'ANNUAL',
          installmentCount: dto.installmentCount || 1,
          installmentsSchedule: dto.installmentsSchedule ? (dto.installmentsSchedule as any) : null,
          allowedDiscounts: dto.allowedDiscounts ? (dto.allowedDiscounts as any) : null,
          effectiveStartDate: dto.effectiveStartDate ? new Date(dto.effectiveStartDate) : new Date(),
          effectiveEndDate: dto.effectiveEndDate ? new Date(dto.effectiveEndDate) : null,
          description: dto.description?.trim() || null,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
          createdById: actorId || null,
        },
        include: {
          academicYear: true,
          class: true,
          subject: true,
          batch: true,
        },
      });

      if (actorId) {
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'COURSE_FEE_CONFIG_CREATED',
            entityType: 'CourseFeeConfig',
            entityId: config.id,
            details: {
              name: config.name,
              amount: dto.amount,
              classId: dto.classId,
              billingPeriod: config.billingPeriod,
            },
          },
        });
      }

      return config;
    }).then(async (config) => {
      if (dto.replicateToStudents) {
        const replication = await this.replicateFeeConfigToStudents(config.id, actorId);
        return { ...config, replication };
      }
      return config;
    });
  }

  async updateCourseFeeConfig(id: string, dto: UpdateCourseFeeConfigDto, actorId?: string) {
    const existing = await this.prisma.courseFeeConfig.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Course fee configuration ${id} not found`);
    }

    if (dto.classId) {
      const classEntity = await this.prisma.class.findUnique({ where: { id: dto.classId } });
      if (!classEntity) throw new NotFoundException(`Class/Course ${dto.classId} not found`);
    }

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
      if (!subject) throw new NotFoundException(`Subject ${dto.subjectId} not found`);
    }

    if (dto.batchId) {
      const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
      if (!batch) throw new NotFoundException(`Batch ${dto.batchId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.courseFeeConfig.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.classId && { classId: dto.classId }),
          ...(dto.batchId !== undefined && { batchId: dto.batchId || null }),
          ...(dto.subjectId !== undefined && { subjectId: dto.subjectId || null }),
          ...(dto.academicYearId && dto.academicYearId !== 'any' && { academicYearId: dto.academicYearId }),
          ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
          ...(dto.billingPeriod && { billingPeriod: dto.billingPeriod }),
          ...(dto.installmentCount !== undefined && { installmentCount: dto.installmentCount }),
          ...(dto.installmentsSchedule !== undefined && { installmentsSchedule: dto.installmentsSchedule as any }),
          ...(dto.allowedDiscounts !== undefined && { allowedDiscounts: dto.allowedDiscounts as any }),
          ...(dto.effectiveStartDate && { effectiveStartDate: new Date(dto.effectiveStartDate) }),
          ...(dto.effectiveEndDate !== undefined && {
            effectiveEndDate: dto.effectiveEndDate ? new Date(dto.effectiveEndDate) : null,
          }),
          ...(dto.description !== undefined && { description: dto.description?.trim() }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: {
          academicYear: true,
          class: true,
          subject: true,
          batch: true,
        },
      });

      if (actorId) {
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'COURSE_FEE_CONFIG_UPDATED',
            entityType: 'CourseFeeConfig',
            entityId: id,
            details: { ...dto } as any,
          },
        });
      }

      return updated;
    }).then(async (updated) => {
      if (dto.replicateToStudents) {
        const replication = await this.replicateFeeConfigToStudents(updated.id, actorId);
        return { ...updated, replication };
      }
      return updated;
    });
  }

  async replicateFeeConfigToStudents(configId: string, actorId?: string) {
    const config = await this.prisma.courseFeeConfig.findUnique({
      where: { id: configId },
      include: { class: true, batch: true, subject: true },
    });

    if (!config) {
      throw new NotFoundException(`Course fee configuration ${configId} not found`);
    }

    const whereEnrollment: any = {
      isActive: true,
      batch: {
        classId: config.classId,
        ...(config.batchId ? { id: config.batchId } : {}),
      },
    };

    if (config.subjectId) {
      whereEnrollment.OR = [
        { subjectId: config.subjectId },
        { subjectId: null },
      ];
    }

    const eligibleEnrollments = await this.prisma.studentBatchEnrollment.findMany({
      where: whereEnrollment,
      include: {
        student: true,
        batch: {
          include: {
            class: true,
          },
        },
        subject: true,
      },
    });

    let created = 0;
    let skippedExisting = 0;

    for (const en of eligibleEnrollments) {
      const existing = await this.prisma.feeInvoice.findFirst({
        where: {
          enrollmentId: en.id,
          billingPeriod: config.billingPeriod,
          ...(config.subjectId ? { subjectId: config.subjectId } : { courseFeeConfigId: config.id }),
          status: { not: InvoiceStatus.CANCELLED },
        },
      });

      if (existing) {
        skippedExisting++;
        continue;
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const subjectName = config.subject?.name || en.subject?.name;
      const description = `${en.batch.class.name} - ${en.batch.name}${
        subjectName ? ` (${subjectName})` : ''
      } [${config.billingPeriod}]`;

      await this.createCourseInvoice(
        {
          studentId: en.studentId,
          enrollmentId: en.id,
          classId: en.batch.classId,
          batchId: en.batchId,
          subjectId: config.subjectId || en.subjectId || undefined,
          courseFeeConfigId: config.id,
          billingPeriod: config.billingPeriod,
          totalAmount: config.amount.toNumber(),
          dueDate: dueDate.toISOString().split('T')[0],
          description,
        },
        actorId,
      );

      created++;
    }

    return {
      totalEligible: eligibleEnrollments.length,
      created,
      skippedExisting,
      configId: config.id,
      configName: config.name,
    };
  }

  async resolveFeeForEnrollment(params: {
    classId: string;
    batchId?: string;
    subjectId?: string;
    academicYearId?: string;
  }) {
    const now = new Date();

    const baseWhere: any = {
      classId: params.classId,
      isActive: true,
      effectiveStartDate: { lte: now },
      OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: now } }],
    };

    if (params.academicYearId) {
      baseWhere.academicYearId = params.academicYearId;
    }

    // Level 1: Match class, batch, and subject
    if (params.batchId && params.subjectId) {
      const match1 = await this.prisma.courseFeeConfig.findFirst({
        where: { ...baseWhere, batchId: params.batchId, subjectId: params.subjectId },
        orderBy: { createdAt: 'desc' },
      });
      if (match1) return match1;
    }

    // Level 2: Match class and batch
    if (params.batchId) {
      const match2 = await this.prisma.courseFeeConfig.findFirst({
        where: { ...baseWhere, batchId: params.batchId, subjectId: null },
        orderBy: { createdAt: 'desc' },
      });
      if (match2) return match2;
    }

    // Level 3: Match class and subject
    if (params.subjectId) {
      const match3 = await this.prisma.courseFeeConfig.findFirst({
        where: { ...baseWhere, batchId: null, subjectId: params.subjectId },
        orderBy: { createdAt: 'desc' },
      });
      if (match3) return match3;
    }

    // Level 4: Standard default for class
    return this.prisma.courseFeeConfig.findFirst({
      where: { ...baseWhere, batchId: null, subjectId: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ==========================================
  // 2. COURSE INVOICES & MULTI-COURSE BILLING
  // ==========================================

  async createCourseInvoice(dto: CreateCourseInvoiceDto, actorId?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${dto.studentId} not found`);
    }

    // If enrollmentId is supplied, validate enrollment belongs to student
    let enrollment = null;
    if (dto.enrollmentId) {
      enrollment = await this.prisma.studentBatchEnrollment.findUnique({
        where: { id: dto.enrollmentId },
        include: {
          batch: {
            include: { class: true },
          },
          subject: true,
        },
      });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment ${dto.enrollmentId} not found`);
      }
      if (enrollment.studentId !== dto.studentId) {
        throw new BadRequestException(
          `Enrollment ${dto.enrollmentId} does not belong to student ${dto.studentId}`,
        );
      }

      // Check duplicate billing for this specific enrollment and billing period
      const billingPeriod = dto.billingPeriod || 'ANNUAL';
      const existing = await this.prisma.feeInvoice.findFirst({
        where: {
          enrollmentId: dto.enrollmentId,
          billingPeriod,
          status: { not: InvoiceStatus.CANCELLED },
        },
      });

      if (existing) {
        throw new BadRequestException(
          `An active invoice (${existing.invoiceNumber}) already exists for this enrollment and billing period (${billingPeriod})`,
        );
      }
    }

    const count = await this.prisma.feeInvoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const resolvedClassId = dto.classId || enrollment?.batch.classId || null;
    const resolvedBatchId = dto.batchId || enrollment?.batchId || null;
    const resolvedSubjectId = dto.subjectId || enrollment?.subjectId || null;

    // Snapshot configuration details
    let configurationSnapshot: any = null;
    if (dto.courseFeeConfigId) {
      const config = await this.prisma.courseFeeConfig.findUnique({
        where: { id: dto.courseFeeConfigId },
        include: { class: true, batch: true, subject: true },
      });
      if (config) {
        configurationSnapshot = {
          configId: config.id,
          configName: config.name,
          standardAmount: config.amount.toString(),
          billingPeriod: config.billingPeriod,
          installmentCount: config.installmentCount,
          installmentsSchedule: config.installmentsSchedule,
          courseName: config.class.name,
          courseCode: config.class.code,
          batchName: config.batch?.name || null,
          subjectName: config.subject?.name || null,
          snapshottedAt: new Date().toISOString(),
        };
      }
    }

    const discount = new Decimal(dto.discountAmount || 0);
    const totalAmount = new Decimal(dto.totalAmount);
    const netPayable = Decimal.max(0, totalAmount.sub(discount));

    const lineItems =
      dto.lines && dto.lines.length > 0
        ? dto.lines.map((l) => ({
            description: l.description,
            amount: new Decimal(l.amount),
            classId: l.classId || resolvedClassId,
            subjectId: l.subjectId || resolvedSubjectId,
          }))
        : [
            {
              description: dto.description,
              amount: totalAmount,
              classId: resolvedClassId,
              subjectId: resolvedSubjectId,
            },
          ];

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.create({
        data: {
          invoiceNumber,
          studentId: dto.studentId,
          enrollmentId: dto.enrollmentId || null,
          classId: resolvedClassId,
          subjectId: resolvedSubjectId,
          batchId: resolvedBatchId,
          courseFeeConfigId: dto.courseFeeConfigId || null,
          billingPeriod: dto.billingPeriod || 'ANNUAL',
          totalAmount: netPayable,
          discountAmount: discount,
          balanceAmount: netPayable,
          paidAmount: new Decimal(0),
          status: netPayable.lte(0) ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
          dueDate: new Date(dto.dueDate),
          configurationSnapshot,
          lines: {
            create: lineItems,
          },
        },
        include: {
          student: true,
          class: true,
          subject: true,
          batch: true,
          lines: true,
          courseFeeConfig: true,
        },
      });

      if (discount.gt(0)) {
        await tx.feeAdjustment.create({
          data: {
            invoiceId: invoice.id,
            type: FeeAdjustmentType.DISCOUNT,
            amount: discount,
            reason: 'Initial enrollment discount applied',
            authorizedById: actorId || (await this.getDefaultAdminId()),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'COURSE_INVOICE_CREATED',
          entityType: 'FeeInvoice',
          entityId: invoice.id,
          details: {
            invoiceNumber,
            studentCode: student.studentCode,
            enrollmentId: dto.enrollmentId,
            classId: resolvedClassId,
            totalAmount: totalAmount.toString(),
            netPayable: netPayable.toString(),
          },
        },
      });

      return invoice;
    });
  }

  async createCourseInvoiceForEnrollment(
    enrollmentId: string,
    billingPeriod: string = 'ANNUAL',
    actorId?: string,
  ) {
    const enrollment = await this.prisma.studentBatchEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
        batch: {
          include: {
            class: {
              include: { academicYear: true },
            },
          },
        },
        subject: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found`);
    }

    // Check duplicate billing
    const existing = await this.prisma.feeInvoice.findFirst({
      where: {
        enrollmentId,
        billingPeriod,
        status: { not: InvoiceStatus.CANCELLED },
      },
    });
    if (existing) {
      return existing;
    }

    // Resolve fee config
    const config = await this.resolveFeeForEnrollment({
      classId: enrollment.batch.classId,
      batchId: enrollment.batchId,
      subjectId: enrollment.subjectId || undefined,
      academicYearId: enrollment.batch.class.academicYearId,
    });

    if (!config) {
      this.logger.warn(
        `No active CourseFeeConfig found for course ${enrollment.batch.class.name} (${enrollment.batch.name}). Skipping automatic invoice.`,
      );
      return null;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days due date default

    const description = `${enrollment.batch.class.name} - ${enrollment.batch.name}${
      enrollment.subject ? ` (${enrollment.subject.name})` : ''
    } [${billingPeriod}]`;

    return this.createCourseInvoice(
      {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        classId: enrollment.batch.classId,
        batchId: enrollment.batchId,
        subjectId: enrollment.subjectId || undefined,
        courseFeeConfigId: config.id,
        billingPeriod,
        totalAmount: config.amount.toNumber(),
        dueDate: dueDate.toISOString().split('T')[0],
        description,
      },
      actorId,
    );
  }

  // ==========================================
  // 3. FEE ADJUSTMENTS & DISCOUNTS
  // ==========================================

  async applyFeeAdjustment(dto: ApplyFeeAdjustmentDto, actorId: string) {
    const invoice = await this.prisma.feeInvoice.findUnique({
      where: { id: dto.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot apply an adjustment to a cancelled invoice');
    }

    const adjAmount = new Decimal(dto.amount);
    if (adjAmount.lte(0)) {
      throw new BadRequestException('Adjustment amount must be positive');
    }

    if (adjAmount.gt(invoice.balanceAmount)) {
      throw new BadRequestException(
        `Adjustment amount (${adjAmount.toString()}) cannot exceed the outstanding balance (${invoice.balanceAmount.toString()})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.feeAdjustment.create({
        data: {
          invoiceId: dto.invoiceId,
          type: dto.type,
          amount: adjAmount,
          reason: dto.reason.trim(),
          authorizedById: actorId,
        },
        include: {
          authorizedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });

      const newTotal = invoice.totalAmount.sub(adjAmount);
      const newBalance = invoice.balanceAmount.sub(adjAmount);
      const newDiscount = invoice.discountAmount.add(adjAmount);
      const newStatus = newBalance.lte(0) ? InvoiceStatus.PAID : invoice.status;

      const updatedInvoice = await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          totalAmount: newTotal,
          balanceAmount: newBalance,
          discountAmount: newDiscount,
          status: newStatus,
        },
        include: {
          lines: true,
          adjustments: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'FEE_ADJUSTMENT_APPLIED',
          entityType: 'FeeAdjustment',
          entityId: adjustment.id,
          details: {
            invoiceNumber: invoice.invoiceNumber,
            type: dto.type,
            amount: adjAmount.toString(),
            reason: dto.reason,
            newBalance: newBalance.toString(),
          },
        },
      });

      return {
        adjustment,
        updatedInvoice,
      };
    });
  }

  // ==========================================
  // 4. PAYMENTS & ALLOCATIONS
  // ==========================================

  async getPayments(query: { studentId?: string; status?: PaymentStatus }) {
    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.status) where.status = query.status;

    return this.prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        student: true,
        recordedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        allocations: {
          include: {
            invoice: {
              include: {
                class: true,
                subject: true,
                batch: true,
              },
            },
          },
        },
      },
    });
  }

  async getPaymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        student: true,
        recordedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        allocations: {
          include: {
            invoice: {
              include: {
                lines: true,
                class: true,
                subject: true,
                batch: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async recordPayment(dto: RecordPaymentDto, actorId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });

    if (!student) {
      throw new NotFoundException(`Student ${dto.studentId} not found`);
    }

    // 1. Idempotency check: if idempotencyKey supplied, return existing payment
    if (dto.idempotencyKey) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: {
          student: true,
          recordedBy: {
            select: { firstName: true, lastName: true, email: true },
          },
          allocations: {
            include: {
              invoice: {
                include: { class: true, batch: true },
              },
            },
          },
        },
      });

      if (existingPayment) {
        this.logger.log(`Idempotent retry detected for payment key: ${dto.idempotencyKey}`);
        return {
          payment: existingPayment,
          receiptNumber: existingPayment.receiptNumber,
          isDuplicateRetry: true,
          allocatedAmount: existingPayment.amount.toString(),
          unallocatedAmount: '0',
        };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const paymentCount = await tx.payment.count();
      const receiptNumber = `REC-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(5, '0')}`;

      // 2. Validate explicit multi-course allocations if provided
      if (dto.allocations && dto.allocations.length > 0) {
        const totalAllocated = dto.allocations.reduce(
          (sum, a) => sum.add(new Decimal(a.amount)),
          new Decimal(0),
        );

        if (!totalAllocated.equals(new Decimal(dto.amount))) {
          throw new BadRequestException(
            `Sum of course fee allocations (${totalAllocated.toString()}) must exactly equal the payment amount (${dto.amount})`,
          );
        }

        for (const allocItem of dto.allocations) {
          const inv = await tx.feeInvoice.findUnique({
            where: { id: allocItem.invoiceId },
          });

          if (!inv) {
            throw new NotFoundException(`Invoice ${allocItem.invoiceId} not found`);
          }

          if (inv.studentId !== dto.studentId) {
            throw new BadRequestException(
              `Invoice ${inv.invoiceNumber} does not belong to student ${dto.studentId}`,
            );
          }

          if (!([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] as InvoiceStatus[]).includes(inv.status)) {
            throw new BadRequestException(
              `Invoice ${inv.invoiceNumber} is already ${inv.status} and cannot receive further payments`,
            );
          }

          if (new Decimal(allocItem.amount).gt(inv.balanceAmount)) {
            throw new BadRequestException(
              `Allocated amount (${allocItem.amount}) exceeds outstanding balance (${inv.balanceAmount.toString()}) for invoice ${inv.invoiceNumber}`,
            );
          }
        }
      }

      // 3. Create Payment record
      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          idempotencyKey: dto.idempotencyKey || null,
          studentId: dto.studentId,
          amount: new Decimal(dto.amount),
          paymentMethod: dto.paymentMethod,
          status: PaymentStatus.COMPLETED,
          reference: dto.reference,
          notes: dto.notes,
          recordedById: actorId,
        },
      });

      const allocatedRecords: any[] = [];
      let remainingToAllocate = new Decimal(dto.amount);

      // Branch A: Explicit multi-course allocations
      if (dto.allocations && dto.allocations.length > 0) {
        for (const allocItem of dto.allocations) {
          const allocAmount = new Decimal(allocItem.amount);
          const inv = await tx.feeInvoice.findUniqueOrThrow({
            where: { id: allocItem.invoiceId },
          });

          const allocation = await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              invoiceId: inv.id,
              allocatedAmount: allocAmount,
            },
          });
          allocatedRecords.push(allocation);

          const newPaid = inv.paidAmount.add(allocAmount);
          const newBalance = inv.balanceAmount.sub(allocAmount);
          const newStatus = newBalance.lte(0) ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

          await tx.feeInvoice.update({
            where: { id: inv.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              status: newStatus,
            },
          });

          remainingToAllocate = remainingToAllocate.sub(allocAmount);
        }
      }
      // Branch B: Single targeted invoice or FIFO fallback
      else {
        let targetInvoice = null;
        if (dto.invoiceId) {
          targetInvoice = await tx.feeInvoice.findFirst({
            where: {
              id: dto.invoiceId,
              studentId: dto.studentId,
              status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
            },
          });
        }

        const openInvoices = await tx.feeInvoice.findMany({
          where: {
            studentId: dto.studentId,
            status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
            ...(dto.invoiceId ? { id: { not: dto.invoiceId } } : {}),
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        });

        const queue = targetInvoice ? [targetInvoice, ...openInvoices] : openInvoices;

        for (const inv of queue) {
          if (remainingToAllocate.lte(0)) break;

          const currentBalance = inv.balanceAmount;
          const allocationAmount = Decimal.min(remainingToAllocate, currentBalance);

          if (allocationAmount.gt(0)) {
            const allocation = await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                invoiceId: inv.id,
                allocatedAmount: allocationAmount,
              },
            });
            allocatedRecords.push(allocation);

            const newPaid = inv.paidAmount.add(allocationAmount);
            const newBalance = inv.balanceAmount.sub(allocationAmount);
            const newStatus = newBalance.lte(0) ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

            await tx.feeInvoice.update({
              where: { id: inv.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: newBalance,
                status: newStatus,
              },
            });

            remainingToAllocate = remainingToAllocate.sub(allocationAmount);
          }
        }
      }

      // 4. Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PAYMENT_RECORDED',
          entityType: 'Payment',
          entityId: payment.id,
          details: {
            receiptNumber,
            amount: dto.amount,
            studentCode: student.studentCode,
            allocationsCount: allocatedRecords.length,
            unallocatedAmount: remainingToAllocate.toString(),
            explicitAllocations: !!dto.allocations?.length,
          },
        },
      });

      // 5. Calculate faculty revenue pool & auditable salary ledger
      await this.salaryService.calculatePaymentSalaryRevenue(payment.id, tx);

      return {
        payment,
        receiptNumber,
        allocatedAmount: new Decimal(dto.amount).sub(remainingToAllocate).toString(),
        unallocatedAmount: remainingToAllocate.toString(),
      };
    });
  }

  async reversePayment(paymentId: string, dto: ReversePaymentDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          allocations: {
            where: { isReversed: false },
            include: { invoice: true },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${paymentId} not found`);
      }

      if (payment.status === PaymentStatus.REVERSED) {
        throw new BadRequestException(`Payment ${payment.receiptNumber} has already been reversed`);
      }

      // 1. Mark allocations as reversed and restore invoice balances
      for (const alloc of payment.allocations) {
        await tx.paymentAllocation.update({
          where: { id: alloc.id },
          data: { isReversed: true },
        });

        const inv = alloc.invoice;
        const restoredPaid = inv.paidAmount.sub(alloc.allocatedAmount);
        const restoredBalance = inv.balanceAmount.add(alloc.allocatedAmount);
        const restoredStatus = restoredBalance.gte(inv.totalAmount)
          ? InvoiceStatus.UNPAID
          : InvoiceStatus.PARTIAL;

        await tx.feeInvoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: Decimal.max(0, restoredPaid),
            balanceAmount: Decimal.min(inv.totalAmount, restoredBalance),
            status: restoredStatus,
          },
        });
      }

      // 2. Mark payment as reversed
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedById: actorId,
          reversalReason: dto.reason,
        },
      });

      // 3. Write AuditLog
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'PAYMENT_REVERSED',
          entityType: 'Payment',
          entityId: paymentId,
          details: {
            receiptNumber: payment.receiptNumber,
            reversalReason: dto.reason,
            reversedAllocationsCount: payment.allocations.length,
          },
        },
      });

      // 4. Traceable salary adjustments and cancellations
      await this.salaryService.reversePaymentSalaryRevenue(paymentId, dto.reason, actorId, tx);

      return {
        payment: updatedPayment,
        message: `Payment ${payment.receiptNumber} successfully reversed`,
      };
    });
  }

  // ==========================================
  // 5. STUDENT CONSOLIDATED FEE ACCOUNT
  // ==========================================

  async getStudentFeeAccount(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: {
        batchEnrollments: {
          include: {
            batch: {
              include: { class: true },
            },
            subject: true,
          },
        },
        feeInvoices: {
          where: { status: { not: InvoiceStatus.CANCELLED } },
          include: {
            class: true,
            subject: true,
            batch: true,
            courseFeeConfig: true,
            lines: true,
            adjustments: true,
            allocations: {
              where: { isReversed: false },
              include: {
                payment: {
                  include: {
                    recordedBy: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    let consolidatedBilled = new Decimal(0);
    let consolidatedPaid = new Decimal(0);
    let consolidatedBalance = new Decimal(0);
    let consolidatedDiscounts = new Decimal(0);
    let hasOverdue = false;
    const now = new Date();

    const courseAccounts = student.feeInvoices.map((inv) => {
      consolidatedBilled = consolidatedBilled.add(inv.totalAmount);
      consolidatedPaid = consolidatedPaid.add(inv.paidAmount);
      consolidatedBalance = consolidatedBalance.add(inv.balanceAmount);
      consolidatedDiscounts = consolidatedDiscounts.add(inv.discountAmount);

      const isOverdue =
        inv.dueDate < now &&
        ([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] as InvoiceStatus[]).includes(inv.status);
      if (isOverdue) hasOverdue = true;

      // Extract next installment due date from configuration snapshot if available
      let nextInstallmentDueDate = null;
      if (inv.configurationSnapshot && typeof inv.configurationSnapshot === 'object') {
        const snap: any = inv.configurationSnapshot;
        if (snap.installmentsSchedule && Array.isArray(snap.installmentsSchedule)) {
          const nextInst = snap.installmentsSchedule[0];
          if (nextInst) {
            nextInstallmentDueDate = inv.dueDate;
          }
        }
      }

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        courseId: inv.classId,
        courseName: inv.class?.name || 'Standard Course',
        courseCode: inv.class?.code || '',
        subjectId: inv.subjectId,
        subjectName: inv.subject?.name || null,
        batchId: inv.batchId,
        batchName: inv.batch?.name || null,
        enrollmentId: inv.enrollmentId,
        billingPeriod: inv.billingPeriod || 'ANNUAL',
        totalAmount: inv.totalAmount.toNumber(),
        discountAmount: inv.discountAmount.toNumber(),
        paidAmount: inv.paidAmount.toNumber(),
        balanceAmount: inv.balanceAmount.toNumber(),
        status: inv.status,
        dueDate: inv.dueDate.toISOString().split('T')[0],
        nextInstallmentDueDate,
        isOverdue,
        lines: inv.lines.map((l) => ({
          id: l.id,
          description: l.description,
          amount: l.amount.toNumber(),
        })),
        adjustments: inv.adjustments.map((a) => ({
          id: a.id,
          type: a.type,
          amount: a.amount.toNumber(),
          reason: a.reason,
          createdAt: a.createdAt,
        })),
        allocations: inv.allocations.map((a) => ({
          allocationId: a.id,
          paymentId: a.payment.id,
          receiptNumber: a.payment.receiptNumber,
          paymentDate: a.payment.paidAt,
          paymentMethod: a.payment.paymentMethod,
          allocatedAmount: a.allocatedAmount.toNumber(),
          recordedBy: a.payment.recordedBy
            ? `${a.payment.recordedBy.firstName} ${a.payment.recordedBy.lastName}`
            : 'System',
        })),
      };
    });

    let overallStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' = 'UNPAID';
    if (consolidatedBalance.lte(0) && consolidatedBilled.gt(0)) {
      overallStatus = 'PAID';
    } else if (hasOverdue) {
      overallStatus = 'OVERDUE';
    } else if (consolidatedPaid.gt(0)) {
      overallStatus = 'PARTIAL';
    }

    const activeEnrollments = student.batchEnrollments
      .filter((e) => e.isActive)
      .map((e) => ({
        enrollmentId: e.id,
        courseId: e.batch.class.id,
        courseName: e.batch.class.name,
        courseCode: e.batch.class.code,
        batchId: e.batch.id,
        batchName: e.batch.name,
        subjectId: e.subjectId,
        subjectName: e.subject?.name || null,
        startDate: e.startDate,
      }));

    return {
      student: {
        id: student.id,
        studentCode: student.studentCode,
        admissionNumber: student.admissionNumber,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        phone: student.phone,
        status: student.status,
      },
      enrolledCourses: activeEnrollments,
      courseFees: courseAccounts,
      consolidatedAccount: {
        totalCoursesEnrolled: activeEnrollments.length,
        consolidatedTotalBilled: consolidatedBilled.toNumber(),
        consolidatedDiscounts: consolidatedDiscounts.toNumber(),
        consolidatedNetPayable: consolidatedBilled.toNumber(),
        consolidatedPaid: consolidatedPaid.toNumber(),
        consolidatedBalance: consolidatedBalance.toNumber(),
        overallStatus,
      },
    };
  }

  async getConsolidatedStudentAccounts(query: {
    search?: string;
    classId?: string;
    batchId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const whereStudent: any = {};
    if (query.search) {
      whereStudent.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { studentCode: { contains: query.search, mode: 'insensitive' } },
        { admissionNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.batchId) {
      whereStudent.batchEnrollments = {
        some: { batchId: query.batchId, isActive: true },
      };
    } else if (query.classId) {
      whereStudent.batchEnrollments = {
        some: { batch: { classId: query.classId }, isActive: true },
      };
    }

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where: whereStudent }),
      this.prisma.student.findMany({
        where: whereStudent,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          batchEnrollments: {
            where: { isActive: true },
            include: {
              batch: { include: { class: true } },
              subject: true,
            },
          },
          feeInvoices: {
            where: { status: { not: InvoiceStatus.CANCELLED } },
            include: {
              class: true,
              subject: true,
              batch: true,
            },
          },
        },
      }),
    ]);

    const items = students.map((s) => {
      let billed = new Decimal(0);
      let paid = new Decimal(0);
      let balance = new Decimal(0);
      let discounts = new Decimal(0);
      let hasOverdue = false;
      const now = new Date();

      for (const inv of s.feeInvoices) {
        billed = billed.add(inv.totalAmount);
        paid = paid.add(inv.paidAmount);
        balance = balance.add(inv.balanceAmount);
        discounts = discounts.add(inv.discountAmount);
        if (
          inv.dueDate < now &&
          ([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] as InvoiceStatus[]).includes(inv.status)
        ) {
          hasOverdue = true;
        }
      }

      let overallStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' = 'UNPAID';
      if (balance.lte(0) && billed.gt(0)) {
        overallStatus = 'PAID';
      } else if (hasOverdue) {
        overallStatus = 'OVERDUE';
      } else if (paid.gt(0)) {
        overallStatus = 'PARTIAL';
      }

      return {
        id: s.id,
        studentCode: s.studentCode,
        admissionNumber: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`,
        email: s.email,
        phone: s.phone,
        status: s.status,
        enrolledCourses: s.batchEnrollments.map((e) => ({
          courseId: e.batch.class.id,
          courseName: e.batch.class.name,
          courseCode: e.batch.class.code,
          batchName: e.batch.name,
          subjectName: e.subject?.name || null,
        })),
        courseInvoicesCount: s.feeInvoices.length,
        consolidatedBilled: billed.toNumber(),
        consolidatedPaid: paid.toNumber(),
        consolidatedBalance: balance.toNumber(),
        consolidatedDiscounts: discounts.toNumber(),
        overallStatus,
      };
    });

    return {
      items: query.status ? items.filter((i) => i.overallStatus === query.status) : items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // 6. FINANCE DASHBOARD & AGGREGATE SUMMARY
  // ==========================================

  async getFinanceDashboardSummary() {
    const invoiceAgg = await this.prisma.feeInvoice.aggregate({
      where: { status: { not: InvoiceStatus.CANCELLED } },
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        discountAmount: true,
      },
      _count: { id: true },
    });

    const payments = await this.prisma.payment.findMany();
    let totalCollected = new Decimal(0);
    let totalReversed = new Decimal(0);
    for (const p of payments) {
      if (p.status === PaymentStatus.COMPLETED) {
        totalCollected = totalCollected.add(p.amount);
      } else if (p.status === PaymentStatus.REVERSED) {
        totalReversed = totalReversed.add(p.amount);
      }
    }

    const now = new Date();
    const overdueAgg = await this.prisma.feeInvoice.aggregate({
      where: {
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
        dueDate: { lt: now },
      },
      _sum: {
        balanceAmount: true,
      },
      _count: { id: true },
    });

    const classes = await this.prisma.class.findMany({
      include: {
        batches: {
          include: {
            _count: {
              select: { enrollments: { where: { isActive: true } } },
            },
          },
        },
        feeInvoices: {
          where: { status: { not: InvoiceStatus.CANCELLED } },
          include: {
            allocations: {
              where: { isReversed: false },
            },
          },
        },
      },
    });

    const courseBreakdown = classes.map((c) => {
      let invoiced = new Decimal(0);
      let collected = new Decimal(0);
      let outstanding = new Decimal(0);

      for (const inv of c.feeInvoices) {
        invoiced = invoiced.add(inv.totalAmount);
        outstanding = outstanding.add(inv.balanceAmount);
        for (const alloc of inv.allocations) {
          collected = collected.add(alloc.allocatedAmount);
        }
      }

      const totalEnrolled = c.batches.reduce(
        (acc, b) => acc + (b._count?.enrollments || 0),
        0,
      );

      return {
        courseId: c.id,
        courseName: c.name,
        courseCode: c.code,
        invoiced: invoiced.toNumber(),
        collected: collected.toNumber(),
        outstanding: outstanding.toNumber(),
        collectionRate: invoiced.gt(0)
          ? Math.round((collected.toNumber() / invoiced.toNumber()) * 100)
          : 0,
        enrolledStudentsCount: totalEnrolled,
      };
    });

    const exceptions = await this.prisma.paymentRevenueException.findMany({
      where: { status: 'PENDING' },
      take: 10,
    });

    return {
      kpis: {
        totalInvoiced: (invoiceAgg._sum.totalAmount || new Decimal(0)).toNumber(),
        totalCollected: totalCollected.toNumber(),
        outstandingReceivables: (invoiceAgg._sum.balanceAmount || new Decimal(0)).toNumber(),
        overdueAmount: (overdueAgg._sum.balanceAmount || new Decimal(0)).toNumber(),
        totalReversals: totalReversed.toNumber(),
        totalDiscounts: (invoiceAgg._sum.discountAmount || new Decimal(0)).toNumber(),
        totalInvoicesCount: invoiceAgg._count.id || 0,
        overdueInvoicesCount: overdueAgg._count.id || 0,
        totalPaymentsCount: payments.length,
        pendingExceptionsCount: exceptions.length,
      },
      courseBreakdown,
      reconciliationExceptions: exceptions,
    };
  }

  // ==========================================
  // 7. INVOICES, RECEIPTS & LEGACY COMPATIBILITY
  // ==========================================

  async getFeePlans(academicYearId?: string) {
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;

    return this.prisma.feePlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        academicYear: true,
        _count: {
          select: { invoices: true },
        },
      },
    });
  }

  async createFeePlan(dto: CreateFeePlanDto) {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: dto.academicYearId },
    });
    if (!academicYear) {
      throw new NotFoundException(`Academic year ${dto.academicYearId} not found`);
    }

    return this.prisma.feePlan.create({
      data: {
        name: dto.name,
        academicYearId: dto.academicYearId,
        totalAmount: new Decimal(dto.totalAmount),
      },
      include: {
        academicYear: true,
      },
    });
  }

  async getInvoices(query: { studentId?: string; status?: InvoiceStatus; classId?: string }) {
    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.status) where.status = query.status;
    if (query.classId) where.classId = query.classId;

    return this.prisma.feeInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        student: true,
        feePlan: true,
        class: true,
        subject: true,
        batch: true,
        lines: true,
        adjustments: true,
        allocations: {
          where: { isReversed: false },
          include: {
            payment: true,
          },
        },
      },
    });
  }

  async getInvoiceById(id: string) {
    const invoice = await this.prisma.feeInvoice.findUnique({
      where: { id },
      include: {
        student: true,
        feePlan: true,
        class: true,
        subject: true,
        batch: true,
        courseFeeConfig: true,
        lines: true,
        adjustments: {
          include: {
            authorizedBy: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
        allocations: {
          include: {
            payment: {
              include: {
                recordedBy: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto) {
    return this.createCourseInvoice(
      {
        studentId: dto.studentId,
        totalAmount: dto.totalAmount,
        dueDate: dto.dueDate,
        description: dto.description,
        lines: dto.lines?.map((l) => ({ description: l.description, amount: l.amount })),
      },
      undefined,
    );
  }

  async getReceipt(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            batchEnrollments: {
              where: { isActive: true },
              include: {
                batch: {
                  include: { class: true },
                },
                subject: true,
              },
            },
          },
        },
        recordedBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        allocations: {
          include: {
            invoice: {
              include: {
                class: true,
                subject: true,
                batch: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const enrolledCourses = payment.student.batchEnrollments.map((e) => ({
      courseName: e.batch.class.name,
      batchName: e.batch.name,
      subjectName: e.subject?.name || null,
    }));

    return {
      academy: {
        name: 'RC Academy',
        tagline: 'Excellence in Education & AI Assessment',
        address: '123 Academy Blvd, Academic District',
        contact: '+91 98765 43210 / info@rcacademy.com',
      },
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paidAt,
      student: {
        id: payment.student.id,
        name: `${payment.student.firstName} ${payment.student.lastName}`,
        studentCode: payment.student.studentCode,
        admissionNumber: payment.student.admissionNumber,
        enrolledCourses,
      },
      payment: {
        amount: payment.amount.toNumber(),
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
        reversedAt: payment.reversedAt,
        reversalReason: payment.reversalReason,
        recordedBy: `${payment.recordedBy.firstName} ${payment.recordedBy.lastName}`,
      },
      allocations: payment.allocations.map((a) => ({
        invoiceNumber: a.invoice.invoiceNumber,
        courseName: a.invoice.class?.name || 'Standard Course',
        batchName: a.invoice.batch?.name || null,
        subjectName: a.invoice.subject?.name || null,
        allocatedAmount: a.allocatedAmount.toNumber(),
        invoiceTotal: a.invoice.totalAmount.toNumber(),
        invoiceRemainingBalance: a.invoice.balanceAmount.toNumber(),
        isReversed: a.isReversed,
      })),
    };
  }

  async getOutstandingReport() {
    const invoices = await this.prisma.feeInvoice.findMany({
      where: {
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
      },
      include: {
        student: true,
        class: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    let totalOutstanding = new Decimal(0);
    let totalOverdue = new Decimal(0);

    const studentMap = new Map<string, any>();

    for (const inv of invoices) {
      totalOutstanding = totalOutstanding.add(inv.balanceAmount);
      const isOverdue = inv.dueDate < now;
      if (isOverdue) {
        totalOverdue = totalOverdue.add(inv.balanceAmount);
      }

      if (!studentMap.has(inv.studentId)) {
        studentMap.set(inv.studentId, {
          studentId: inv.student.id,
          studentName: `${inv.student.firstName} ${inv.student.lastName}`,
          studentCode: inv.student.studentCode,
          totalOutstanding: new Decimal(0),
          overdueAmount: new Decimal(0),
          invoicesCount: 0,
        });
      }

      const rec = studentMap.get(inv.studentId);
      rec.totalOutstanding = rec.totalOutstanding.add(inv.balanceAmount);
      rec.invoicesCount += 1;
      if (isOverdue) {
        rec.overdueAmount = rec.overdueAmount.add(inv.balanceAmount);
      }
    }

    return {
      summary: {
        totalOutstanding: totalOutstanding.toNumber(),
        totalOverdue: totalOverdue.toNumber(),
        totalInvoicesCount: invoices.length,
        studentsCount: studentMap.size,
      },
      students: Array.from(studentMap.values()).map((s) => ({
        ...s,
        totalOutstanding: s.totalOutstanding.toNumber(),
        overdueAmount: s.overdueAmount.toNumber(),
      })),
    };
  }

  async getReconciliationReport(startDate?: string, endDate?: string) {
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const wherePayment: any = {};
    if (startDate || endDate) wherePayment.paidAt = dateFilter;

    const payments = await this.prisma.payment.findMany({
      where: wherePayment,
    });

    let totalCollected = new Decimal(0);
    let totalReversed = new Decimal(0);
    const methodSummary: Record<string, { count: number; total: Decimal }> = {};

    for (const p of payments) {
      if (!methodSummary[p.paymentMethod]) {
        methodSummary[p.paymentMethod] = { count: 0, total: new Decimal(0) };
      }
      methodSummary[p.paymentMethod].count += 1;
      methodSummary[p.paymentMethod].total = methodSummary[p.paymentMethod].total.add(p.amount);

      if (p.status === PaymentStatus.COMPLETED) {
        totalCollected = totalCollected.add(p.amount);
      } else if (p.status === PaymentStatus.REVERSED) {
        totalReversed = totalReversed.add(p.amount);
      }
    }

    const whereInvoice: any = {};
    if (startDate || endDate) whereInvoice.createdAt = dateFilter;

    const invoices = await this.prisma.feeInvoice.findMany({
      where: whereInvoice,
    });

    let totalBilled = new Decimal(0);
    let totalPaidAgainstInvoices = new Decimal(0);
    let totalBalanceAgainstInvoices = new Decimal(0);

    for (const inv of invoices) {
      totalBilled = totalBilled.add(inv.totalAmount);
      totalPaidAgainstInvoices = totalPaidAgainstInvoices.add(inv.paidAmount);
      totalBalanceAgainstInvoices = totalBalanceAgainstInvoices.add(inv.balanceAmount);
    }

    const methodBreakdown: Record<string, { count: number; total: number }> = {};
    for (const [k, v] of Object.entries(methodSummary)) {
      methodBreakdown[k] = { count: v.count, total: v.total.toNumber() };
    }

    return {
      period: {
        startDate: startDate || 'ALL',
        endDate: endDate || 'ALL',
      },
      billing: {
        totalBilled: totalBilled.toNumber(),
        totalPaid: totalPaidAgainstInvoices.toNumber(),
        totalBalance: totalBalanceAgainstInvoices.toNumber(),
        invoicesCount: invoices.length,
      },
      collections: {
        totalCollected: totalCollected.toNumber(),
        totalReversed: totalReversed.toNumber(),
        netCollected: totalCollected.toNumber(),
        totalTransactions: payments.length,
        methodBreakdown,
      },
    };
  }

  private async getDefaultAdminId(): Promise<string> {
    const admin = await this.prisma.user.findFirst();
    return admin?.id || 'system-admin-uuid';
  }
}
