import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
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
  BulkImportRowDto,
  BulkValidateDto,
  BulkImportDto,
} from './dto/create-student.dto';
import { Gender, StudentStatus } from '@prisma/client';
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

  async findAll(query: {
    search?: string;
    batchId?: string;
    classId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

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

    if (query.batchId) {
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

  async findOne(id: string) {
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

    return {
      ...student,
      fullName: student.lastName && student.lastName !== '-' ? `${student.firstName} ${student.lastName}` : student.firstName,
      dobFormatted: student.dob.toISOString().split('T')[0],
      activeEnrollments: student.batchEnrollments.filter((e) => e.isActive),
      historicalEnrollments: student.batchEnrollments.filter((e) => !e.isActive),
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

  async getStudentEnrollments(studentId: string) {
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

      // 1. Name parsing & splitting
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

      if (!firstName) errors.push('First name is required');
      if (!lastName) errors.push('Last name is required');

      // 2. Date of Birth
      let dobCanonical: string | null = null;
      if (!row.dob || !String(row.dob).trim()) {
        errors.push('Date of birth is required');
      } else {
        const dobResult = parseFlexibleDate(row.dob, 'Date of birth', true);
        if (!dobResult.isValid) {
          errors.push(dobResult.error || `Invalid date format for DOB: '${row.dob}' (expected DD-MM-YYYY or YYYY-MM-DD)`);
        } else {
          dobCanonical = dobResult.isoDate!;
        }
      }

      // 3. Date of Joining
      let dateOfJoiningCanonical: string | null = null;
      if (row.dateOfJoining && String(row.dateOfJoining).trim()) {
        const dojResult = parseFlexibleDate(row.dateOfJoining, 'Date of joining', false);
        if (!dojResult.isValid) {
          warnings.push(dojResult.error || `Date of joining has ambiguous format: '${row.dateOfJoining}'`);
        } else {
          dateOfJoiningCanonical = dojResult.isoDate!;
        }
      }

      // 4. Gender (Note: actual spreadsheet does NOT have a gender column; NEVER fabricate)
      let resolvedGender: Gender | null = null;
      if (row.gender) {
        const normalizedGender = String(row.gender).trim().toUpperCase();
        if (['MALE', 'FEMALE', 'OTHER'].includes(normalizedGender)) {
          resolvedGender = normalizedGender as Gender;
        } else {
          errors.push(`Gender must be MALE, FEMALE, or OTHER (received '${row.gender}')`);
        }
      } else {
        errors.push('Gender is missing. Please select MALE, FEMALE, or OTHER.');
      }

      // 5. Course & Batch resolution
      let resolvedCourseId: string | null = null;
      let resolvedCourseName = '';
      let resolvedBatchId: string | null = null;
      let resolvedBatchName = '';

      const targetCourseId = row.targetCourseId || (row as any).courseId;
      const targetCourseCode = (row.courseCode || '').trim().toUpperCase();
      const course =
        (targetCourseId && courseMapById.get(targetCourseId)) ||
        (targetCourseCode && courseMapByCode.get(targetCourseCode)) ||
        (defaultCourseId && courseMapById.get(defaultCourseId));

      if (!course) {
        errors.push('Target academic course is required. Please select a course before validating.');
      } else {
        resolvedCourseId = course.id;
        resolvedCourseName = course.name;

        const targetBatchId = row.targetBatchId || (row as any).batchId;
        const targetBatchCode = (row.batchCode || '').trim().toUpperCase();
        const batch =
          course.batches.find((b: any) => targetBatchId && b.id === targetBatchId) ||
          course.batches.find(
            (b: any) =>
              targetBatchCode &&
              ((b.code && b.code.toUpperCase() === targetBatchCode) ||
                b.name.toUpperCase() === targetBatchCode),
          ) ||
          course.batches.find((b: any) => defaultBatchId && b.id === defaultBatchId);

        if (!batch) {
          errors.push(
            `Target batch is required. Please select or provide a valid batch under '${course.name}'.`,
          );
        } else {
          resolvedBatchId = batch.id;
          resolvedBatchName = batch.name;
        }
      }

      // 6. Subjects resolution & expansion
      const resolvedSubjectIds: string[] = [];
      const resolvedSubjectNames: string[] = [];

      const rawSubjects = (row.subjects || row.subjectCode || '').trim();
      if (course && rawSubjects) {
        if (/^all(\s+|-)?subjects?$/i.test(rawSubjects)) {
          // 'All Subjects' expands to all active subjects of the selected standard
          for (const s of (course.subjects as any[])) {
            resolvedSubjectIds.push(s.id);
            resolvedSubjectNames.push(s.name);
          }
        } else {
          // Split semicolon-separated or comma-separated subjects
          const subjectTokens = rawSubjects
            .split(/[;,]/)
            .map((t) => t.trim())
            .filter(Boolean);

          for (const token of subjectTokens) {
            const tokenUpper = token.toUpperCase();
            const matchedSubject = (course.subjects as any[]).find(
              (s: any) =>
                s.name.toUpperCase() === tokenUpper ||
                s.code.toUpperCase() === tokenUpper,
            );

            if (matchedSubject) {
              if (!resolvedSubjectIds.includes(matchedSubject.id)) {
                resolvedSubjectIds.push(matchedSubject.id);
                resolvedSubjectNames.push(matchedSubject.name);
              }
            } else {
              errors.push(
                `Subject '${token}' not found under course '${course.name}' (${course.code})`,
              );
            }
          }
        }
      }

      // 7. Contact & Guardian validations
      const sanitizedEmail = sanitizeCell(row.email);
      const cleanedStudentPhone = cleanPhone(row.phone);
      const cleanedFatherPhone = cleanPhone(row.fatherPhone);
      const cleanedMotherPhone = cleanPhone(row.motherPhone);
      const cleanedAlternativePhone = cleanPhone(row.alternativePhone);

      if (sanitizedEmail) {
        if (!isValidEmail(sanitizedEmail)) {
          errors.push(`Invalid email format: '${row.email}'`);
        } else {
          const lowerEmail = sanitizedEmail.toLowerCase();
          if (dbEmailSet.has(lowerEmail)) {
            errors.push(`Email '${sanitizedEmail}' already exists in database`);
            duplicateCount++;
          } else if (seenInFileEmails.has(lowerEmail)) {
            errors.push(`Duplicate email '${sanitizedEmail}' within import file`);
            duplicateCount++;
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

      // 8. Composite duplicate check (Name + DOB)
      if (firstName && lastName && dobCanonical) {
        const compositeKey = `${firstName.toLowerCase().trim()} ${lastName.toLowerCase().trim()}|${dobCanonical.split('T')[0]}`;
        const existingStudentCode = dbStudentNameDobMap.get(compositeKey);
        if (existingStudentCode) {
          errors.push(
            `A student named '${firstName} ${lastName}' with DOB '${dobCanonical.split('T')[0]}' already exists (ID: ${existingStudentCode})`,
          );
          duplicateCount++;
        } else if (seenInFileNameDob.has(compositeKey)) {
          errors.push(
            `Duplicate student '${firstName} ${lastName}' with same DOB occurs multiple times in import file`,
          );
          duplicateCount++;
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
          dob: dobCanonical || row.dob,
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

      // Check idempotency against database
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

          // 4. Create Enrollments (multi-subject split)
          const createdEnrollments = [];
          if (vRow.resolvedSubjectIds && vRow.resolvedSubjectIds.length > 0) {
            for (const subId of vRow.resolvedSubjectIds) {
              const enrollment = await tx.studentBatchEnrollment.create({
                data: {
                  studentId: student.id,
                  batchId: vRow.resolvedBatchId!,
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
                batchId: vRow.resolvedBatchId!,
                subjectId: null,
                isActive: true,
              },
            });
            createdEnrollments.push(enrollment);
          }

          // 5. Audit Log
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
}

