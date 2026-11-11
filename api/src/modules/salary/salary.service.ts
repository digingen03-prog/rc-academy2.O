import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
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
  AccrueFacultyMonthlySalaryDto,
  CreateSalaryAdjustmentDto,
} from './dto/salary.dto';
import {
  calculateStaffSettlement,
  calculateMonthlySalaryProration,
  StudentTier,
} from '../staff/staff-settlement.helper';

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

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
  // AMOUNT-BASED ENROLLMENT ACCRUAL & PAYMENT REALIZATION
  // ==========================================

  /**
   * Accrues fixed staff compensation per student enrollment.
   * Entitlement is fixed amount owed per enrolled student based on compensationRule.config[tier].value.
   * Wraps in a Serializable transaction to avoid races, catching P2002 for idempotency.
   */
  async accrueForEnrollment(
    params: {
      studentId: string;
      classId: string;
      batchId?: string;
      studentTier?: StudentTier;
      enrollmentDate?: Date;
      payPeriod?: string;
    },
    existingTx?: Prisma.TransactionClient,
  ) {
    const runWork = async (tx: Prisma.TransactionClient) => {
      const {
        studentId,
        classId,
        batchId,
        enrollmentDate = new Date(),
      } = params;

      const payPeriod =
        params.payPeriod ||
        `${enrollmentDate.getFullYear()}-${String(enrollmentDate.getMonth() + 1).padStart(2, '0')}`;

      // 0. Verify student eligibility: student must be active
      if ((tx as any).student?.findUnique) {
        const student = await (tx as any).student.findUnique({
          where: { id: studentId },
          select: { id: true, status: true },
        });
        if (student && ['WITHDRAWN', 'INACTIVE', 'DROPPED'].includes(student.status)) {
          this.logger.debug(
            `Student ${studentId} is not active (status: ${student.status}). Skipping faculty entitlement accrual.`,
          );
          return [];
        }
      }

      // 1. Determine student tier if not provided
      let studentTier: StudentTier = params.studentTier || 'ALL';
      let studentEnrolledSubjectIds = new Set<string>();
      let hasAllSubjectsBatchEnrollment = false;

      if ((tx as any).studentBatchEnrollment?.findMany) {
        const classEnrollments = await (tx as any).studentBatchEnrollment.findMany({
          where: {
            studentId,
            isActive: true,
            batch: { classId },
          },
          select: { subjectId: true },
        });

        if (Array.isArray(classEnrollments)) {
          hasAllSubjectsBatchEnrollment = classEnrollments.some((e: any) => !e.subjectId);
          classEnrollments.forEach((e: any) => {
            if (e.subjectId) studentEnrolledSubjectIds.add(e.subjectId);
          });
        }
      }

      if (!params.studentTier) {
        // Priority A: Inspect explicit student FeeInvoice and CourseFeeConfig
        let explicitTierFound = false;
        if ((tx as any).feeInvoice?.findFirst) {
          const studentInvoice = await (tx as any).feeInvoice.findFirst({
            where: { studentId, classId },
            include: { courseFeeConfig: true },
            orderBy: { createdAt: 'desc' },
          });

          if (studentInvoice?.courseFeeConfig) {
            const cfg = studentInvoice.courseFeeConfig;
            const allowedDiscounts = Array.isArray(cfg.allowedDiscounts)
              ? (cfg.allowedDiscounts as any[])
              : [];
            const tierDiscount = allowedDiscounts.find(
              (d: any) =>
                d &&
                (d.tier ||
                  d.type === 'TWO_SUBJECTS_BUNDLE' ||
                  d.type === 'SINGLE_SUBJECT' ||
                  d.type === 'ALL_SUBJECTS_BUNDLE'),
            );

            if (
              tierDiscount?.tier === 'TWO_SUBJECTS' ||
              tierDiscount?.type === 'TWO_SUBJECTS_BUNDLE' ||
              cfg.name?.toLowerCase().includes('2 subject') ||
              cfg.name?.toLowerCase().includes('2 course')
            ) {
              studentTier = 'TWO_SUBJECTS';
              explicitTierFound = true;
            } else if (
              tierDiscount?.tier === 'SINGLE_SUBJECT' ||
              tierDiscount?.type === 'SINGLE_SUBJECT' ||
              cfg.subjectId ||
              cfg.name?.toLowerCase().includes('1 subject') ||
              cfg.name?.toLowerCase().includes('1 course')
            ) {
              studentTier = 'SINGLE';
              explicitTierFound = true;
            } else if (
              tierDiscount?.tier === 'ALL' ||
              tierDiscount?.type === 'ALL_SUBJECTS_BUNDLE'
            ) {
              studentTier = 'ALL';
              explicitTierFound = true;
            }
          }

          if (!explicitTierFound && studentInvoice?.configurationSnapshot) {
            const snapshot = studentInvoice.configurationSnapshot as any;
            if (snapshot.tier) {
              studentTier =
                snapshot.tier === 'TWO_SUBJECTS'
                  ? 'TWO_SUBJECTS'
                  : snapshot.tier === 'SINGLE_SUBJECT' || snapshot.tier === 'SINGLE'
                  ? 'SINGLE'
                  : 'ALL';
              explicitTierFound = true;
            }
          }
        }

        // Priority B: If no explicit invoice fee tier, determine from active enrolled subjects
        if (!explicitTierFound) {
          if (hasAllSubjectsBatchEnrollment || studentEnrolledSubjectIds.size >= 3 || studentEnrolledSubjectIds.size === 0) {
            studentTier = 'ALL';
          } else if (studentEnrolledSubjectIds.size === 2) {
            studentTier = 'TWO_SUBJECTS';
          } else if (studentEnrolledSubjectIds.size === 1) {
            studentTier = 'SINGLE';
          }
        }
      }

      // 2. Find active teaching assignments for this class (effective at enroll date)
      const assignments = await tx.staffCourseAssignment.findMany({
        where: {
          classId,
          isActive: true,
          effectiveFrom: { lte: enrollmentDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: enrollmentDate } },
          ],
        },
      });

      const createdLedgers: any[] = [];

      for (const assign of assignments) {
        try {
          // If the assignment is subject-specific:
          // A student only generates allocations for faculty assigned to subjects they are enrolled in.
          if (assign.subjectId) {
            if (
              !hasAllSubjectsBatchEnrollment &&
              studentTier !== 'ALL' &&
              studentEnrolledSubjectIds.size > 0 &&
              !studentEnrolledSubjectIds.has(assign.subjectId)
            ) {
              this.logger.debug(
                `Student ${studentId} is not enrolled in subject ${assign.subjectId} for staff ${assign.userId}. Skipping accrual.`,
              );
              continue;
            }
          }
          // Pre-check idempotency guard (PostgreSQL null-uniqueness resilient)
          if ((tx as any).staffAccrualLedger?.findFirst) {
            const existingAccrual = await (tx as any).staffAccrualLedger.findFirst({
              where: {
                staffId: assign.userId,
                assignmentId: assign.id,
                studentId,
                payPeriod,
                type: 'ACCRUAL',
              },
              select: { id: true, amount: true },
            });

            if (existingAccrual) {
              this.logger.debug(
                `StaffAccrualLedger already exists for staff ${assign.userId}, student ${studentId}, period ${payPeriod}. Skipping duplicate accrual.`,
              );
              continue;
            }
          }

          const calc = calculateStaffSettlement({
            compensationRule: assign.compensationRule,
            studentTier,
            collectedAmount: new Decimal(0),
          });

          const ledger = await tx.staffAccrualLedger.create({
            data: {
              staffId: assign.userId,
              assignmentId: assign.id,
              studentId,
              invoiceId: null,
              payPeriod,
              type: 'ACCRUAL',
              tier: calc.tierUsed,
              amount: calc.staffPoolAmount,
              studentFeePaid: new Decimal(0),
              occurredAt: enrollmentDate,
              note: `Accrual for ${assign.role || 'TEACHER'} in course ${classId} (${payPeriod})`,
            },
          });
          createdLedgers.push(ledger);
        } catch (err: any) {
          // Idempotency: catch P2002 unique constraint violation and skip
          if (err.code === 'P2002') {
            this.logger.debug(
              `StaffAccrualLedger already exists for staff ${assign.userId}, student ${studentId}, period ${payPeriod}. Skipping.`,
            );
            continue;
          }
          throw err;
        }
      }

      return createdLedgers;
    };

    if (existingTx) {
      return runWork(existingTx);
    } else {
      return this.prisma.$transaction(runWork, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    }
  }

  /**
   * Updates StaffAccrualLedger with studentFeePaid when payment is allocated.
   * If payment is bounced / reversed, creates a REVERSAL ledger entry with amount = 0 (entitlement unchanged).
   * Emits audit log events PAYMENT_RECEIVED_FOR_STAFF_ACCRUAL and REVERSAL_LOGGED.
   */
  async accrueForPayment(
    params: {
      paymentId: string;
      studentId: string;
      allocatedAmount: Decimal | number;
      invoiceId?: string;
      isReversal?: boolean;
      reversalReason?: string;
      payPeriod?: string;
    },
    existingTx?: Prisma.TransactionClient,
  ) {
    const runWork = async (tx: Prisma.TransactionClient) => {
      const {
        paymentId,
        studentId,
        allocatedAmount,
        invoiceId,
        isReversal = false,
        reversalReason,
      } = params;

      const allocDecimal = new Decimal(allocatedAmount);

      const where: Prisma.StaffAccrualLedgerWhereInput = {
        studentId,
        type: 'ACCRUAL',
      };
      if (params.payPeriod) {
        where.payPeriod = params.payPeriod;
      }

      let existingAccruals = await tx.staffAccrualLedger.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
      });

      // If no accruals exist yet for this student/payPeriod when payment arrives, auto-accrue from active enrollments
      if (existingAccruals.length === 0 && !isReversal && (tx as any).studentBatchEnrollment?.findMany) {
        const activeEnrollments = await (tx as any).studentBatchEnrollment.findMany({
          where: { studentId, isActive: true },
          include: { batch: true },
        });
        if (Array.isArray(activeEnrollments) && activeEnrollments.length > 0) {
          const targetPayPeriod =
            params.payPeriod ||
            `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const distinctClassIds = Array.from(
            new Set(activeEnrollments.map((e: any) => e.batch?.classId).filter(Boolean)),
          ) as string[];
          for (const classId of distinctClassIds) {
            await this.accrueForEnrollment(
              {
                studentId,
                classId,
                payPeriod: targetPayPeriod,
              },
              tx,
            );
          }
          existingAccruals = await tx.staffAccrualLedger.findMany({
            where: {
              ...where,
              payPeriod: targetPayPeriod,
            },
            orderBy: { occurredAt: 'desc' },
          });
        }
      }

      if (isReversal) {
        // Create REVERSAL ledger entry with amount = 0 (entitlement unchanged)
        const createdReversals: any[] = [];
        for (const ledger of existingAccruals) {
          try {
            // Check for duplicate reversal request on same payment
            if ((tx as any).staffAccrualLedger?.findFirst) {
              const alreadyReversed = await (tx as any).staffAccrualLedger.findFirst({
                where: {
                  staffId: ledger.staffId,
                  studentId: ledger.studentId,
                  type: 'REVERSAL',
                  note: { contains: paymentId },
                },
              });
              if (alreadyReversed) {
                this.logger.debug(
                  `Payment ${paymentId} already reversed for staff ${ledger.staffId}. Skipping duplicate reversal.`,
                );
                continue;
              }
            }

            const currentPaid = new Decimal(ledger.studentFeePaid || 0);
            const decrementedPaid = Decimal.max(0, currentPaid.sub(allocDecimal));

            // Decrement realized collection reference on accrual ledger
            await tx.staffAccrualLedger.update({
              where: { id: ledger.id },
              data: { studentFeePaid: decrementedPaid },
            });

            const reversal = await tx.staffAccrualLedger.create({
              data: {
                staffId: ledger.staffId,
                assignmentId: ledger.assignmentId,
                studentId: ledger.studentId,
                invoiceId: invoiceId || ledger.invoiceId,
                payPeriod: ledger.payPeriod,
                type: 'REVERSAL',
                tier: ledger.tier,
                amount: new Decimal(0), // Business Rule 4: Entitlement remains unchanged
                studentFeePaid: new Decimal(0),
                occurredAt: new Date(),
                note: reversalReason
                  ? `${reversalReason} (Payment: ${paymentId})`
                  : `Payment bounced / reversed (Payment: ${paymentId})`,
              },
            });
            createdReversals.push(reversal);

            await tx.auditLog.create({
              data: {
                action: 'REVERSAL_LOGGED',
                entityType: 'StaffAccrualLedger',
                entityId: ledger.id,
                details: {
                  paymentId,
                  studentId: ledger.studentId,
                  staffId: ledger.staffId,
                  reversalReason,
                  amount: 0,
                  entitlementPreserved: ledger.amount.toNumber(),
                  previousFeePaid: currentPaid.toNumber(),
                  newFeePaid: decrementedPaid.toNumber(),
                },
              },
            });
          } catch (err: any) {
            if (err.code === 'P2002') continue;
            throw err;
          }
        }
        return { reversals: createdReversals };
      } else {
        // Payment allocation: Update studentFeePaid on existing ACCRUAL ledgers
        const updatedLedgers: any[] = [];
        for (const ledger of existingAccruals) {
          const currentPaid = new Decimal(ledger.studentFeePaid || 0);
          const newPaid = currentPaid.add(allocDecimal);

          const updated = await tx.staffAccrualLedger.update({
            where: { id: ledger.id },
            data: {
              studentFeePaid: newPaid,
              invoiceId: invoiceId || ledger.invoiceId,
            },
          });
          updatedLedgers.push(updated);

          await tx.auditLog.create({
            data: {
              action: 'PAYMENT_RECEIVED_FOR_STAFF_ACCRUAL',
              entityType: 'StaffAccrualLedger',
              entityId: ledger.id,
              details: {
                paymentId,
                studentId: ledger.studentId,
                staffId: ledger.staffId,
                allocatedAmount: allocDecimal.toNumber(),
                previousFeePaid: currentPaid.toNumber(),
                newFeePaid: newPaid.toNumber(),
              },
            },
          });
        }
        return { updated: updatedLedgers };
      }
    };

    if (existingTx) {
      return runWork(existingTx);
    } else {
      return this.prisma.$transaction(runWork, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    }
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

        // Determine student's enrolled subject count / tier for this class
        const totalClassSubjectsCount = await db.subject.count({
          where: { classId },
        });
        const studentClassEnrollments = payment.student.batchEnrollments.filter(
          (be) => be.batch?.classId === classId && be.isActive !== false,
        );
        const studentSubCount = studentClassEnrollments.filter((be) => be.subjectId).length;

        let studentTier: 'ALL' | 'TWO_SUBJECTS' | 'SINGLE_SUBJECT' = 'ALL';
        if (totalClassSubjectsCount > 0 && studentSubCount >= totalClassSubjectsCount) {
          studentTier = 'ALL';
        } else if (studentSubCount === 2) {
          studentTier = 'TWO_SUBJECTS';
        } else if (studentSubCount === 1) {
          studentTier = 'SINGLE_SUBJECT';
        } else if (studentClassEnrollments.length >= 3 || studentSubCount >= 3) {
          studentTier = 'ALL';
        } else {
          studentTier = 'ALL';
        }

        for (const assign of assignments) {
          const calc = calculateStaffSettlement({
            compensationRule: assign.compensationRule,
            defaultStaffRate: assign.staffSharePercentage || defaultStaffRate,
            collectedAmount: poolFraction,
            studentTier,
          });

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
              collectedAmount: poolFraction.toDecimalPlaces(2),
              staffPoolRate: calc.staffPoolRate,
              academyShareRate: calc.academyShareRate,
              academyShareAmount: calc.academyShareAmount,
              staffPoolAmount: calc.staffPoolAmount,
              earnedAmount: calc.earnedAmount,
              ruleApplied: calc.ruleApplied,
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

          // Determine tier for this line
          let lineTier: 'ALL' | 'TWO_SUBJECTS' | 'SINGLE_SUBJECT' = 'ALL';
          if (matchedLines.length === 1 && line.subjectId) {
            lineTier = 'SINGLE_SUBJECT';
          } else if (matchedLines.length === 2) {
            lineTier = 'TWO_SUBJECTS';
          } else if (matchedLines.length >= 3) {
            lineTier = 'ALL';
          } else if (line.subjectId) {
            lineTier = 'SINGLE_SUBJECT';
          }

          const splitPerTeacher = lineFraction.div(assignments.length);
          for (const assign of assignments) {
            const calc = calculateStaffSettlement({
              compensationRule: assign.compensationRule,
              defaultStaffRate: assign.staffSharePercentage || defaultStaffRate,
              collectedAmount: splitPerTeacher,
              studentTier: lineTier,
            });

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
                staffPoolRate: calc.staffPoolRate,
                academyShareRate: calc.academyShareRate,
                academyShareAmount: calc.academyShareAmount,
                staffPoolAmount: calc.staffPoolAmount,
                earnedAmount: calc.earnedAmount,
                ruleApplied: calc.ruleApplied,
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
  // EXECUTIVE FINANCE ANALYTICS (SUPER ADMIN)
  // ==========================================

  async getFinanceExecutiveAnalytics() {
    const now = new Date();

    // 1. Fee Invoices Aggregates
    const invoiceAgg = await this.prisma.feeInvoice.aggregate({
      where: { status: { not: 'CANCELLED' } },
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
        discountAmount: true,
      },
      _count: { id: true },
    });

    const overdueAgg = await this.prisma.feeInvoice.aggregate({
      where: {
        status: { in: ['UNPAID', 'PARTIAL'] },
        dueDate: { lt: now },
      },
      _sum: { balanceAmount: true },
      _count: { id: true },
    });

    // 2. Payments & Collections
    const payments = await this.prisma.payment.findMany({
      orderBy: { paidAt: 'desc' },
    });

    let totalCollected = new Decimal(0);
    let totalReversed = new Decimal(0);
    let cashCollected = new Decimal(0);
    let upiCollected = new Decimal(0);
    let otherCollected = new Decimal(0);
    let cashCount = 0;
    let upiCount = 0;
    let otherCount = 0;

    for (const p of payments) {
      if (p.status === 'COMPLETED') {
        totalCollected = totalCollected.add(p.amount);
        if (p.paymentMethod === 'CASH') {
          cashCollected = cashCollected.add(p.amount);
          cashCount++;
        } else if (p.paymentMethod === 'UPI') {
          upiCollected = upiCollected.add(p.amount);
          upiCount++;
        } else {
          otherCollected = otherCollected.add(p.amount);
          otherCount++;
        }
      } else if (p.status === 'REVERSED') {
        totalReversed = totalReversed.add(p.amount);
      }
    }

    // 3. Staff Salary Ledgers & Liabilities
    const activeLedgers = await this.prisma.staffSalaryLedger.findMany({
      where: { isReversed: false },
    });

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const activeAccruals = await this.prisma.staffAccrualLedger.findMany({
      where: {
        type: 'ACCRUAL',
        payPeriod: currentMonth,
      },
    });

    let facultyAccrued = new Decimal(0);
    let facultyPaid = new Decimal(0);
    let fixedAccrued = new Decimal(0);
    let fixedPaid = new Decimal(0);
    let academyShareAccrued = new Decimal(0);

    const ledgerStaffIds = new Set<string>();

    for (const l of activeLedgers) {
      ledgerStaffIds.add(l.userId);
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

    // Include any faculty/staff from activeAccruals who don't have activeLedgers yet
    for (const a of activeAccruals) {
      if (!ledgerStaffIds.has(a.staffId)) {
        facultyAccrued = facultyAccrued.add(a.amount);
      }
    }

    const totalStaffAccrued = facultyAccrued.add(fixedAccrued);
    const totalStaffPaid = facultyPaid.add(fixedPaid);
    const pendingStaffSettlement = totalStaffAccrued.sub(totalStaffPaid);

    // 4. Expenses & Net Profitability
    const totalExpensesPaid = totalStaffPaid.add(totalReversed);
    const netAcademyProfit = totalCollected.sub(totalStaffAccrued).sub(totalReversed);
    const grossInvoiced = invoiceAgg._sum.totalAmount || new Decimal(0);
    const grossBalance = invoiceAgg._sum.balanceAmount || new Decimal(0);
    const totalDiscounts = invoiceAgg._sum.discountAmount || new Decimal(0);

    const profitMargin = totalCollected.gt(0)
      ? Math.round((netAcademyProfit.toNumber() / totalCollected.toNumber()) * 100)
      : 0;

    const collectionEfficiency = grossInvoiced.gt(0)
      ? Math.round((totalCollected.toNumber() / grossInvoiced.toNumber()) * 100)
      : 0;

    // 5. Monthly trend calculation (last 6 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = new Map<string, { month: string; collected: number; payouts: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthlyMap.set(key, { month: key, collected: 0, payouts: 0 });
    }

    for (const p of payments) {
      if (p.status === 'COMPLETED' && p.paidAt) {
        const d = new Date(p.paidAt);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlyMap.has(key)) {
          monthlyMap.get(key)!.collected += Number(p.amount);
        }
      }
    }

    for (const l of activeLedgers) {
      if (l.status === 'PAID' && l.payoutDate) {
        const d = new Date(l.payoutDate);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        if (monthlyMap.has(key)) {
          monthlyMap.get(key)!.payouts += Number(l.earnedAmount);
        }
      }
    }

    // 6. Course Revenue Breakdown
    const classes = await this.prisma.class.findMany({
      include: {
        feeInvoices: {
          where: { status: { not: 'CANCELLED' } },
        },
      },
    });

    const courseBreakdown = classes.map((c) => {
      let invoiced = 0;
      let paid = 0;
      let balance = 0;
      for (const inv of c.feeInvoices) {
        invoiced += Number(inv.totalAmount);
        paid += Number(inv.paidAmount);
        balance += Number(inv.balanceAmount);
      }
      return {
        classId: c.id,
        className: c.name,
        code: c.code,
        invoiced,
        paid,
        balance,
        collectionRate: invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0,
      };
    });

    // 7. Recent Payouts
    const recentPayouts = await this.prisma.staffSalaryPayout.findMany({
      take: 6,
      orderBy: { approvedAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return {
      kpis: {
        totalCollected: totalCollected.toNumber(),
        netCollections: totalCollected.sub(totalReversed).toNumber(),
        totalInvoiced: grossInvoiced.toNumber(),
        totalOutstanding: grossBalance.toNumber(),
        overdueAmount: (overdueAgg._sum.balanceAmount || new Decimal(0)).toNumber(),
        totalDiscounts: totalDiscounts.toNumber(),
        totalReversals: totalReversed.toNumber(),

        // Staff Settlements
        facultyAccrued: facultyAccrued.toNumber(),
        facultyPaid: facultyPaid.toNumber(),
        fixedAccrued: fixedAccrued.toNumber(),
        fixedPaid: fixedPaid.toNumber(),
        totalStaffAccrued: totalStaffAccrued.toNumber(),
        totalStaffPaid: totalStaffPaid.toNumber(),
        pendingStaffSettlement: pendingStaffSettlement.toNumber(),
        academyShareAccrued: academyShareAccrued.toNumber(),

        // Expenses & Profit
        totalExpensesPaid: totalExpensesPaid.toNumber(),
        netAcademyProfit: netAcademyProfit.toNumber(),
        profitMargin,
        collectionEfficiency,

        invoicesCount: invoiceAgg._count.id || 0,
        paymentsCount: payments.filter((p) => p.status === 'COMPLETED').length,
        overdueCount: overdueAgg._count.id || 0,
      },
      paymentMethods: {
        cash: { amount: cashCollected.toNumber(), count: cashCount },
        upi: { amount: upiCollected.toNumber(), count: upiCount },
        other: { amount: otherCollected.toNumber(), count: otherCount },
      },
      monthlyTrends: Array.from(monthlyMap.values()),
      courseBreakdown,
      recentPayouts: recentPayouts.map((p) => {
        const cleanLast = p.user.lastName && p.user.lastName !== '.' && p.user.lastName !== '-' ? p.user.lastName : '';
        return {
          id: p.id,
          payoutNumber: p.payoutNumber,
          staffName: [p.user.firstName, cleanLast].filter(Boolean).join(' ').trim(),
          amount: Number(p.totalAmount),
          status: p.status,
          method: p.paymentMethod,
          date: p.paidAt || p.approvedAt,
        };
      }),
    };
  }

  // ==========================================
  // STAFF SETTLEMENTS OVERVIEW
  // ==========================================

  async getStaffSettlementsOverview() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const staffUsers = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { userRoles: { some: { role: { name: { in: ['TEACHER', 'STAFF', 'ACADEMY_ADMIN', 'ACCOUNTANT'] } } } } },
          { staffSalaryLedgers: { some: {} } },
          { staffAssignments: { some: {} } },
          { fixedSalaryAmount: { gt: 0 } },
        ],
      },
      include: {
        userRoles: { include: { role: true } },
        staffAssignments: {
          include: { class: true, subject: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    const activeLedgers = await this.prisma.staffSalaryLedger.findMany({
      where: { isReversed: false },
    });

    const activeAccruals = await this.prisma.staffAccrualLedger.findMany({
      where: {
        type: 'ACCRUAL',
        payPeriod: currentMonth,
      },
    });

    const userLedgerMap = new Map<
      string,
      { accrued: Decimal; paid: Decimal; pending: Decimal; count: number; models: Set<string> }
    >();

    for (const l of activeLedgers) {
      if (!userLedgerMap.has(l.userId)) {
        userLedgerMap.set(l.userId, {
          accrued: new Decimal(0),
          paid: new Decimal(0),
          pending: new Decimal(0),
          count: 0,
          models: new Set(),
        });
      }
      const agg = userLedgerMap.get(l.userId)!;
      agg.accrued = agg.accrued.add(l.earnedAmount);
      agg.count += 1;
      agg.models.add(l.compensationModel);
      if (l.status === 'PAID') {
        agg.paid = agg.paid.add(l.earnedAmount);
      } else {
        agg.pending = agg.pending.add(l.earnedAmount);
      }
    }

    return staffUsers.map((u) => {
      const agg = userLedgerMap.get(u.id) || {
        accrued: new Decimal(0),
        paid: new Decimal(0),
        pending: new Decimal(0),
        count: 0,
        models: new Set<string>(),
      };

      const userJoinDate = u.dateOfJoining || u.compensationEffectiveDate || u.createdAt;
      let isProrated = false;
      let daysWorked = 30;
      let daysInMonth = 30;
      let fullSalaryAmount = u.fixedSalaryAmount ? Number(u.fixedSalaryAmount) : 0;

      // Check accrual ledgers and joining date proration
      const userAccruals = activeAccruals.filter((a) => a.staffId === u.id);
      if (userAccruals.length > 0) {
        const accruedSum = userAccruals.reduce((sum, a) => sum + Number(a.amount || 0), 0);
        if (accruedSum > agg.accrued.toNumber()) {
          const diff = new Decimal(accruedSum).sub(agg.accrued);
          agg.accrued = new Decimal(accruedSum);
          agg.pending = agg.pending.add(diff);
        }
      } else if (agg.accrued.toNumber() === 0 && u.fixedSalaryAmount && Number(u.fixedSalaryAmount) > 0) {
        const proration = calculateMonthlySalaryProration(
          Number(u.fixedSalaryAmount),
          userJoinDate,
          currentMonth,
        );
        agg.accrued = new Decimal(proration.proratedSalary);
        agg.pending = new Decimal(proration.proratedSalary);
        isProrated = proration.isProrated;
        daysWorked = proration.daysWorked;
        daysInMonth = proration.daysInMonth;
        fullSalaryAmount = proration.fullMonthlySalary;
      }

      const model =
        agg.models.size > 0
          ? Array.from(agg.models).join(', ')
          : u.compensationModel || 'REVENUE_SHARING';

      const roles = u.userRoles.map((r) => r.role.name);
      const cleanLast = u.lastName && u.lastName !== '.' && u.lastName !== '-' ? u.lastName : '';
      const displayName = [u.firstName, cleanLast].filter(Boolean).join(' ').trim() || u.email;

      return {
        staffId: u.id,
        name: displayName,
        email: u.email,
        roles,
        designation: u.designation || (roles.includes('TEACHER') ? 'Faculty Member' : 'Academy Staff'),
        compensationModel: model,
        fixedSalaryAmount: u.fixedSalaryAmount ? Number(u.fixedSalaryAmount) : null,
        assignedCoursesCount: u.staffAssignments.length,
        totalEarned: agg.accrued.toNumber(),
        totalPaid: agg.paid.toNumber(),
        pendingSettlement: agg.pending.toNumber(),
        unsettledEntriesCount: activeLedgers.filter((l) => l.userId === u.id && l.status !== 'PAID').length,
        hasPendingSettlement: agg.pending.gt(0),
        dateOfJoining: userJoinDate,
        isProrated,
        daysWorked,
        daysInMonth,
        fullSalaryAmount,
      };
    });
  }

  // ==========================================
  // ALL PAYOUTS LIST
  // ==========================================

  async getAllPayouts(query?: { status?: string; staffId?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.staffId) where.userId = query.staffId;

    const payouts = await this.prisma.staffSalaryPayout.findMany({
      where,
      orderBy: { approvedAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { firstName: true, lastName: true, email: true } },
        paidBy: { select: { firstName: true, lastName: true, email: true } },
        ledgerEntries: {
          select: {
            id: true,
            receiptNumber: true,
            payPeriod: true,
            compensationModel: true,
            earnedAmount: true,
          },
        },
      },
    });

    return payouts.map((p) => ({
      id: p.id,
      payoutNumber: p.payoutNumber,
      staffId: p.userId,
      staffName: `${p.user.firstName} ${p.user.lastName}`,
      staffEmail: p.user.email,
      totalAmount: Number(p.totalAmount),
      status: p.status,
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      notes: p.notes,
      approvedAt: p.approvedAt,
      approvedBy: `${p.approvedBy.firstName} ${p.approvedBy.lastName}`,
      paidAt: p.paidAt,
      paidBy: p.paidBy ? `${p.paidBy.firstName} ${p.paidBy.lastName}` : null,
      entriesCount: p.ledgerEntries.length,
    }));
  }

  // ==========================================
  // DIRECT SETTLE STAFF (ONE-CLICK)
  // ==========================================

  async directSettleStaff(
    dto: {
      staffId: string;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      ledgerIds?: string[];
    },
    actorId: string,
  ) {
    const payout = await this.createPayout(
      {
        staffId: dto.staffId,
        paymentMethod: dto.paymentMethod,
        reference: dto.reference,
        notes: dto.notes,
        ledgerIds: dto.ledgerIds,
      },
      actorId,
    );

    return this.processPayout(
      payout.id,
      {
        action: 'PAY',
        transactionRef: dto.reference,
        notes: dto.notes,
      },
      actorId,
    );
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

  /**
   * Recurrent monthly/term billing period accrual for teaching faculty.
   * Scans active enrolled students and creates idempotent StaffAccrualLedger rows.
   */
  async accrueMonthlyFacultyEntitlements(
    dto: AccrueFacultyMonthlySalaryDto,
    actorId?: string,
  ) {
    const { payPeriod, classId, subjectId } = dto;

    const whereEnrollment: any = {
      isActive: true,
      student: {
        status: { in: ['ACTIVE', 'ENROLLED'] },
      },
    };
    if (classId) {
      whereEnrollment.batch = { classId };
    }
    if (subjectId) {
      whereEnrollment.subjectId = subjectId;
    }

    const activeEnrollments = await this.prisma.studentBatchEnrollment.findMany({
      where: whereEnrollment,
      include: {
        student: true,
        batch: { include: { class: true } },
      },
    });

    const accrued: any[] = [];
    const skipped: any[] = [];

    for (const enroll of activeEnrollments) {
      const clsId = enroll.batch?.classId;
      if (!clsId) continue;

      const results = await this.accrueForEnrollment({
        studentId: enroll.studentId,
        classId: clsId,
        batchId: enroll.batchId,
        payPeriod,
      });

      if (results.length > 0) {
        accrued.push(...results);
      } else {
        skipped.push({ studentId: enroll.studentId, classId: clsId });
      }
    }

    if (actorId && accrued.length > 0) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'FACULTY_MONTHLY_ENTITLEMENTS_ACCRUED',
          entityType: 'StaffAccrualLedger',
          entityId: payPeriod,
          details: {
            payPeriod,
            classId,
            subjectId,
            accruedCount: accrued.length,
            totalAccruedAmount: accrued.reduce(
              (sum, e) => sum + Number(e.amount),
              0,
            ),
          },
        },
      });
    }

    return {
      message: `Monthly faculty accrual processed for period ${payPeriod}`,
      payPeriod,
      accruedCount: accrued.length,
      skippedCount: skipped.length,
      accrued,
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
