import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AttendanceCodeService,
  AttendanceCodeEntityType,
} from '../attendance/attendance-code.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  EnrollStudentDto,
  RecordAdvanceDto,
  AllocateAdvanceDto,
  BulkImportRowDto,
  BulkValidateDto,
  BulkImportDto,
} from './dto/create-student.dto';
import { Gender, StudentStatus, PaymentMethod, InvoiceStatus, UserRoleType, Prisma } from '@prisma/client';
import { FeesService } from '../fees/fees.service';
import {
  parseFlexibleDate,
  splitStudentName,
  cleanPhone,
  sanitizeCell,
  isValidEmail,
} from '../../common/utils/csv-parser.util';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceCodeService: AttendanceCodeService,
    private readonly feesService: FeesService,
  ) {}

  /**
   * Resolves the student query filter condition for a staff member based on their active assignments
   */
  async getStaffAssignedStudentCondition(userId: string): Promise<Prisma.StudentWhereInput> {
    const [courseAssignments, classSchedules] = await Promise.all([
      this.prisma.staffCourseAssignment.findMany({
        where: { userId, isActive: true },
        select: { classId: true, batchId: true, subjectId: true },
      }),
      this.prisma.classSchedule.findMany({
        where: { staffId: userId, isActive: true },
        select: { classId: true, batchId: true, subjectId: true },
      }),
    ]);

    const allAssignments = [...courseAssignments, ...classSchedules];
    if (allAssignments.length === 0) {
      return { id: '__NO_ASSIGNED_STUDENTS__' };
    }

    const conditions: Prisma.StudentWhereInput[] = [];

    for (const a of allAssignments) {
      if (a.batchId && a.subjectId) {
        conditions.push({
          batchEnrollments: {
            some: {
              batchId: a.batchId,
              subjectId: a.subjectId,
              isActive: true,
            },
          },
        });
      } else if (a.batchId) {
        conditions.push({
          batchEnrollments: {
            some: {
              batchId: a.batchId,
              isActive: true,
            },
          },
        });
      } else if (a.classId && a.subjectId) {
        conditions.push({
          batchEnrollments: {
            some: {
              batch: { classId: a.classId },
              subjectId: a.subjectId,
              isActive: true,
            },
          },
        });
      } else if (a.classId) {
        conditions.push({
          batchEnrollments: {
            some: {
              batch: { classId: a.classId },
              isActive: true,
            },
          },
        });
      }
    }

    return conditions.length > 0 ? { OR: conditions } : { id: '__NO_ASSIGNED_STUDENTS__' };
  }

  async findAll(
    query: {
      search?: string;
      batchId?: string;
      classId?: string;
      page?: number;
      limit?: number;
    },
    user?: any,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 100));
    const skip = (page - 1) * limit;

    const where: any = {};

    // 1. Role-based assignment boundary: Non-admin staff/teachers can ONLY view their assigned students
    const roles: string[] = user?.roles || [];
    const isPrivileged =
      roles.includes(UserRoleType.SUPER_ADMIN) || roles.includes(UserRoleType.ACADEMY_ADMIN);

    if (!isPrivileged && user?.id) {
      const assignedCondition = await this.getStaffAssignedStudentCondition(user.id);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        assignedCondition,
      ];
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { studentCode: { contains: q, mode: 'insensitive' } },
        { admissionNumber: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { schoolName: { contains: q, mode: 'insensitive' } },
        { attendanceCode: { contains: q, mode: 'insensitive' } },
        {
          batchEnrollments: {
            some: {
              isActive: true,
              OR: [
                {
                  batch: {
                    OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { code: { contains: q, mode: 'insensitive' } },
                      { class: { name: { contains: q, mode: 'insensitive' } } },
                      { class: { code: { contains: q, mode: 'insensitive' } } },
                    ],
                  },
                },
                {
                  subject: {
                    OR: [
                      { name: { contains: q, mode: 'insensitive' } },
                      { code: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              ],
            },
          },
        },
      ];

      const parts = q.split(/\s+/).filter(Boolean);
      if (parts.length > 1) {
        where.OR.push({
          AND: [
            { firstName: { contains: parts[0], mode: 'insensitive' } },
            { lastName: { contains: parts.slice(1).join(' '), mode: 'insensitive' } },
          ],
        });
      }
    }

    if (query.batchId && query.classId) {
      where.batchEnrollments = {
        some: { batchId: query.batchId, batch: { classId: query.classId }, isActive: true },
      };
    } else if (query.batchId) {
      where.batchEnrollments = {
        some: { batchId: query.batchId, isActive: true },
      };
    } else if (query.classId) {
      where.batchEnrollments = {
        some: { batch: { classId: query.classId }, isActive: true },
      };
    }

    const [total, students] = await Promise.all([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          batchEnrollments: {
            where: { isActive: true },
            include: {
              batch: {
                include: {
                  class: true,
                },
              },
              subject: true,
            },
          },
          guardians: {
            include: {
              guardian: true,
            },
          },
        },
      }),
    ]);

    const formatted = students.map((s) => ({
      id: s.id,
      studentCode: s.studentCode,
      admissionNumber: s.admissionNumber,
      attendanceCode: s.attendanceCode,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: s.lastName && s.lastName !== '-' ? `${s.firstName} ${s.lastName}` : s.firstName,
      schoolName: (s as any).schoolName || null,
      dob: s.dob.toISOString().split('T')[0],
      gender: s.gender,
      email: s.email,
      phone: s.phone,
      address: s.address,
      status: s.status,
      currentBatch: s.batchEnrollments[0]?.batch
        ? {
            id: s.batchEnrollments[0].batch.id,
            name: s.batchEnrollments[0].batch.name,
            code: s.batchEnrollments[0].batch.code,
            class: {
              id: s.batchEnrollments[0].batch.class.id,
              name: s.batchEnrollments[0].batch.class.name,
              code: s.batchEnrollments[0].batch.class.code,
            },
          }
        : null,
      enrollments: s.batchEnrollments.map((be) => ({
        id: be.id,
        batchId: be.batch.id,
        batchName: be.batch.name,
        batchCode: be.batch.code,
        classId: be.batch.class.id,
        className: be.batch.class.name,
        classCode: be.batch.class.code,
        subjectId: be.subject?.id || null,
        subjectName: be.subject?.name || null,
        subjectCode: be.subject?.code || null,
      })),
      guardians: s.guardians.map((g) => ({
        id: g.guardian.id,
        fullName: g.guardian.fullName,
        phone: g.guardian.phone,
        email: g.guardian.email,
        relationship: g.guardian.relationship,
        isPrimary: g.isPrimary,
      })),
      createdAt: s.createdAt,
    }));

    return {
      items: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user?: any) {
    const roles: string[] = user?.roles || [];
    const isPrivileged =
      roles.includes(UserRoleType.SUPER_ADMIN) || roles.includes(UserRoleType.ACADEMY_ADMIN);

    if (!isPrivileged && user?.id) {
      const assignedCondition = await this.getStaffAssignedStudentCondition(user.id);
      const isAssigned = await this.prisma.student.findFirst({
        where: {
          id,
          AND: [assignedCondition],
        },
        select: { id: true },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You do not have permission to access this student record');
      }
    }

    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        batchEnrollments: {
          include: {
            batch: {
              include: {
                class: true,
              },
            },
          },
          orderBy: { startDate: 'desc' },
        },
        guardians: {
          include: {
            guardian: true,
          },
        },
        attendanceRecords: {
          orderBy: { recordedAt: 'desc' },
          take: 20,
          include: {
            session: {
              include: { batch: true },
            },
          },
        },
        results: {
          include: {
            examination: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    const advanceSummary = await this.getStudentAdvanceSummary(id);

    return {
      ...student,
      fullName: student.lastName && student.lastName !== '-' ? `${student.firstName} ${student.lastName}` : student.firstName,
      dobFormatted: student.dob.toISOString().split('T')[0],
      activeEnrollments: student.batchEnrollments.filter((e) => e.isActive),
      historicalEnrollments: student.batchEnrollments.filter((e) => !e.isActive),
      advanceSummary,
      availableAdvanceBalance: advanceSummary.availableBalance,
    };
  }

  async create(dto: CreateStudentDto, actorId?: string) {
    // 1. Collect and validate all target batch enrollments
    const targetEnrollments: Array<{ batchId: string; courseId?: string; subjectId?: string }> = [];

    if (dto.enrollments && dto.enrollments.length > 0) {
      for (const en of dto.enrollments) {
        if (en.batchId) {
          const isDuplicate = targetEnrollments.some(
            (t) => t.batchId === en.batchId && (t.subjectId || null) === (en.subjectId || null),
          );
          if (!isDuplicate) {
            targetEnrollments.push(en);
          }
        }
      }
    } else if (dto.batchIds && dto.batchIds.length > 0) {
      for (const bid of dto.batchIds) {
        if (bid && !targetEnrollments.some((t) => t.batchId === bid)) {
          targetEnrollments.push({ batchId: bid });
        }
      }
    } else if (dto.batchId) {
      targetEnrollments.push({ batchId: dto.batchId, courseId: dto.courseId, subjectId: dto.subjectId });
    }

    if (targetEnrollments.length === 0) {
      throw new BadRequestException('At least one cohort batch enrollment is required');
    }

    const validatedBatches: any[] = [];
    for (const en of targetEnrollments) {
      const b = await this.prisma.batch.findUnique({
        where: { id: en.batchId },
        include: { class: { include: { subjects: true } } },
      });
      if (!b) {
        throw new NotFoundException(`Batch with ID ${en.batchId} not found`);
      }
      if (en.courseId && b.classId !== en.courseId) {
        throw new BadRequestException(
          `Batch '${b.name}' belongs to course '${b.class.name}' (${b.class.code}), not the requested course ID`,
        );
      }
      if (en.subjectId) {
        const sub = await this.prisma.subject.findUnique({ where: { id: en.subjectId } });
        if (!sub || sub.classId !== b.classId) {
          throw new BadRequestException(
            `Subject does not belong to course '${b.class.name}' (${b.class.code})`,
          );
        }
      }
      validatedBatches.push(b);
    }

    // 2. Generate or validate codes
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const studentCode =
      dto.studentCode?.trim().toUpperCase() ||
      `STU-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const admissionNumber =
      dto.admissionNumber?.trim().toUpperCase() ||
      `ADM-${Date.now().toString().slice(-4)}${randomSuffix}`;

    // Check duplicate studentCode / admissionNumber
    const existing = await this.prisma.student.findFirst({
      where: {
        OR: [
          { studentCode },
          { admissionNumber },
          ...(dto.email ? [{ email: dto.email.trim() }] : []),
        ],
      },
    });

    if (existing) {
      if (existing.studentCode === studentCode) {
        throw new ConflictException(`Student code '${studentCode}' already exists`);
      }
      if (existing.admissionNumber === admissionNumber) {
        throw new ConflictException(`Admission number '${admissionNumber}' already exists`);
      }
      if (dto.email && existing.email === dto.email.trim()) {
        throw new ConflictException(`Student email '${dto.email}' is already registered`);
      }
    }

    const rawFirst = (dto.firstName || dto.name || '').trim();
    let firstName = rawFirst;
    let lastName = dto.lastName?.trim() || '';

    if (!lastName && rawFirst.includes(' ')) {
      const parts = rawFirst.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else if (!lastName) {
      lastName = '-';
    }

    const createdStudentResult = await this.prisma.$transaction(async (tx) => {
      // 3. Create Student
      const student = await tx.student.create({
        data: {
          studentCode,
          admissionNumber,
          firstName,
          lastName,
          schoolName: dto.schoolName && dto.schoolName.trim() ? dto.schoolName.trim() : null,
          dob: new Date(dto.dob),
          gender: dto.gender,
          email: dto.email && dto.email.trim() ? dto.email.trim() : null,
          phone: dto.phone && dto.phone.trim() ? dto.phone.trim() : null,
          address: dto.address && dto.address.trim() ? dto.address.trim() : null,
          dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null,
          academicBoard: dto.academicBoard && dto.academicBoard.trim() ? dto.academicBoard.trim() : null,
          referralSource: dto.referralSource && dto.referralSource.trim() ? dto.referralSource.trim() : null,
          alternativePhone: dto.alternativePhone && dto.alternativePhone.trim() ? dto.alternativePhone.trim() : null,
          batchEnrollments: {
            create: targetEnrollments.map((en) => ({
              batchId: en.batchId,
              subjectId: en.subjectId || null,
              isActive: true,
            })),
          },
        },
        include: {
          batchEnrollments: true,
        },
      });

      // 4. Allocate unique 3-digit attendance code
      const attendanceCode = await this.attendanceCodeService.allocateCode(
        tx,
        AttendanceCodeEntityType.STUDENT,
        student.id,
      );

      // 5. Create Guardians
      const resolvedGuardians: Array<{
        fullName: string;
        phone: string;
        email?: string;
        relationship: string;
      }> = [];

      if (dto.guardians && dto.guardians.length > 0) {
        resolvedGuardians.push(...dto.guardians);
      } else {
        if (dto.fatherName && dto.fatherName.trim() && dto.fatherPhone && dto.fatherPhone.trim()) {
          resolvedGuardians.push({
            fullName: dto.fatherName.trim(),
            phone: dto.fatherPhone.trim(),
            relationship: 'Father',
          });
        }
        if (dto.motherName && dto.motherName.trim() && dto.motherPhone && dto.motherPhone.trim()) {
          resolvedGuardians.push({
            fullName: dto.motherName.trim(),
            phone: dto.motherPhone.trim(),
            relationship: 'Mother',
          });
        }
        if (resolvedGuardians.length === 0 && dto.guardianName && dto.guardianPhone) {
          resolvedGuardians.push({
            fullName: dto.guardianName.trim(),
            phone: dto.guardianPhone.trim(),
            relationship: dto.guardianRelationship?.trim() || 'Guardian',
          });
        }
      }

      if (resolvedGuardians.length > 0) {
        for (let i = 0; i < resolvedGuardians.length; i++) {
          const g = resolvedGuardians[i];
          const guardian = await tx.guardian.create({
            data: {
              fullName: g.fullName.trim(),
              phone: g.phone.trim(),
              email: g.email && g.email.trim() ? g.email.trim() : null,
              relationship: g.relationship.trim(),
            },
          });

          await tx.studentGuardian.create({
            data: {
              studentId: student.id,
              guardianId: guardian.id,
              isPrimary: i === 0,
            },
          });
        }
      }

      // 5B. Record admission advance if amount > 0
      let advanceRecord: any = null;
      if (dto.advanceAmount && Number(dto.advanceAmount) > 0) {
        const advAmount = new Prisma.Decimal(dto.advanceAmount);
        if (advAmount.gt(0)) {
          const receiptNumber = await this.generateNextAdvanceReceiptNumber(tx);
          const paymentMethod = dto.advancePaymentMethod || PaymentMethod.CASH;
          const paymentDate = dto.advancePaymentDate ? new Date(dto.advancePaymentDate) : new Date();

          advanceRecord = await tx.studentAdvance.create({
            data: {
              receiptNumber,
              studentId: student.id,
              amount: advAmount,
              paymentMethod,
              paymentDate,
              reference: dto.advanceReference && dto.advanceReference.trim() ? dto.advanceReference.trim() : null,
              notes: dto.advanceNotes && dto.advanceNotes.trim() ? dto.advanceNotes.trim() : 'Admission payment & advance',
              recordedById: actorId || (await this.resolveSystemAdminId(tx)),
            },
          });

          await tx.auditLog.create({
            data: {
              actorId,
              action: 'STUDENT_ADVANCE_COLLECTED_AT_ADMISSION',
              entityType: 'StudentAdvance',
              entityId: advanceRecord.id,
              details: {
                studentId: student.id,
                receiptNumber,
                amount: advAmount.toNumber(),
                paymentMethod,
                paymentDate: paymentDate.toISOString(),
              },
            },
          });
        }
      }

      // 6. Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_CREATE',
          entityType: 'Student',
          entityId: student.id,
          details: {
            studentCode: student.studentCode,
            attendanceCode,
            enrollmentCount: targetEnrollments.length,
            batchIds: targetEnrollments.map((t) => t.batchId),
          },
        },
      });

      const res = {
        ...student,
        attendanceCode,
        batchName: validatedBatches[0]?.name || '',
        courseName: validatedBatches[0]?.class?.name || '',
        enrolledBatches: validatedBatches.map((b) => ({
          id: b.id,
          name: b.name,
          className: b.class.name,
        })),
        advance: advanceRecord,
      };

      return {
        student,
        res,
      };
    });

    // 7. Auto-bill all created enrollments after transaction commit
    const enrollmentsToBill = (createdStudentResult.student as any)?.batchEnrollments || [];
    for (const en of enrollmentsToBill) {
      try {
        await this.feesService.createCourseInvoiceForEnrollment(en.id, 'ANNUAL', actorId);
      } catch (err: any) {
        this.logger.warn(`Could not auto-bill enrollment ${en.id}: ${err.message}`);
      }
    }

    return createdStudentResult.res;
  }

  async update(id: string, dto: UpdateStudentDto, actorId?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // Check duplicate email
    if (dto.email && dto.email.trim() !== student.email) {
      const existing = await this.prisma.student.findFirst({
        where: { email: dto.email.trim(), id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Email '${dto.email}' is already in use by another student`);
      }
    }

    let firstName = dto.firstName?.trim();
    let lastName = dto.lastName?.trim();

    if (dto.name && !dto.firstName) {
      const parts = dto.name.trim().split(/\s+/);
      firstName = parts[0];
      lastName = parts.length > 1 ? parts.slice(1).join(' ') : '-';
    }

    await this.prisma.$transaction(async (tx) => {
      // NEVER modify or regenerate attendanceCode
      await tx.student.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(dto.schoolName !== undefined && { schoolName: dto.schoolName && dto.schoolName.trim() ? dto.schoolName.trim() : null }),
          ...(dto.dob && { dob: new Date(dto.dob) }),
          ...(dto.gender && { gender: dto.gender }),
          ...(dto.email !== undefined && { email: dto.email && dto.email.trim() ? dto.email.trim() : null }),
          ...(dto.phone !== undefined && { phone: dto.phone && dto.phone.trim() ? dto.phone.trim() : null }),
          ...(dto.address !== undefined && { address: dto.address && dto.address.trim() ? dto.address.trim() : null }),
          ...(dto.dateOfJoining !== undefined && { dateOfJoining: dto.dateOfJoining ? new Date(dto.dateOfJoining) : null }),
          ...(dto.academicBoard !== undefined && { academicBoard: dto.academicBoard && dto.academicBoard.trim() ? dto.academicBoard.trim() : null }),
          ...(dto.referralSource !== undefined && { referralSource: dto.referralSource && dto.referralSource.trim() ? dto.referralSource.trim() : null }),
          ...(dto.alternativePhone !== undefined && { alternativePhone: dto.alternativePhone && dto.alternativePhone.trim() ? dto.alternativePhone.trim() : null }),
          ...(dto.status && { status: dto.status }),
        },
      });

      if (dto.guardians !== undefined) {
        await tx.studentGuardian.deleteMany({
          where: { studentId: id },
        });

        for (let i = 0; i < dto.guardians.length; i++) {
          const g = dto.guardians[i];
          if (g.fullName && g.phone) {
            const guardian = await tx.guardian.create({
              data: {
                fullName: g.fullName.trim(),
                phone: g.phone.trim(),
                email: g.email && g.email.trim() ? g.email.trim() : null,
                relationship: g.relationship.trim() || 'Guardian',
              },
            });
            await tx.studentGuardian.create({
              data: {
                studentId: id,
                guardianId: guardian.id,
                isPrimary: i === 0,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_UPDATE',
          entityType: 'Student',
          entityId: id,
          details: { ...dto } as any,
        },
      });
    });

    return this.findOne(id);
  }

  async enrollInBatch(studentId: string, dto: EnrollStudentDto, actorId?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    const batch = await this.prisma.batch.findUnique({
      where: { id: dto.batchId },
      include: { class: true },
    });
    if (!batch) {
      throw new NotFoundException(`Batch ${dto.batchId} not found`);
    }

    if (dto.courseId && batch.classId !== dto.courseId) {
      throw new BadRequestException(
        `Batch '${batch.name}' does not belong to course '${dto.courseId}'`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Check existing active enrollment for this offering
      const existingInBatch = await tx.studentBatchEnrollment.findFirst({
        where: {
          studentId,
          batchId: dto.batchId,
          subjectId: dto.subjectId || null,
        },
      });

      if (existingInBatch && existingInBatch.isActive) {
        return existingInBatch;
      }

      // Deactivate older active enrollments under the same course for the same subject if switching batches
      if (!dto.allowMultipleInCourse) {
        const whereOlder: any = {
          studentId,
          isActive: true,
          batch: { classId: batch.classId },
          subjectId: dto.subjectId || null,
        };

        const activeEnrollmentsInCourse = await tx.studentBatchEnrollment.findMany({
          where: whereOlder,
        });

        for (const enc of activeEnrollmentsInCourse) {
          await tx.studentBatchEnrollment.update({
            where: { id: enc.id },
            data: { isActive: false, endDate: new Date() },
          });
        }
      }

      let enrollment;
      if (existingInBatch) {
        enrollment = await tx.studentBatchEnrollment.update({
          where: { id: existingInBatch.id },
          data: {
            isActive: true,
            startDate: new Date(),
            endDate: null,
            subjectId: dto.subjectId || existingInBatch.subjectId || null,
          },
          include: {
            batch: { include: { class: true } },
            subject: true,
          },
        });
      } else {
        enrollment = await tx.studentBatchEnrollment.create({
          data: {
            studentId,
            batchId: dto.batchId,
            subjectId: dto.subjectId || null,
            isActive: true,
          },
          include: {
            batch: { include: { class: true } },
            subject: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_ENROLLMENT_CHANGE',
          entityType: 'StudentBatchEnrollment',
          entityId: enrollment.id,
          details: {
            studentId,
            newBatchId: dto.batchId,
            courseId: batch.classId,
            subjectId: dto.subjectId || null,
          },
        },
      });

      return enrollment;
    });

    // Auto-generate course fee invoice for newly activated enrollment
    try {
      await this.feesService.createCourseInvoiceForEnrollment(result.id, 'ANNUAL', actorId);
    } catch (err: any) {
      this.logger.warn(`Could not auto-bill enrollment ${result.id}: ${err.message}`);
    }

    return result;
  }

  async deactivateEnrollment(studentId: string, enrollmentId: string, actorId?: string) {
    const enrollment = await this.prisma.studentBatchEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { batch: { include: { class: true } }, subject: true },
    });
    if (!enrollment || enrollment.studentId !== studentId) {
      throw new NotFoundException(`Enrollment ${enrollmentId} not found for student ${studentId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.studentBatchEnrollment.update({
        where: { id: enrollmentId },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_ENROLLMENT_DEACTIVATED',
          entityType: 'StudentBatchEnrollment',
          entityId: enrollmentId,
          details: {
            studentId,
            batchName: enrollment.batch.name,
            courseName: enrollment.batch.class.name,
            subjectName: enrollment.subject?.name || null,
          },
        },
      });

      return updated;
    });
  }

  async getStudentEnrollments(studentId: string, user?: any) {
    const roles: string[] = user?.roles || [];
    const isPrivileged =
      roles.includes(UserRoleType.SUPER_ADMIN) || roles.includes(UserRoleType.ACADEMY_ADMIN);

    if (!isPrivileged && user?.id) {
      const assignedCondition = await this.getStaffAssignedStudentCondition(user.id);
      const isAssigned = await this.prisma.student.findFirst({
        where: { id: studentId, AND: [assignedCondition] },
        select: { id: true },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You do not have permission to access this student record');
      }
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    const enrollments = await this.prisma.studentBatchEnrollment.findMany({
      where: { studentId },
      orderBy: { startDate: 'desc' },
      include: {
        batch: {
          include: { class: true },
        },
        subject: true,
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paidAmount: true,
            balanceAmount: true,
            status: true,
          },
        },
      },
    });

    const active = enrollments.filter((e) => e.isActive);
    const historical = enrollments.filter((e) => !e.isActive);

    return { active, historical, totalCount: enrollments.length };
  }

  // --- BULK ONBOARDING CSV ---

  getCsvTemplate(): { filename: string; content: string } {
    const headers =
      'Date of joining,Name,Name of the School,Date of Birth,Father\'s Name,Father\'s Mobile Number,Mother\'s Name,Mother\'s Mobile Number,Alternative Number,Email Id,Address,Are you a part of,Subjects,How do you know about our academy\n';
    const sample =
      '01-06-2026,Aarav Sharma,St. Joseph Higher Secondary School,14-05-2010,Rajesh Sharma,9876543210,Sunita Sharma,9876543211,9876543212,aarav.sharma@example.com,"123 Heritage Way, Near Central Park",CBSE,Science;Maths,Friend Referral\n';

    return {
      filename: 'rc_academy_student_onboarding_template.csv',
      content: headers + sample,
    };
  }

  async bulkValidate(input: BulkValidateDto | BulkImportRowDto[]) {
    const rows = Array.isArray(input) ? input : input?.rows || [];
    const defaultCourseId = Array.isArray(input) ? undefined : input?.defaultCourseId;
    const defaultBatchId = Array.isArray(input) ? undefined : input?.defaultBatchId;

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('Import file does not contain any data rows');
    }

    if (rows.length > 500) {
      throw new BadRequestException('Exceeded maximum bulk import size (500 rows per batch)');
    }

    // Pre-load all courses, batches, and subjects for fast validation
    const courses = await this.prisma.class.findMany({
      include: { batches: true, subjects: true },
    });
    const courseMapById = new Map<string, (typeof courses)[0]>();
    const courseMapByCode = new Map<string, (typeof courses)[0]>();
    for (const c of courses) {
      courseMapById.set(c.id, c);
      courseMapByCode.set(c.code.toUpperCase(), c);
    }

    // Pre-load all existing student emails, phones, and names+DOB
    const existingStudents = await this.prisma.student.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dob: true,
        email: true,
        phone: true,
        studentCode: true,
      },
    });

    const dbEmailSet = new Set(
      existingStudents.map((s) => s.email?.toLowerCase().trim()).filter(Boolean),
    );
    const dbPhoneSet = new Set(
      existingStudents.map((s) => cleanPhone(s.phone)).filter(Boolean),
    );

    // Map of normalizedName+dobYmd -> studentCode
    const dbStudentNameDobMap = new Map<string, string>();
    for (const s of existingStudents) {
      const nameKey = `${s.firstName.toLowerCase().trim()} ${s.lastName.toLowerCase().trim()}`;
      const dobKey = s.dob.toISOString().split('T')[0];
      dbStudentNameDobMap.set(`${nameKey}|${dobKey}`, s.studentCode);
    }

    const seenInFileEmails = new Set<string>();
    const seenInFilePhones = new Set<string>();
    const seenInFileNameDob = new Set<string>();

    const validatedRows: any[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    let warningCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Name parsing & splitting (Mandatory)
      let firstName = (row.firstName || '').trim();
      let lastName = (row.lastName || '').trim();
      let isNameAmbiguous = false;

      const rawFullName = (row.rawName || row.name || '').trim();
      if ((!firstName || !lastName) && rawFullName) {
        const splitRes = splitStudentName(rawFullName);
        firstName = splitRes.firstName;
        lastName = splitRes.lastName;
        if (splitRes.isAmbiguous) {
          isNameAmbiguous = true;
          warnings.push(splitRes.reason || `Name '${rawFullName}' split automatically. Please review.`);
        }
      }

      if (!firstName) errors.push('Student name is required');
      if (!lastName) lastName = '-';

      // 2. Date of Birth (Optional - defaults gracefully if not specified)
      let dobCanonical = '2010-01-01T00:00:00.000Z';
      const isDobExplicit = Boolean(row.dob && String(row.dob).trim());
      if (isDobExplicit) {
        const dobResult = parseFlexibleDate(row.dob!, 'Date of birth', true);
        if (dobResult.isValid && dobResult.isoDate) {
          dobCanonical = dobResult.isoDate;
        } else {
          warnings.push(dobResult.error || `Date of birth '${row.dob}' formatted irregularly; fallback date assigned.`);
        }
      }

      // 3. Date of Joining (Optional)
      let dateOfJoiningCanonical: string | null = null;
      if (row.dateOfJoining && String(row.dateOfJoining).trim()) {
        const dojResult = parseFlexibleDate(row.dateOfJoining, 'Date of joining', false);
        if (!dojResult.isValid) {
          warnings.push(dojResult.error || `Date of joining has ambiguous format: '${row.dateOfJoining}'`);
        } else {
          dateOfJoiningCanonical = dojResult.isoDate!;
        }
      }

      // 4. Gender (Optional - defaults to OTHER if not specified)
      let resolvedGender: Gender = Gender.OTHER;
      if (row.gender) {
        const normalizedGender = String(row.gender).trim().toUpperCase();
        if (['MALE', 'FEMALE', 'OTHER'].includes(normalizedGender)) {
          resolvedGender = normalizedGender as Gender;
        } else if (['M', 'BOY'].includes(normalizedGender)) {
          resolvedGender = Gender.MALE;
        } else if (['F', 'GIRL'].includes(normalizedGender)) {
          resolvedGender = Gender.FEMALE;
        }
      }

      // 5. Course & Batch resolution (Class is Mandatory)
      let resolvedCourseId: string | null = null;
      let resolvedCourseName = '';
      let resolvedBatchId: string | null = null;
      let resolvedBatchName = '';

      const targetCourseId = row.targetCourseId || (row as any).courseId;
      const targetCourseCode = (row.courseCode || (row as any).class || (row as any).className || '').trim().toUpperCase();
      const course =
        (targetCourseId && courseMapById.get(targetCourseId)) ||
        (targetCourseCode && courseMapByCode.get(targetCourseCode)) ||
        courses.find(
          (c) =>
            targetCourseCode &&
            (c.name.toUpperCase() === targetCourseCode ||
              c.name.toUpperCase().includes(targetCourseCode) ||
              targetCourseCode.includes(c.name.toUpperCase())),
        ) ||
        (defaultCourseId && courseMapById.get(defaultCourseId));

      if (!course) {
        errors.push('Target Class / Course is required. Please map the column or select a default Class.');
      } else {
        resolvedCourseId = course.id;
        resolvedCourseName = course.name;

        const targetBatchId = row.targetBatchId || (row as any).batchId;
        const targetBatchCode = (row.batchCode || (row as any).batch || (row as any).section || '').trim().toUpperCase();
        let batch =
          course.batches.find((b: any) => targetBatchId && b.id === targetBatchId) ||
          course.batches.find(
            (b: any) =>
              targetBatchCode &&
              ((b.code && b.code.toUpperCase() === targetBatchCode) ||
                b.name.toUpperCase() === targetBatchCode),
          ) ||
          course.batches.find((b: any) => defaultBatchId && b.id === defaultBatchId);

        // Auto-assign to default/first batch of the course if not provided
        if (!batch && course.batches && course.batches.length > 0) {
          batch = course.batches[0];
        }

        if (batch) {
          resolvedBatchId = batch.id;
          resolvedBatchName = batch.name;
        } else {
          resolvedBatchName = 'Section A (Auto-create)';
        }
      }

      // 6. Subjects resolution & expansion (Supports multi-subject e.g. "Chemistry;Maths")
      const resolvedSubjectIds: string[] = [];
      const resolvedSubjectNames: string[] = [];

      const rawSubjects = (row.subjects || row.subjectCode || (row as any).subject || '').trim();
      if (course && rawSubjects) {
        if (/^all(\s+|-)?subjects?$/i.test(rawSubjects)) {
          // 'All Subjects' expands to all active subjects of the selected standard
          for (const s of (course.subjects as any[])) {
            resolvedSubjectIds.push(s.id);
            resolvedSubjectNames.push(s.name);
          }
        } else {
          // Split semicolon-separated or comma-separated subjects e.g. "Chemistry;Maths"
          const subjectTokens = rawSubjects
            .split(/[;,]/)
            .map((t: string) => t.trim())
            .filter(Boolean);

          for (const token of subjectTokens) {
            const tokenUpper = token.toUpperCase();
            const matchedSubject = (course.subjects as any[]).find(
              (s: any) =>
                s.name.toUpperCase() === tokenUpper ||
                s.code.toUpperCase() === tokenUpper ||
                (tokenUpper === 'MATHS' && (s.name.toUpperCase() === 'MATHEMATICS' || s.code.toUpperCase() === 'MATH')) ||
                (tokenUpper === 'MATHEMATICS' && (s.name.toUpperCase() === 'MATHS' || s.code.toUpperCase() === 'MATH')) ||
                (tokenUpper === 'CHEM' && s.name.toUpperCase().startsWith('CHEM')) ||
                (tokenUpper === 'PHY' && s.name.toUpperCase().startsWith('PHYS')) ||
                (tokenUpper === 'BIO' && s.name.toUpperCase().startsWith('BIO')),
            );

            if (matchedSubject) {
              if (!resolvedSubjectIds.includes(matchedSubject.id)) {
                resolvedSubjectIds.push(matchedSubject.id);
                resolvedSubjectNames.push(matchedSubject.name);
              }
            } else {
              // Subject will be auto-provisioned under this course on import
              if (!resolvedSubjectNames.includes(token)) {
                resolvedSubjectNames.push(token);
              }
            }
          }
        }
      }

      // 7. Contact & Guardian validations (All Optional)
      const sanitizedEmail = sanitizeCell(row.email);
      const cleanedStudentPhone = cleanPhone(row.phone);
      const cleanedFatherPhone = cleanPhone(row.fatherPhone);
      const cleanedMotherPhone = cleanPhone(row.motherPhone);
      const cleanedAlternativePhone = cleanPhone(row.alternativePhone);

      if (sanitizedEmail) {
        if (!isValidEmail(sanitizedEmail)) {
          warnings.push(`Email '${row.email}' has irregular format`);
        } else {
          const lowerEmail = sanitizedEmail.toLowerCase();
          if (dbEmailSet.has(lowerEmail)) {
            warnings.push(`Email '${sanitizedEmail}' already exists in database`);
          } else if (seenInFileEmails.has(lowerEmail)) {
            warnings.push(`Duplicate email '${sanitizedEmail}' within import file`);
          } else {
            seenInFileEmails.add(lowerEmail);
          }
        }
      }

      if (cleanedStudentPhone) {
        if (dbPhoneSet.has(cleanedStudentPhone)) {
          warnings.push(`Student phone '${cleanedStudentPhone}' already registered for another student`);
        } else if (seenInFilePhones.has(cleanedStudentPhone)) {
          warnings.push(`Duplicate student phone '${cleanedStudentPhone}' within import file`);
        } else {
          seenInFilePhones.add(cleanedStudentPhone);
        }
      }

      if (row.fatherPhone && !cleanedFatherPhone) {
        warnings.push(`Father's mobile number has irregular format: '${row.fatherPhone}'`);
      }
      if (row.motherPhone && !cleanedMotherPhone) {
        warnings.push(`Mother's mobile number has irregular format: '${row.motherPhone}'`);
      }
      if (row.alternativePhone && !cleanedAlternativePhone) {
        warnings.push(`Alternative number has irregular format: '${row.alternativePhone}'`);
      }

      // 8. Composite duplicate check (Name + explicit DOB or Phone)
      if (firstName && lastName && isDobExplicit) {
        const compositeKey = `${firstName.toLowerCase().trim()} ${lastName.toLowerCase().trim()}|${dobCanonical.split('T')[0]}`;
        const existingStudentCode = dbStudentNameDobMap.get(compositeKey);
        if (existingStudentCode) {
          warnings.push(
            `A student named '${firstName} ${lastName}' with DOB '${dobCanonical.split('T')[0]}' already exists (ID: ${existingStudentCode})`,
          );
        } else if (seenInFileNameDob.has(compositeKey)) {
          warnings.push(
            `Duplicate student '${firstName} ${lastName}' with same DOB occurs multiple times in import file`,
          );
        } else {
          seenInFileNameDob.add(compositeKey);
        }
      }

      if (warnings.length > 0) warningCount++;

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else invalidCount++;

      validatedRows.push({
        rowIndex: index + 1,
        data: {
          ...row,
          firstName,
          lastName,
          rawName: rawFullName || `${firstName} ${lastName}`,
          gender: resolvedGender,
          dob: dobCanonical,
          dateOfJoining: dateOfJoiningCanonical || row.dateOfJoining,
          schoolName: sanitizeCell(row.schoolName),
          email: sanitizedEmail,
          phone: cleanedStudentPhone || sanitizeCell(row.phone),
          address: sanitizeCell(row.address),
          fatherName: sanitizeCell(row.fatherName),
          fatherPhone: cleanedFatherPhone || sanitizeCell(row.fatherPhone),
          motherName: sanitizeCell(row.motherName),
          motherPhone: cleanedMotherPhone || sanitizeCell(row.motherPhone),
          alternativePhone: cleanedAlternativePhone || sanitizeCell(row.alternativePhone),
          academicBoard: sanitizeCell(row.academicBoard),
          referralSource: sanitizeCell(row.referralSource),
          subjects: rawSubjects,
        },
        isValid,
        errors,
        warnings,
        resolvedCourseId,
        resolvedCourseName,
        resolvedBatchId,
        resolvedBatchName,
        resolvedSubjectIds,
        resolvedSubjectNames,
        isNameAmbiguous,
      });
    }

    return {
      totalRows: rows.length,
      validCount,
      invalidCount,
      duplicateCount,
      warningCount,
      rows: validatedRows,
    };
  }

  async bulkImport(input: BulkImportDto | BulkImportRowDto[], actorId?: string) {
    const rows = Array.isArray(input) ? input : input?.rows || [];
    // 1. Validate all rows first
    const validation = await this.bulkValidate(input);

    if (validation.validCount === 0) {
      throw new BadRequestException('None of the rows in the import file are valid for import');
    }

    // 2. Pre-check capacity for unique 3-digit attendance codes
    await this.attendanceCodeService.precheckCapacityForBulk(validation.validCount);

    const createdStudents: any[] = [];
    const failedRows: any[] = [];
    let createdCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const vRow of validation.rows) {
      if (!vRow.isValid) {
        skippedCount++;
        failedRows.push({
          row: vRow.rowIndex,
          name: `${vRow.data.firstName || ''} ${vRow.data.lastName || ''}`.trim() || 'Unknown',
          errors: vRow.errors,
          status: 'SKIPPED',
          originalData: vRow.data,
        });
        continue;
      }

      // Check idempotency against database if explicit DOB was given
      const isExplicitDob = vRow.data.dob && !vRow.data.dob.startsWith('2010-01-01');
      if (isExplicitDob) {
        const existingDup = await this.prisma.student.findFirst({
          where: {
            firstName: vRow.data.firstName,
            lastName: vRow.data.lastName,
            dob: new Date(vRow.data.dob),
          },
        });

        if (existingDup) {
          skippedCount++;
          failedRows.push({
            row: vRow.rowIndex,
            name: `${vRow.data.firstName} ${vRow.data.lastName}`,
            errors: [`Student already exists with ID '${existingDup.studentCode}' (Idempotent skip)`],
            status: 'SKIPPED_DUPLICATE',
            originalData: vRow.data,
          });
          continue;
        }
      }

      try {
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const studentCode = `STU-${Date.now().toString().slice(-4)}${randomSuffix}`;
        const admissionNumber = `ADM-${Date.now().toString().slice(-4)}${randomSuffix}`;

        // Interactive Transaction
        const transactionResult = await this.prisma.$transaction(async (tx) => {
          // 1. Create Student
          const student = await tx.student.create({
            data: {
              studentCode,
              admissionNumber,
              firstName: vRow.data.firstName,
              lastName: vRow.data.lastName,
              schoolName: vRow.data.schoolName || null,
              dob: new Date(vRow.data.dob),
              gender: vRow.data.gender,
              email: vRow.data.email || null,
              phone: vRow.data.phone || null,
              address: vRow.data.address || null,
              dateOfJoining: vRow.data.dateOfJoining ? new Date(vRow.data.dateOfJoining) : null,
              academicBoard: vRow.data.academicBoard || null,
              referralSource: vRow.data.referralSource || null,
              alternativePhone: vRow.data.alternativePhone || null,
            },
          });

          // 2. Allocate unique random 3-digit attendance code
          const attendanceCode = await this.attendanceCodeService.allocateCode(
            tx,
            AttendanceCodeEntityType.STUDENT,
            student.id,
          );

          // 3. Create Guardians (Father as primary, Mother as secondary, or generic guardian)
          let hasPrimary = false;
          if (vRow.data.fatherName && vRow.data.fatherPhone) {
            const father = await tx.guardian.create({
              data: {
                fullName: vRow.data.fatherName.trim(),
                phone: vRow.data.fatherPhone.trim(),
                relationship: 'Father',
              },
            });
            await tx.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: father.id,
                isPrimary: true,
              },
            });
            hasPrimary = true;
          }

          if (vRow.data.motherName && vRow.data.motherPhone) {
            const mother = await tx.guardian.create({
              data: {
                fullName: vRow.data.motherName.trim(),
                phone: vRow.data.motherPhone.trim(),
                relationship: 'Mother',
              },
            });
            await tx.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: mother.id,
                isPrimary: !hasPrimary,
              },
            });
            hasPrimary = true;
          }

          if (!hasPrimary && vRow.data.guardianName && vRow.data.guardianPhone) {
            const guardian = await tx.guardian.create({
              data: {
                fullName: vRow.data.guardianName.trim(),
                phone: vRow.data.guardianPhone.trim(),
                relationship: vRow.data.guardianRelationship || 'Guardian',
              },
            });
            await tx.studentGuardian.create({
              data: {
                studentId: student.id,
                guardianId: guardian.id,
                isPrimary: true,
              },
            });
          }

          // 4. Ensure batch exists
          let finalBatchId = vRow.resolvedBatchId;
          if (!finalBatchId) {
            let defaultBatch = await tx.batch.findFirst({
              where: { classId: vRow.resolvedCourseId, isActive: true },
            });
            if (!defaultBatch) {
              defaultBatch = await tx.batch.create({
                data: {
                  classId: vRow.resolvedCourseId,
                  name: 'Section A',
                  code: 'SEC-A',
                },
              });
            }
            finalBatchId = defaultBatch.id;
          }

          // 5. Ensure all subjects exist (e.g. Chemistry, Maths)
          const finalSubjectIds: string[] = [...(vRow.resolvedSubjectIds || [])];
          if (vRow.resolvedSubjectNames && vRow.resolvedSubjectNames.length > 0) {
            for (const subName of vRow.resolvedSubjectNames) {
              const existingSub = await tx.subject.findFirst({
                where: {
                  classId: vRow.resolvedCourseId,
                  OR: [
                    { name: { equals: subName, mode: 'insensitive' } },
                    { code: { equals: subName, mode: 'insensitive' } },
                  ],
                },
              });
              if (existingSub) {
                if (!finalSubjectIds.includes(existingSub.id)) {
                  finalSubjectIds.push(existingSub.id);
                }
              } else {
                // Auto-create missing subject (e.g. Chemistry, Maths)
                const baseCode = (subName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6) || 'SUB').toUpperCase();
                const countExisting = await tx.subject.count({
                  where: { classId: vRow.resolvedCourseId, code: baseCode },
                });
                const subCode = countExisting > 0 ? `${baseCode}${countExisting + 1}` : baseCode;
                const newSub = await tx.subject.create({
                  data: {
                    classId: vRow.resolvedCourseId,
                    name: subName,
                    code: subCode,
                  },
                });
                finalSubjectIds.push(newSub.id);
              }
            }
          }

          // 6. Create Enrollments (multi-subject split)
          const createdEnrollments = [];
          if (finalSubjectIds.length > 0) {
            for (const subId of finalSubjectIds) {
              const enrollment = await tx.studentBatchEnrollment.create({
                data: {
                  studentId: student.id,
                  batchId: finalBatchId!,
                  subjectId: subId,
                  isActive: true,
                },
              });
              createdEnrollments.push(enrollment);
            }
          } else {
            const enrollment = await tx.studentBatchEnrollment.create({
              data: {
                studentId: student.id,
                batchId: finalBatchId!,
                subjectId: null,
                isActive: true,
              },
            });
            createdEnrollments.push(enrollment);
          }

          // 7. Audit Log
          await tx.auditLog.create({
            data: {
              actorId,
              action: 'STUDENT_CREATE',
              entityType: 'Student',
              entityId: student.id,
              details: {
                studentCode: student.studentCode,
                attendanceCode,
                courseName: vRow.resolvedCourseName,
                batchName: vRow.resolvedBatchName,
                subjects: vRow.resolvedSubjectNames,
              },
            },
          });

          return { student, attendanceCode, createdEnrollments };
        });

        // 6. Auto-bill enrollments after transaction commits
        for (const en of transactionResult.createdEnrollments) {
          try {
            await this.feesService.createCourseInvoiceForEnrollment(en.id, 'ANNUAL', actorId);
          } catch (feeErr: any) {
            this.logger.warn(`Could not auto-bill enrollment ${en.id}: ${feeErr.message}`);
          }
        }

        createdCount++;
        createdStudents.push({
          row: vRow.rowIndex,
          id: transactionResult.student.id,
          studentCode: transactionResult.student.studentCode,
          name: `${transactionResult.student.firstName} ${transactionResult.student.lastName}`,
          attendanceCode: transactionResult.attendanceCode,
          course: vRow.resolvedCourseName,
          batch: vRow.resolvedBatchName,
          subjects: vRow.resolvedSubjectNames.length > 0 ? vRow.resolvedSubjectNames.join(', ') : 'All/General',
        });
      } catch (err: any) {
        failedCount++;
        this.logger.error(`Error importing row ${vRow.rowIndex}: ${err.message}`);
        failedRows.push({
          row: vRow.rowIndex,
          name: `${vRow.data.firstName} ${vRow.data.lastName}`,
          errors: [err.message || 'Unknown database error'],
          status: 'FAILED',
          originalData: vRow.data,
        });
      }
    }

    // Audit log summary
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'STUDENT_BULK_IMPORT',
        entityType: 'Student',
        entityId: 'BULK',
        details: {
          totalRows: rows.length,
          createdCount,
          failedCount,
          skippedCount,
        },
      },
    });

    return {
      summary: {
        totalRows: rows.length,
        created: createdCount,
        failed: failedCount,
        skipped: skippedCount,
        duplicates: validation.duplicateCount,
      },
      createdStudents,
      failedRows,
    };
  }

  async remove(id: string, actorId?: string) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        assignedAttendanceCode: true,
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Release assigned 3-digit attendance code if present
      if (student.attendanceCode) {
        await tx.attendanceCode.deleteMany({
          where: { studentId: id },
        });
      }

      // 2. Cascade delete student record (handles enrollments, attendance, results, invoices, submissions)
      await tx.student.delete({
        where: { id },
      });

      // 3. Create traceable audit log entry
      if (actorId) {
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'STUDENT_DELETED',
            entityType: 'Student',
            entityId: id,
            details: {
              studentCode: student.studentCode,
              admissionNumber: student.admissionNumber,
              fullName: student.lastName && student.lastName !== '-' ? `${student.firstName} ${student.lastName}` : student.firstName,
              attendanceCode: student.attendanceCode,
            },
          },
        });
      }

      return {
        success: true,
        message: `Student ${student.firstName} ${student.lastName} (${student.studentCode}) deleted successfully`,
        deletedStudent: {
          id: student.id,
          studentCode: student.studentCode,
          name: `${student.firstName} ${student.lastName}`,
          attendanceCode: student.attendanceCode,
        },
      };
    });
  }

  // ----------------------------------------------------
  // ADVANCE ACCOUNTING & ALLOCATION LOGIC
  // ----------------------------------------------------

  private async resolveSystemAdminId(tx: any): Promise<string> {
    const adminUser = await tx.user.findFirst({
      where: {
        userRoles: {
          some: {
            role: {
              name: {
                in: ['SUPER_ADMIN', 'ACADEMY_ADMIN'],
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (adminUser) return adminUser.id;
    const fallbackUser = await tx.user.findFirst({ select: { id: true } });
    return fallbackUser?.id || '';
  }

  async getStudentAdvanceSummary(studentId: string, tx?: any, user?: any) {
    const roles: string[] = user?.roles || [];
    const isPrivileged =
      roles.includes(UserRoleType.SUPER_ADMIN) || roles.includes(UserRoleType.ACADEMY_ADMIN);

    if (!isPrivileged && user?.id) {
      const assignedCondition = await this.getStaffAssignedStudentCondition(user.id);
      const isAssigned = await this.prisma.student.findFirst({
        where: { id: studentId, AND: [assignedCondition] },
        select: { id: true },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You do not have permission to access this student record');
      }
    }

    const db = tx || this.prisma;
    const advances = await db.studentAdvance.findMany({
      where: { studentId },
      include: {
        recordedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        allocations: {
          include: {
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                totalAmount: true,
                balanceAmount: true,
                status: true,
              },
            },
            allocatedBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { allocatedAt: 'desc' },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    let totalCollected = new Prisma.Decimal(0);
    let totalUtilized = new Prisma.Decimal(0);

    const enrichedAdvances = advances.map((adv: any) => {
      const advAmount = new Prisma.Decimal(adv.amount);
      totalCollected = totalCollected.add(advAmount);

      let advUtilized = new Prisma.Decimal(0);
      const allocations = adv.allocations || [];
      for (const alloc of allocations) {
        advUtilized = advUtilized.add(new Prisma.Decimal(alloc.allocatedAmount));
      }
      totalUtilized = totalUtilized.add(advUtilized);

      const advRemaining = advAmount.sub(advUtilized);
      const advDate = adv.paymentDate ? new Date(adv.paymentDate).toISOString() : new Date().toISOString();

      return {
        id: adv.id,
        receiptNumber: adv.receiptNumber,
        amount: advAmount.toNumber(),
        paymentMethod: adv.paymentMethod || 'CASH',
        paymentDate: advDate,
        reference: adv.reference,
        notes: adv.notes,
        recordedBy: adv.recordedBy || null,
        createdAt: adv.createdAt ? new Date(adv.createdAt).toISOString() : advDate,
        utilizedAmount: advUtilized.toNumber(),
        availableBalance: advRemaining.toNumber(),
        allocations: allocations.map((al: any) => ({
          id: al.id,
          invoiceId: al.invoiceId,
          invoiceNumber: al.invoice?.invoiceNumber || 'INV',
          allocatedAmount: new Prisma.Decimal(al.allocatedAmount).toNumber(),
          allocatedAt: al.allocatedAt ? new Date(al.allocatedAt).toISOString() : new Date().toISOString(),
          allocatedBy: al.allocatedBy || null,
          notes: al.notes,
        })),
      };
    });

    const availableBalance = totalCollected.sub(totalUtilized);

    // Compile combined unified timeline history
    const history: Array<{
      id: string;
      type: 'COLLECTION' | 'ALLOCATION';
      date: string;
      amount: number;
      paymentMethod?: string;
      reference?: string;
      notes?: string;
      receiptNumber?: string;
      invoiceNumber?: string;
      invoiceId?: string;
      actorName: string;
    }> = [];

    for (const adv of advances) {
      const advDate = adv.paymentDate ? new Date(adv.paymentDate).toISOString() : new Date().toISOString();
      const actorName = adv.recordedBy
        ? `${adv.recordedBy.firstName || ''} ${adv.recordedBy.lastName || ''}`.trim()
        : 'System Admin';

      history.push({
        id: adv.id,
        type: 'COLLECTION',
        date: advDate,
        amount: new Prisma.Decimal(adv.amount).toNumber(),
        paymentMethod: adv.paymentMethod || 'CASH',
        reference: adv.reference || undefined,
        notes: adv.notes || undefined,
        receiptNumber: adv.receiptNumber,
        actorName: actorName || 'System Admin',
      });

      for (const al of adv.allocations || []) {
        const alDate = al.allocatedAt ? new Date(al.allocatedAt).toISOString() : new Date().toISOString();
        const allocActorName = al.allocatedBy
          ? `${al.allocatedBy.firstName || ''} ${al.allocatedBy.lastName || ''}`.trim()
          : 'System Admin';

        history.push({
          id: al.id,
          type: 'ALLOCATION',
          date: alDate,
          amount: new Prisma.Decimal(al.allocatedAmount).toNumber(),
          invoiceNumber: al.invoice?.invoiceNumber || undefined,
          invoiceId: al.invoiceId,
          notes: al.notes || undefined,
          reference: adv.receiptNumber,
          actorName: allocActorName || 'System Admin',
        });
      }
    }

    // Sort history chronologically newest first
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      totalCollected: totalCollected.toNumber(),
      totalUtilized: totalUtilized.toNumber(),
      availableBalance: availableBalance.toNumber(),
      advances: enrichedAdvances,
      history,
    };
  }

  async generateNextAdvanceReceiptNumber(txClient?: Prisma.TransactionClient): Promise<string> {
    const db = txClient || this.prisma;
    const year = new Date().getFullYear();
    const prefix = `ADV-${year}-`;

    const latest = await db.studentAdvance.findFirst({
      where: { receiptNumber: { startsWith: prefix } },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });

    let nextSeq = 1;
    if (latest && latest.receiptNumber) {
      const match = latest.receiptNumber.match(/ADV-\d{4}-(\d+)/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    while (true) {
      const candidate = `${prefix}${String(nextSeq).padStart(5, '0')}`;
      const exists = await db.studentAdvance.findUnique({
        where: { receiptNumber: candidate },
        select: { id: true },
      });
      if (!exists) {
        return candidate;
      }
      nextSeq++;
    }
  }

  async recordAdvance(studentId: string, dto: RecordAdvanceDto, actorId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Advance amount must be greater than zero');
    }
    if (amount.gt(new Prisma.Decimal(10000000))) {
      throw new BadRequestException('Advance amount exceeds maximum allowed limit (₹1,00,00,000)');
    }
    if (amount.decimalPlaces() > 2) {
      throw new BadRequestException('Advance amount cannot have more than 2 decimal places');
    }

    const paymentDate = new Date(dto.paymentDate);
    if (isNaN(paymentDate.getTime())) {
      throw new BadRequestException('Invalid payment date format');
    }

    return this.prisma.$transaction(async (tx) => {
      // Prevent duplicate entry on rapid retries (same student, amount, reference within last 5 seconds)
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const duplicateRecent = await tx.studentAdvance.findFirst({
        where: {
          studentId,
          amount,
          reference: dto.reference && dto.reference.trim() ? dto.reference.trim() : null,
          createdAt: { gte: fiveSecondsAgo },
        },
      });

      if (duplicateRecent) {
        this.logger.warn(`Duplicate advance submission detected for student ${studentId}`);
        return {
          advance: duplicateRecent,
          receiptNumber: duplicateRecent.receiptNumber,
          isDuplicateRetry: true,
          summary: await this.getStudentAdvanceSummary(studentId, tx),
        };
      }

      const receiptNumber = await this.generateNextAdvanceReceiptNumber(tx);

      const advance = await tx.studentAdvance.create({
        data: {
          receiptNumber,
          studentId,
          amount,
          paymentMethod: dto.paymentMethod,
          paymentDate,
          reference: dto.reference && dto.reference.trim() ? dto.reference.trim() : null,
          notes: dto.notes && dto.notes.trim() ? dto.notes.trim() : null,
          recordedById: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_ADVANCE_COLLECTED',
          entityType: 'StudentAdvance',
          entityId: advance.id,
          details: {
            studentId,
            receiptNumber,
            amount: amount.toNumber(),
            paymentMethod: dto.paymentMethod,
            paymentDate: paymentDate.toISOString(),
            reference: dto.reference && dto.reference.trim() ? dto.reference.trim() : null,
          },
        },
      });

      const summary = await this.getStudentAdvanceSummary(studentId, tx);

      return {
        advance,
        receiptNumber: advance.receiptNumber,
        isDuplicateRetry: false,
        summary,
      };
    });
  }

  async allocateAdvance(studentId: string, dto: AllocateAdvanceDto, actorId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${studentId} not found`);
    }

    const allocAmount = new Prisma.Decimal(dto.amount);
    if (allocAmount.lte(0)) {
      throw new BadRequestException('Allocation amount must be greater than zero');
    }
    if (allocAmount.decimalPlaces() > 2) {
      throw new BadRequestException('Allocation amount cannot have more than 2 decimal places');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Pessimistic row-level lock on student to prevent concurrent double-spend
      await tx.$queryRawUnsafe('SELECT id FROM students WHERE id = $1 FOR UPDATE', studentId);

      // 2. Fetch and validate invoice
      const invoice = await tx.feeInvoice.findUnique({
        where: { id: dto.invoiceId },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);
      }
      if (invoice.studentId !== studentId) {
        throw new BadRequestException(`Invoice ${invoice.invoiceNumber} does not belong to student ${studentId}`);
      }
      if (!([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] as InvoiceStatus[]).includes(invoice.status)) {
        throw new BadRequestException(
          `Invoice ${invoice.invoiceNumber} is already ${invoice.status} and cannot receive allocations`,
        );
      }

      const remainingInvoiceBalance = new Prisma.Decimal(invoice.balanceAmount);
      if (allocAmount.gt(remainingInvoiceBalance)) {
        throw new BadRequestException(
          `Allocation amount (₹${allocAmount.toString()}) exceeds invoice remaining balance (₹${remainingInvoiceBalance.toString()}) for invoice ${invoice.invoiceNumber}`,
        );
      }

      // 3. Fetch advances and calculate current available balance inside the lock
      const advances = await tx.studentAdvance.findMany({
        where: { studentId },
        include: { allocations: true },
        orderBy: { paymentDate: 'asc' }, // FIFO: oldest advance first
      });

      let totalCollected = new Prisma.Decimal(0);
      let totalUtilized = new Prisma.Decimal(0);

      for (const adv of advances) {
        const advAmount = new Prisma.Decimal(adv.amount);
        totalCollected = totalCollected.add(advAmount);
        for (const al of adv.allocations || []) {
          totalUtilized = totalUtilized.add(new Prisma.Decimal(al.allocatedAmount));
        }
      }

      const availableAdvance = totalCollected.sub(totalUtilized);

      if (allocAmount.gt(availableAdvance)) {
        throw new BadRequestException(
          `Allocation amount (₹${allocAmount.toString()}) exceeds student's available advance balance (₹${availableAdvance.toString()})`,
        );
      }

      // 4. Distribute allocation across available advances (FIFO)
      let remainingToAllocate = allocAmount;
      const createdAllocations: any[] = [];

      for (const adv of advances) {
        if (remainingToAllocate.isZero()) break;

        const advAmount = new Prisma.Decimal(adv.amount);
        const advAllocated = (adv.allocations || []).reduce(
          (sum: Prisma.Decimal, a: any) => sum.add(new Prisma.Decimal(a.allocatedAmount)),
          new Prisma.Decimal(0),
        );
        const advAvailable = advAmount.sub(advAllocated);

        if (advAvailable.gt(0)) {
          const allocationChunk = Prisma.Decimal.min(remainingToAllocate, advAvailable);

          const allocationRecord = await tx.studentAdvanceAllocation.create({
            data: {
              advanceId: adv.id,
              invoiceId: invoice.id,
              allocatedAmount: allocationChunk,
              allocatedById: actorId,
              notes: dto.notes?.trim() || `Allocated to ${invoice.invoiceNumber}`,
            },
          });

          createdAllocations.push(allocationRecord);
          remainingToAllocate = remainingToAllocate.sub(allocationChunk);
        }
      }

      // 5. Update FeeInvoice balance and status
      const newBalance = remainingInvoiceBalance.sub(allocAmount);
      const newPaid = new Prisma.Decimal(invoice.paidAmount || 0).add(allocAmount);
      const newStatus = newBalance.isZero() ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL;

      const updatedInvoice = await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
        },
      });

      // 6. Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STUDENT_ADVANCE_ALLOCATED_TO_INVOICE',
          entityType: 'StudentAdvanceAllocation',
          entityId: createdAllocations[0]?.id,
          details: {
            studentId,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            allocatedAmount: allocAmount.toNumber(),
            previousBalance: remainingInvoiceBalance.toNumber(),
            newBalance: newBalance.toNumber(),
            newInvoiceStatus: newStatus,
            advancesCount: createdAllocations.length,
          },
        },
      });

      const updatedSummary = await this.getStudentAdvanceSummary(studentId, tx);

      return {
        success: true,
        allocatedAmount: allocAmount.toNumber(),
        invoice: {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          totalAmount: new Prisma.Decimal(updatedInvoice.totalAmount).toNumber(),
          paidAmount: newPaid.toNumber(),
          balanceAmount: newBalance.toNumber(),
          status: updatedInvoice.status,
        },
        allocations: createdAllocations,
        summary: updatedSummary,
      };
    });
  }
}

