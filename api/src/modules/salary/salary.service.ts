import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  UpdateSalaryConfigDto,
  CreatePayoutDto,
  ProcessPayoutDto,
  ResolveExceptionDto,
  SalaryLedgerQueryDto,
  AccrueFixedSalaryDto,
  CreateSalaryAdjustmentDto,
} from './dto/salary.dto';

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // CONFIGURATION
  // ==========================================

  async getSalaryConfig() {
    let config = await this.prisma.academySalaryConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      config = await this.prisma.academySalaryConfig.create({
        data: {
          defaultStaffPoolRate: new Decimal(70.0),
          defaultAcademyShareRate: new Decimal(30.0),
          isApprovalRequired: true,
        },
      });
    }

    return {
      id: config.id,
      defaultStaffPoolRate: Number(config.defaultStaffPoolRate),
      defaultAcademyShareRate: Number(config.defaultAcademyShareRate),
      isApprovalRequired: config.isApprovalRequired,
      updatedAt: config.updatedAt,
    };
  }

  async updateSalaryConfig(dto: UpdateSalaryConfigDto, actorId?: string) {
    const existing = await this.getSalaryConfig();

    const staffRate =
      dto.defaultStaffPoolRate !== undefined
        ? new Decimal(dto.defaultStaffPoolRate)
        : new Decimal(existing.defaultStaffPoolRate);

    const academyRate =
      dto.defaultAcademyShareRate !== undefined
        ? new Decimal(dto.defaultAcademyShareRate)
        : new Decimal(100).sub(staffRate);

    const updated = await this.prisma.academySalaryConfig.update({
      where: { id: existing.id },
      data: {
        defaultStaffPoolRate: staffRate,
        defaultAcademyShareRate: academyRate,
        ...(dto.isApprovalRequired !== undefined && {
          isApprovalRequired: dto.isApprovalRequired,
        }),
        updatedById: actorId,
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'SALARY_CONFIG_UPDATE',
          entityType: 'AcademySalaryConfig',
          entityId: updated.id,
          details: {
            staffPoolRate: Number(staffRate),
            academyShareRate: Number(academyRate),
          },
        },
      });
    }

    return {
      id: updated.id,
      defaultStaffPoolRate: Number(updated.defaultStaffPoolRate),
      defaultAcademyShareRate: Number(updated.defaultAcademyShareRate),
      isApprovalRequired: updated.isApprovalRequired,
      updatedAt: updated.updatedAt,
    };
  }

  // ==========================================
  // REVENUE CALCULATION & LEDGER CREATION
  // ==========================================

  async calculatePaymentSalaryRevenue(
    paymentId: string,
    txClient?: Prisma.TransactionClient,
  ) {
    const db = txClient || this.prisma;

    // 1. Idempotency check: prevent duplicate earnings from retries or repeat events
    const existingLedgers = await db.staffSalaryLedger.findFirst({
      where: { paymentId, isReversed: false },
    });
    if (existingLedgers) {
      return { skipped: true, reason: 'PAYMENT_ALREADY_PROCESSED' };
    }

    // 2. Fetch payment with student and allocations
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            batchEnrollments: {
              where: { isActive: true },
              include: {
                batch: {
                  include: {
                    class: true,
                  },
                },
              },
            },
          },
        },
        allocations: {
          where: { isReversed: false },
          include: {
            invoice: {
              include: {
                lines: true,
              },
            },
          },
        },
      },
    });

    if (!payment || payment.status !== 'COMPLETED' || payment.amount.lte(0)) {
      return { skipped: true, reason: 'INVALID_OR_NON_COMPLETED_PAYMENT' };
    }

    // Config defaults
    const config = await this.getSalaryConfig();
    const defaultStaffRate = new Decimal(config.defaultStaffPoolRate);
    const defaultAcademyRate = new Decimal(config.defaultAcademyShareRate);

    const createdLedgerEntries: any[] = [];
    const createdExceptions: any[] = [];

    // If there are no allocations (unallocated payment)
    if (payment.allocations.length === 0) {
      const exc = await db.paymentRevenueException.create({
        data: {
          paymentId: payment.id,
          receiptNumber: payment.receiptNumber,
          unallocatedAmount: payment.amount,
          reason: 'PAYMENT_HAS_NO_INVOICE_ALLOCATIONS',
          status: 'PENDING',
        },
      });
      createdExceptions.push(exc);
      return { createdLedgerEntries, createdExceptions };
    }

    for (const alloc of payment.allocations) {
      const allocatedAmount = alloc.allocatedAmount;
      if (allocatedAmount.lte(0)) continue;

      const invoice = alloc.invoice;
      const lines = invoice?.lines || [];

      // Determine eligible course/class & subject from invoice lines or student batch enrollment
      let matchedLines = lines.filter((l) => l.classId || l.subjectId);

      // If lines don't have explicit classId, fall back to student's active batch enrollments
      if (matchedLines.length === 0) {
        const studentEnrollment = payment.student.batchEnrollments[0];
        if (!studentEnrollment) {
          // No active enrollment found for student -> log exception
          const exc = await db.paymentRevenueException.create({
            data: {
              paymentId: payment.id,
              receiptNumber: payment.receiptNumber,
              unallocatedAmount: allocatedAmount,
              reason: 'NO_ACTIVE_STUDENT_ENROLLMENT',
              status: 'PENDING',
            },
          });
          createdExceptions.push(exc);
          continue;
        }

        const classId = studentEnrollment.batch.classId;
        const batchId = studentEnrollment.batchId;

        // Find active teaching assignments for this class & batch for REVENUE_SHARING faculty
        const assignments = await db.staffCourseAssignment.findMany({
          where: {
            classId,
            isActive: true,
            OR: [{ batchId }, { batchId: null }],
            user: {
              compensationModel: 'REVENUE_SHARING',
            },
          },
          include: {
            user: true,
            class: true,
            subject: true,
          },
        });

        if (assignments.length === 0) {
          const exc = await db.paymentRevenueException.create({
            data: {
              paymentId: payment.id,
              receiptNumber: payment.receiptNumber,
              unallocatedAmount: allocatedAmount,
              reason: `NO_ACTIVE_STAFF_ASSIGNMENT_FOR_CLASS_${classId}`,
              status: 'PENDING',
            },
          });
          createdExceptions.push(exc);
          continue;
        }

        // Split staff pool evenly among active assignments
        const poolFraction = allocatedAmount.div(assignments.length);
        for (const assign of assignments) {
          const staffRate = assign.staffSharePercentage || defaultStaffRate;
          const academyRate = new Decimal(100).sub(staffRate);

          const staffPoolAmount = poolFraction
            .mul(staffRate)
            .div(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          const academyShareAmount = poolFraction
            .sub(staffPoolAmount)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

          const entry = await db.staffSalaryLedger.create({
            data: {
              userId: assign.userId,
              compensationModel: 'REVENUE_SHARING',
              assignmentId: assign.id,
              classId: assign.classId,
              subjectId: assign.subjectId || null,
              paymentId: payment.id,
              paymentAllocationId: alloc.id,
              receiptNumber: payment.receiptNumber,
              collectedAmount: poolFraction,
              staffPoolRate: staffRate,
              academyShareRate: academyRate,
              academyShareAmount,
              staffPoolAmount,
              earnedAmount: staffPoolAmount,
              ruleApplied: assign.compensationRule || 'REVENUE_SHARE_70_30',
              status: 'ACCRUED',
            },
          });
          createdLedgerEntries.push(entry);
        }
      } else {
        // Multi-line invoice with explicit course/subject breakdown
        const totalLineAmount = matchedLines.reduce(
          (sum, l) => sum.add(l.amount),
          new Decimal(0),
        );

        for (const line of matchedLines) {
          // Weight proportion of this line within allocation
          const lineFraction = totalLineAmount.gt(0)
            ? allocatedAmount.mul(line.amount).div(totalLineAmount)
            : allocatedAmount.div(matchedLines.length);

          const whereAssignment: any = {
            isActive: true,
            user: {
              compensationModel: 'REVENUE_SHARING',
            },
          };
          if (line.classId) whereAssignment.classId = line.classId;
          if (line.subjectId) whereAssignment.subjectId = line.subjectId;

          const assignments = await db.staffCourseAssignment.findMany({
            where: whereAssignment,
            include: { user: true, class: true, subject: true },
          });

          if (assignments.length === 0) {
            const exc = await db.paymentRevenueException.create({
              data: {
                paymentId: payment.id,
                receiptNumber: payment.receiptNumber,
                unallocatedAmount: lineFraction.toDecimalPlaces(2),
                reason: `NO_STAFF_FOR_LINE_CLASS_${line.classId || 'ANY'}_SUBJECT_${line.subjectId || 'ANY'}`,
                status: 'PENDING',
              },
            });
            createdExceptions.push(exc);
            continue;
          }

          const splitPerTeacher = lineFraction.div(assignments.length);
          for (const assign of assignments) {
            const staffRate = assign.staffSharePercentage || defaultStaffRate;
            const academyRate = new Decimal(100).sub(staffRate);

            const staffPoolAmount = splitPerTeacher
              .mul(staffRate)
              .div(100)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
            const academyShareAmount = splitPerTeacher
              .sub(staffPoolAmount)
              .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

            const entry = await db.staffSalaryLedger.create({
              data: {
                userId: assign.userId,
                compensationModel: 'REVENUE_SHARING',
                assignmentId: assign.id,
                classId: assign.classId,
                subjectId: assign.subjectId || null,
                paymentId: payment.id,
                paymentAllocationId: alloc.id,
                receiptNumber: payment.receiptNumber,
                collectedAmount: splitPerTeacher.toDecimalPlaces(2),
                staffPoolRate: staffRate,
                academyShareRate: academyRate,
                academyShareAmount,
                staffPoolAmount,
                earnedAmount: staffPoolAmount,
                ruleApplied: assign.compensationRule || 'REVENUE_SHARE_70_30',
                status: 'ACCRUED',
              },
            });
            createdLedgerEntries.push(entry);
          }
        }
      }
    }

    return { createdLedgerEntries, createdExceptions };
  }

  // ==========================================
  // REVERSAL & ADJUSTMENT TRACKING
  // ==========================================

  async reversePaymentSalaryRevenue(
    paymentId: string,
    reversalReason: string,
    actorId?: string,
    txClient?: Prisma.TransactionClient,
  ) {
    const db = txClient || this.prisma;

    // Find all active (non-reversed) ledger entries for this payment
    const activeEntries = await db.staffSalaryLedger.findMany({
      where: {
        paymentId,
        isReversed: false,
      },
    });

    const reversedEntries = [];

    for (const entry of activeEntries) {
      // 1. Mark existing historical entry as reversed
      await db.staffSalaryLedger.update({
        where: { id: entry.id },
        data: {
          isReversed: true,
          reversedAt: new Date(),
          reversalReason,
          status: 'CANCELLED',
        },
      });

      // 2. Insert auditable negative compensating entry rather than deleting historical rows
      const reversalLedger = await db.staffSalaryLedger.create({
        data: {
          userId: entry.userId,
          assignmentId: entry.assignmentId,
          classId: entry.classId,
          subjectId: entry.subjectId,
          paymentId: entry.paymentId,
          paymentAllocationId: entry.paymentAllocationId,
          receiptNumber: `${entry.receiptNumber}-REV`,
          collectedAmount: entry.collectedAmount.negated(),
          staffPoolRate: entry.staffPoolRate,
          academyShareRate: entry.academyShareRate,
          academyShareAmount: entry.academyShareAmount.negated(),
          staffPoolAmount: entry.staffPoolAmount.negated(),
          earnedAmount: entry.earnedAmount.negated(),
          ruleApplied: 'REVERSAL_ADJUSTMENT',
          status: 'CANCELLED',
          isReversed: true,
          reversedAt: new Date(),
          reversalReason: `Compensating reversal for ${entry.receiptNumber}: ${reversalReason}`,
        },
      });

      reversedEntries.push(reversalLedger);
    }

    // Cancel pending exceptions for this payment
    await db.paymentRevenueException.updateMany({
      where: { paymentId, status: 'PENDING' },
      data: {
        status: 'RESOLVED',
        resolutionNotes: `Payment reversed: ${reversalReason}`,
        resolvedAt: new Date(),
        resolvedById: actorId,
      },
    });

    return reversedEntries;
  }

  // ==========================================
  // CONSOLIDATED STAFF VIEW
  // ==========================================

  async getStaffSalarySummary(staffId: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: {
        staffAssignments: {
          include: {
            class: true,
            subject: true,
            batch: true,
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff ${staffId} not found`);
    }

    // Fetch all ledger entries for this staff
    const ledgers = await this.prisma.staffSalaryLedger.findMany({
      where: { userId: staffId },
      include: {
        class: true,
        subject: true,
        assignment: true,
        payment: true,
        payout: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    let totalEarned = new Decimal(0);
    let totalAdjustments = new Decimal(0);
    let totalApproved = new Decimal(0);
    let totalPaid = new Decimal(0);

    // Grouping by assignment
    const assignmentMap = new Map<
      string,
      {
        assignmentId: string;
        className: string;
        classCode: string;
        subjectName: string;
        subjectCode: string;
        batchName: string | null;
        rule: string;
        rate: number;
        earned: Decimal;
        entriesCount: number;
      }
    >();

    for (const entry of ledgers) {
      if (entry.isReversed) {
        totalAdjustments = totalAdjustments.add(entry.earnedAmount);
      } else {
        totalEarned = totalEarned.add(entry.earnedAmount);

        if (entry.status === 'APPROVED') {
          totalApproved = totalApproved.add(entry.earnedAmount);
        } else if (entry.status === 'PAID') {
          totalPaid = totalPaid.add(entry.earnedAmount);
        }

        // Group by assignment
        const key = entry.assignmentId || `${entry.classId || 'FIXED'}_${entry.subjectId || 'GENERAL'}`;
        if (!assignmentMap.has(key)) {
          assignmentMap.set(key, {
            assignmentId: entry.assignmentId || 'N/A',
            className: entry.class?.name || (entry.compensationModel === 'FIXED_SALARY' ? 'Fixed Staff Salary' : 'General Academy Offering'),
            classCode: entry.class?.code || (entry.compensationModel === 'FIXED_SALARY' ? 'FIXED' : 'GEN'),
            subjectName: entry.subject?.name || (entry.compensationModel === 'FIXED_SALARY' ? 'Fixed Salary Term' : 'General / Course'),
            subjectCode: entry.subject?.code || (entry.compensationModel === 'FIXED_SALARY' ? 'FIX' : 'GEN'),
            batchName: entry.assignment?.batchId || null,
            rule: entry.ruleApplied,
            rate: Number(entry.staffPoolRate),
            earned: new Decimal(0),
            entriesCount: 0,
          });
        }
        const grp = assignmentMap.get(key)!;
        grp.earned = grp.earned.add(entry.earnedAmount);
        grp.entriesCount += 1;
      }
    }

    const outstandingPayable = totalEarned.sub(totalPaid);

    // Fetch payouts
    const payouts = await this.prisma.staffSalaryPayout.findMany({
      where: { userId: staffId },
      orderBy: { approvedAt: 'desc' },
      include: {
        approvedBy: { select: { firstName: true, lastName: true } },
        paidBy: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      staff: {
        id: staff.id,
        name: `${staff.firstName} ${staff.lastName}`,
        email: staff.email,
        phone: staff.phone,
        attendanceCode: staff.attendanceCode,
        staffCategory: staff.staffCategory,
        compensationModel: staff.compensationModel,
        fixedSalaryAmount: Number(staff.fixedSalaryAmount),
        payFrequency: staff.payFrequency,
        compensationEffectiveDate: staff.compensationEffectiveDate,
      },
      summary: {
        totalEarned: Number(totalEarned),
        totalAdjustments: Number(totalAdjustments),
        totalApproved: Number(totalApproved),
        totalPaid: Number(totalPaid),
        outstandingPayable: Number(outstandingPayable),
      },
      earningsByAssignment: Array.from(assignmentMap.values()).map((a) => ({
        ...a,
        earned: Number(a.earned),
      })),
      recentLedger: ledgers.slice(0, 50).map((l) => ({
        id: l.id,
        receiptNumber: l.receiptNumber,
        compensationModel: l.compensationModel,
        payPeriod: l.payPeriod,
        notes: l.notes,
        className: l.class?.name || (l.compensationModel === 'FIXED_SALARY' ? 'Fixed Staff Salary' : 'General Academy Offering'),
        subjectName: l.subject?.name || (l.compensationModel === 'FIXED_SALARY' ? 'Fixed Salary' : 'General'),
        collectedAmount: Number(l.collectedAmount),
        staffPoolRate: Number(l.staffPoolRate),
        earnedAmount: Number(l.earnedAmount),
        academyShareAmount: Number(l.academyShareAmount),
        ruleApplied: l.ruleApplied,
        status: l.status,
        isReversed: l.isReversed,
        reversalReason: l.reversalReason,
        createdAt: l.createdAt,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        payoutNumber: p.payoutNumber,
        totalAmount: Number(p.totalAmount),
        status: p.status,
        paymentMethod: p.paymentMethod,
        reference: p.reference,
        notes: p.notes,
        approvedAt: p.approvedAt,
        approvedBy: p.approvedBy ? `${p.approvedBy.firstName} ${p.approvedBy.lastName}` : null,
        paidAt: p.paidAt,
        paidBy: p.paidBy ? `${p.paidBy.firstName} ${p.paidBy.lastName}` : null,
        createdAt: p.approvedAt,
      })),
    };
  }

  // ==========================================
  // ACADEMY FINANCE DASHBOARD
  // ==========================================

  async getAcademyRevenueSummary() {
    // 1. Total successfully collected eligible fees
    const collectedAggregate = await this.prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const totalCollected = collectedAggregate._sum.amount || new Decimal(0);

    // 2. Staff ledger aggregates
    const activeLedgers = await this.prisma.staffSalaryLedger.findMany({
      where: { isReversed: false },
    });

    let facultyAccrued = new Decimal(0);
    let fixedAccrued = new Decimal(0);
    let facultyPaid = new Decimal(0);
    let fixedPaid = new Decimal(0);
    let academyShareAccrued = new Decimal(0);

    for (const l of activeLedgers) {
      if (l.compensationModel === 'FIXED_SALARY') {
        fixedAccrued = fixedAccrued.add(l.earnedAmount);
        if (l.status === 'PAID') {
          fixedPaid = fixedPaid.add(l.earnedAmount);
        }
      } else {
        facultyAccrued = facultyAccrued.add(l.earnedAmount);
        academyShareAccrued = academyShareAccrued.add(l.academyShareAmount);
        if (l.status === 'PAID') {
          facultyPaid = facultyPaid.add(l.earnedAmount);
        }
      }
    }

    const totalStaffAccrued = facultyAccrued.add(fixedAccrued);
    const totalStaffPaid = facultyPaid.add(fixedPaid);
    const outstandingFacultyPayable = facultyAccrued.sub(facultyPaid);
    const outstandingFixedPayable = fixedAccrued.sub(fixedPaid);
    const outstandingStaffPayable = totalStaffAccrued.sub(totalStaffPaid);

    // 3. Reversals & Refunds
    const reversalAggregate = await this.prisma.payment.aggregate({
      where: { status: 'REVERSED' },
      _sum: { amount: true },
    });
    const totalRefunded = reversalAggregate._sum?.amount || new Decimal(0);

    // 4. Unallocated exceptions
    const pendingExceptions = await this.prisma.paymentRevenueException.findMany({
      where: { status: 'PENDING' },
    });
    const unallocatedAmount = pendingExceptions.reduce(
      (sum, e) => sum.add(e.unallocatedAmount),
      new Decimal(0),
    );

    // 5. Config
    const config = await this.getSalaryConfig();

    return {
      metrics: {
        totalCollectedFees: Number(totalCollected),
        facultyCompensationAccrued: Number(facultyAccrued),
        facultyCompensationPaid: Number(facultyPaid),
        outstandingFacultyPayable: Number(outstandingFacultyPayable),
        fixedSalaryAccrued: Number(fixedAccrued),
        fixedSalaryPaid: Number(fixedPaid),
        outstandingFixedPayable: Number(outstandingFixedPayable),
        staffCompensationAccrued: Number(totalStaffAccrued),
        staffCompensationPaid: Number(totalStaffPaid),
        outstandingStaffPayable: Number(outstandingStaffPayable),
        academyShareAccrued: Number(academyShareAccrued),
        refundsAndReversals: Number(totalRefunded),
        unallocatedCollections: Number(unallocatedAmount),
        pendingExceptionsCount: pendingExceptions.length,
        configStaffPoolRate: config.defaultStaffPoolRate,
        configAcademyShareRate: config.defaultAcademyShareRate,
      },
      note: 'Academy revenue share (30%) represents gross top-line allocation prior to general academy overhead and operating expenses.',
    };
  }

  // ==========================================
  // LEDGER AUDIT LIST WITH FILTERS
  // ==========================================

  async getSalaryLedger(query: SalaryLedgerQueryDto) {
    const where: any = {};
    if (query.staffId) where.userId = query.staffId;
    if (query.compensationModel) where.compensationModel = query.compensationModel;
    if (query.payPeriod) where.payPeriod = query.payPeriod;
    if (query.classId) where.classId = query.classId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.status) where.status = query.status;
    if (query.isReversed !== undefined) where.isReversed = query.isReversed;

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const entries = await this.prisma.staffSalaryLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        class: { select: { name: true, code: true } },
        subject: { select: { name: true, code: true } },
        payment: { select: { receiptNumber: true, amount: true, paidAt: true } },
      },
    });

    return entries.map((e) => ({
      id: e.id,
      receiptNumber: e.receiptNumber,
      compensationModel: e.compensationModel,
      payPeriod: e.payPeriod,
      notes: e.notes,
      staffId: e.userId,
      staffName: `${e.user.firstName} ${e.user.lastName}`,
      staffEmail: e.user.email,
      className: e.class?.name || (e.compensationModel === 'FIXED_SALARY' ? 'Fixed Staff Salary' : 'General Academy Offering'),
      classCode: e.class?.code || (e.compensationModel === 'FIXED_SALARY' ? 'FIXED' : 'GEN'),
      subjectName: e.subject?.name || (e.compensationModel === 'FIXED_SALARY' ? 'Fixed Salary' : 'General'),
      subjectCode: e.subject?.code || null,
      collectedAmount: Number(e.collectedAmount),
      staffPoolRate: Number(e.staffPoolRate),
      academyShareRate: Number(e.academyShareRate),
      staffPoolAmount: Number(e.staffPoolAmount),
      academyShareAmount: Number(e.academyShareAmount),
      earnedAmount: Number(e.earnedAmount),
      ruleApplied: e.ruleApplied,
      status: e.status,
      isReversed: e.isReversed,
      reversalReason: e.reversalReason,
      createdAt: e.createdAt,
    }));
  }

  // ==========================================
  // PAYOUTS MANAGEMENT
  // ==========================================

  async createPayout(dto: CreatePayoutDto, actorId: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff ${dto.staffId} not found`);
    }

    const where: any = {
      userId: dto.staffId,
      isReversed: false,
      status: 'ACCRUED',
    };
    if (dto.ledgerIds && dto.ledgerIds.length > 0) {
      where.id = { in: dto.ledgerIds };
    }

    const ledgerEntries = await this.prisma.staffSalaryLedger.findMany({
      where,
    });

    if (ledgerEntries.length === 0) {
      throw new BadRequestException('No accrued earnings available for payout');
    }

    const totalAmount = ledgerEntries.reduce(
      (sum, l) => sum.add(l.earnedAmount),
      new Decimal(0),
    );

    return this.prisma.$transaction(async (tx) => {
      const payoutCount = await tx.staffSalaryPayout.count();
      const payoutNumber = `PAY-${new Date().getFullYear()}-${String(payoutCount + 1).padStart(5, '0')}`;

      const payout = await tx.staffSalaryPayout.create({
        data: {
          payoutNumber,
          userId: dto.staffId,
          totalAmount,
          status: 'APPROVED',
          paymentMethod: dto.paymentMethod || 'BANK_TRANSFER',
          reference: dto.reference,
          notes: dto.notes,
          approvedById: actorId,
          approvedAt: new Date(),
        },
      });

      // Update linked ledger items
      await tx.staffSalaryLedger.updateMany({
        where: { id: { in: ledgerEntries.map((l) => l.id) } },
        data: {
          payoutId: payout.id,
          payoutReference: payoutNumber,
          status: 'APPROVED',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_SALARY_PAYOUT_CREATED',
          entityType: 'StaffSalaryPayout',
          entityId: payout.id,
          details: {
            payoutNumber,
            staffId: dto.staffId,
            totalAmount: Number(totalAmount),
            entryCount: ledgerEntries.length,
          },
        },
      });

      return payout;
    });
  }

  async processPayout(payoutId: string, dto: ProcessPayoutDto, actorId: string) {
    const payout = await this.prisma.staffSalaryPayout.findUnique({
      where: { id: payoutId },
    });
    if (!payout) {
      throw new NotFoundException(`Payout ${payoutId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.action === 'PAY') {
        const updated = await tx.staffSalaryPayout.update({
          where: { id: payoutId },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paidById: actorId,
            ...(dto.transactionRef && { reference: dto.transactionRef }),
            ...(dto.notes && { notes: dto.notes }),
          },
        });

        await tx.staffSalaryLedger.updateMany({
          where: { payoutId },
          data: {
            status: 'PAID',
            payoutDate: new Date(),
          },
        });

        await tx.auditLog.create({
          data: {
            actorId,
            action: 'STAFF_SALARY_PAYOUT_EXECUTED',
            entityType: 'StaffSalaryPayout',
            entityId: payoutId,
            details: {
              payoutNumber: payout.payoutNumber,
              amount: Number(payout.totalAmount),
              ref: dto.transactionRef,
            },
          },
        });

        return updated;
      } else if (dto.action === 'CANCEL') {
        const updated = await tx.staffSalaryPayout.update({
          where: { id: payoutId },
          data: {
            status: 'CANCELLED',
            ...(dto.notes && { notes: dto.notes }),
          },
        });

        await tx.staffSalaryLedger.updateMany({
          where: { payoutId },
          data: {
            status: 'ACCRUED',
            payoutId: null,
            payoutReference: null,
          },
        });

        return updated;
      }

      return payout;
    });
  }

  // ==========================================
  // RECONCILIATION & EXCEPTIONS
  // ==========================================

  async getRevenueExceptions() {
    return this.prisma.paymentRevenueException.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        payment: {
          select: {
            receiptNumber: true,
            amount: true,
            paidAt: true,
            student: { select: { firstName: true, lastName: true, studentCode: true } },
          },
        },
      },
    });
  }

  async resolveRevenueException(
    exceptionId: string,
    dto: ResolveExceptionDto,
    actorId?: string,
  ) {
    const exc = await this.prisma.paymentRevenueException.findUnique({
      where: { id: exceptionId },
    });
    if (!exc) {
      throw new NotFoundException(`Exception ${exceptionId} not found`);
    }

    return this.prisma.paymentRevenueException.update({
      where: { id: exceptionId },
      data: {
        status: dto.status || 'RESOLVED',
        resolutionNotes: dto.resolutionNotes,
        resolvedById: actorId,
        resolvedAt: new Date(),
      },
    });
  }

  // ==========================================
  // FIXED SALARY ACCRUAL & MANUAL ADJUSTMENTS
  // ==========================================

  async accrueFixedSalaries(dto: AccrueFixedSalaryDto, actorId?: string) {
    const whereStaff: any = {
      compensationModel: 'FIXED_SALARY',
      status: 'ACTIVE',
    };
    if (dto.staffId) {
      whereStaff.id = dto.staffId;
    }

    const fixedStaffMembers = await this.prisma.user.findMany({
      where: whereStaff,
    });

    if (fixedStaffMembers.length === 0) {
      return {
        message: 'No active fixed salary staff found for accrual',
        accruedCount: 0,
        entries: [],
        skipped: [],
      };
    }

    const createdEntries = [];
    const skippedStaff = [];

    for (const staff of fixedStaffMembers) {
      const salaryAmount = staff.fixedSalaryAmount || new Decimal(0);
      if (salaryAmount.lte(0)) {
        skippedStaff.push({
          staffId: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          reason: 'FIXED_SALARY_AMOUNT_IS_ZERO',
        });
        continue;
      }

      // Check idempotency: check if already accrued for this payPeriod
      const existing = await this.prisma.staffSalaryLedger.findFirst({
        where: {
          userId: staff.id,
          compensationModel: 'FIXED_SALARY',
          payPeriod: dto.payPeriod,
          isReversed: false,
        },
      });

      if (existing) {
        skippedStaff.push({
          staffId: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          reason: `ALREADY_ACCRUED_FOR_PERIOD_${dto.payPeriod}`,
        });
        continue;
      }

      const cleanPeriod = dto.payPeriod.replace(/[^A-Za-z0-9]/g, '');
      const receiptNumber = `FIX-${staff.id.substring(0, 6).toUpperCase()}-${cleanPeriod}`;

      const entry = await this.prisma.staffSalaryLedger.create({
        data: {
          userId: staff.id,
          compensationModel: 'FIXED_SALARY',
          payPeriod: dto.payPeriod,
          notes: dto.notes || `Fixed salary accrual for ${dto.payPeriod}`,
          receiptNumber,
          collectedAmount: salaryAmount,
          staffPoolRate: new Decimal(100.0),
          academyShareRate: new Decimal(0.0),
          staffPoolAmount: salaryAmount,
          academyShareAmount: new Decimal(0.0),
          earnedAmount: salaryAmount,
          ruleApplied: 'FIXED_SALARY_ACCRUAL',
          status: 'ACCRUED',
        },
      });

      createdEntries.push(entry);
    }

    if (actorId && createdEntries.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_FIXED_SALARY_ACCRUED',
          entityType: 'StaffSalaryLedger',
          entityId: dto.payPeriod,
          details: {
            payPeriod: dto.payPeriod,
            accruedCount: createdEntries.length,
            totalAccruedAmount: createdEntries.reduce(
              (sum, e) => sum + Number(e.earnedAmount),
              0,
            ),
          },
        },
      });
    }

    return {
      message: `Successfully accrued fixed salaries for ${createdEntries.length} staff member(s)`,
      payPeriod: dto.payPeriod,
      accruedCount: createdEntries.length,
      skippedCount: skippedStaff.length,
      entries: createdEntries.map((e) => ({
        id: e.id,
        staffId: e.userId,
        payPeriod: e.payPeriod,
        receiptNumber: e.receiptNumber,
        earnedAmount: Number(e.earnedAmount),
        status: e.status,
      })),
      skipped: skippedStaff,
    };
  }

  async createSalaryAdjustment(dto: CreateSalaryAdjustmentDto, actorId: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff ${dto.staffId} not found`);
    }

    const rawAmount = new Decimal(Math.abs(dto.amount));
    if (rawAmount.lte(0)) {
      throw new BadRequestException('Adjustment amount must be greater than zero');
    }

    // Deduction is negative, Bonus/Adjustment is positive
    const earnedAmount = dto.type === 'DEDUCTION' ? rawAmount.negated() : rawAmount;
    const receiptNumber = `ADJ-${staff.id.substring(0, 6).toUpperCase()}-${Date.now().toString().slice(-6)}`;

    const entry = await this.prisma.staffSalaryLedger.create({
      data: {
        userId: staff.id,
        compensationModel: staff.compensationModel,
        payPeriod: dto.payPeriod || null,
        notes: `${dto.type}: ${dto.reason}${dto.notes ? ` - ${dto.notes}` : ''}`,
        receiptNumber,
        collectedAmount: rawAmount,
        staffPoolRate: new Decimal(100.0),
        academyShareRate: new Decimal(0.0),
        staffPoolAmount: earnedAmount,
        academyShareAmount: new Decimal(0.0),
        earnedAmount,
        ruleApplied: `MANUAL_${dto.type}`,
        status: 'ACCRUED',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'STAFF_SALARY_ADJUSTMENT_CREATED',
        entityType: 'StaffSalaryLedger',
        entityId: entry.id,
        details: {
          staffId: dto.staffId,
          type: dto.type,
          amount: Number(earnedAmount),
          reason: dto.reason,
        },
      },
    });

    return {
      id: entry.id,
      staffId: entry.userId,
      receiptNumber: entry.receiptNumber,
      type: dto.type,
      earnedAmount: Number(entry.earnedAmount),
      notes: entry.notes,
      status: entry.status,
      createdAt: entry.createdAt,
    };
  }
}
