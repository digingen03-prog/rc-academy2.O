import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateBatchDto,
  UpdateBatchDto,
  CreateSubjectDto,
  UpdateSubjectDto,
} from './dto/course.dto';
import { CourseCategory } from '@prisma/client';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { search?: string; isActive?: boolean; category?: CourseCategory }) {
    const where: any = {};
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const courses = await this.prisma.class.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        academicYear: true,
        batches: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: {
              select: {
                enrollments: { where: { isActive: true } },
                staffAssignments: { where: { isActive: true } },
              },
            },
          },
        },
        staffAssignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, designation: true },
            },
            subject: { select: { id: true, name: true, code: true } },
            batch: { select: { id: true, name: true, code: true } },
          },
        },
        subjects: {
          orderBy: { name: 'asc' },
          include: {
            staffAssignments: {
              where: { isActive: true },
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, designation: true },
                },
              },
            },
            _count: {
              select: {
                enrollments: { where: { isActive: true } },
                examinations: true,
              },
            },
          },
        },
        _count: {
          select: {
            subjects: true,
            examinations: true,
          },
        },
      },
    });

    return courses.map((c) => {
      const totalEnrolled = c.batches.reduce(
        (acc, b) => acc + (b._count?.enrollments || 0),
        0,
      );

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description,
        category: c.category,
        isActive: c.isActive,
        academicYear: c.academicYear,
        batchesCount: c.batches.length,
        totalEnrolled,
        assignedStaffCount: c.staffAssignments.length,
        subjects: c.subjects || [],
        staffAssignments: c.staffAssignments || [],
        batches: c.batches.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          isActive: b.isActive,
          activeEnrollments: b._count.enrollments,
          activeStaff: b._count.staffAssignments,
        })),
        createdAt: c.createdAt,
      };
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.class.findUnique({
      where: { id },
      include: {
        academicYear: true,
        batches: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: {
                student: {
                  select: {
                    id: true,
                    studentCode: true,
                    firstName: true,
                    lastName: true,
                    attendanceCode: true,
                    status: true,
                  },
                },
              },
            },
            staffAssignments: {
              where: { isActive: true },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    designation: true,
                    attendanceCode: true,
                  },
                },
              },
            },
          },
        },
        subjects: true,
        staffAssignments: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                designation: true,
                attendanceCode: true,
              },
            },
            batch: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async create(dto: CreateCourseDto, actorId?: string) {
    const normalizedCode = dto.code.trim().toUpperCase();

    // Check duplicate code
    const existing = await this.prisma.class.findFirst({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw new ConflictException(`Course with code '${normalizedCode}' already exists`);
    }

    // Resolve academic year
    let academicYearId = dto.academicYearId;
    if (!academicYearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { isCurrent: true },
      });
      if (currentYear) {
        academicYearId = currentYear.id;
      } else {
        const anyYear = await this.prisma.academicYear.findFirst();
        if (!anyYear) {
          throw new BadRequestException('No active academic year found. Please configure an academic year first.');
        }
        academicYearId = anyYear.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const course = await tx.class.create({
        data: {
          name: dto.name.trim(),
          code: normalizedCode,
          description: dto.description?.trim(),
          category: dto.category || CourseCategory.ACADEMIC,
          academicYearId: academicYearId!,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'COURSE_CREATE',
          entityType: 'Course',
          entityId: course.id,
          details: { name: course.name, code: course.code, category: course.category },
        },
      });

      return course;
    });
  }

  async update(id: string, dto: UpdateCourseDto, actorId?: string) {
    const course = await this.findOne(id);

    if (dto.code) {
      const normalizedCode = dto.code.trim().toUpperCase();
      if (normalizedCode !== course.code) {
        const conflict = await this.prisma.class.findFirst({
          where: { code: normalizedCode, id: { not: id } },
        });
        if (conflict) {
          throw new ConflictException(`Course with code '${normalizedCode}' already exists`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.class.update({
        where: { id },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.code && { code: dto.code.trim().toUpperCase() }),
          ...(dto.description !== undefined && { description: dto.description?.trim() }),
          ...(dto.category && { category: dto.category }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'COURSE_UPDATE',
          entityType: 'Course',
          entityId: id,
          details: { ...dto } as any,
        },
      });

      return updated;
    });
  }

  async toggleStatus(id: string, isActive: boolean, actorId?: string) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.class.update({
        where: { id },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: isActive ? 'COURSE_ACTIVATE' : 'COURSE_DEACTIVATE',
          entityType: 'Course',
          entityId: id,
          details: { isActive },
        },
      });

      return updated;
    });
  }

  // --- BATCH MANAGEMENT ---

  async createBatch(courseId: string, dto: CreateBatchDto, actorId?: string) {
    const course = await this.findOne(courseId);

    const normalizedBatchCode = dto.code ? dto.code.trim().toUpperCase() : null;

    if (normalizedBatchCode) {
      const existingBatch = await this.prisma.batch.findFirst({
        where: {
          classId: course.id,
          code: normalizedBatchCode,
        },
      });
      if (existingBatch) {
        throw new ConflictException(
          `Batch with code '${normalizedBatchCode}' already exists in course '${course.name}'`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.batch.create({
        data: {
          name: dto.name.trim(),
          code: normalizedBatchCode,
          classId: course.id,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BATCH_CREATE',
          entityType: 'Batch',
          entityId: batch.id,
          details: { courseId: course.id, name: batch.name, code: batch.code },
        },
      });

      return batch;
    });
  }

  async updateBatch(batchId: string, dto: UpdateBatchDto, actorId?: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${batchId} not found`);
    }

    if (dto.code) {
      const normalizedBatchCode = dto.code.trim().toUpperCase();
      if (normalizedBatchCode !== batch.code) {
        const conflict = await this.prisma.batch.findFirst({
          where: {
            classId: batch.classId,
            code: normalizedBatchCode,
            id: { not: batchId },
          },
        });
        if (conflict) {
          throw new ConflictException(`Batch code '${normalizedBatchCode}' is already in use`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.batch.update({
        where: { id: batchId },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.code !== undefined && { code: dto.code ? dto.code.trim().toUpperCase() : null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BATCH_UPDATE',
          entityType: 'Batch',
          entityId: batchId,
          details: { ...dto } as any,
        },
      });

      return updated;
    });
  }

  async toggleBatchStatus(batchId: string, isActive: boolean, actorId?: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) {
      throw new NotFoundException(`Batch with ID ${batchId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.batch.update({
        where: { id: batchId },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: isActive ? 'BATCH_ACTIVATE' : 'BATCH_DEACTIVATE',
          entityType: 'Batch',
          entityId: batchId,
          details: { isActive },
        },
      });

      return updated;
    });
  }

  async deleteCourse(id: string, actorId?: string) {
    const course = await this.prisma.class.findUnique({
      where: { id },
      include: {
        batches: {
          select: { id: true, name: true },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const batchIds = course.batches.map((b) => b.id);

      // 1. Detach financial salary ledgers (keep historical payout/accrual data intact without FK violation)
      await tx.staffSalaryLedger.updateMany({
        where: { classId: id },
        data: { classId: null, subjectId: null, assignmentId: null },
      });

      // 2. Detach fee invoices & lines
      await tx.feeInvoiceLine.updateMany({
        where: { classId: id },
        data: { classId: null, subjectId: null },
      });
      await tx.feeInvoice.updateMany({
        where: { classId: id },
        data: { classId: null, subjectId: null, batchId: null },
      });

      // 3. Delete course fee configurations
      await tx.courseFeeConfig.deleteMany({
        where: { classId: id },
      });

      // 4. Delete staff assignments for this course
      await tx.staffCourseAssignment.deleteMany({
        where: { classId: id },
      });

      // 5. Delete schedules & schedule exceptions
      await tx.dailyScheduleException.deleteMany({
        where: { classId: id },
      });
      await tx.classSchedule.deleteMany({
        where: { classId: id },
      });

      // 6. Delete examinations linked to this class
      await tx.examination.deleteMany({
        where: { classId: id },
      });

      // 7. Delete attendance sessions, records and enrollments for all batches in this class
      if (batchIds.length > 0) {
        await tx.attendanceRecord.deleteMany({
          where: { session: { batchId: { in: batchIds } } },
        });
        await tx.attendanceSession.deleteMany({
          where: { batchId: { in: batchIds } },
        });
        await tx.studentBatchEnrollment.deleteMany({
          where: { batchId: { in: batchIds } },
        });
      }

      await tx.attendanceSession.deleteMany({
        where: { classId: id },
      });

      // 8. Delete subject enrollments & subjects
      await tx.studentBatchEnrollment.deleteMany({
        where: { subject: { classId: id } },
      });
      await tx.subject.deleteMany({
        where: { classId: id },
      });

      // 9. Delete batches
      await tx.batch.deleteMany({
        where: { classId: id },
      });

      // 10. Delete the class itself
      const deleted = await tx.class.delete({
        where: { id },
      });

      // 11. Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'COURSE_DELETE',
          entityType: 'Course',
          entityId: id,
          details: { name: course.name, code: course.code },
        },
      });

      return {
        message: `Course '${course.name}' deleted successfully`,
        deletedId: id,
      };
    });
  }

  async deleteBatch(batchId: string, actorId?: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        class: true,
      },
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${batchId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Detach fee invoices
      await tx.feeInvoice.updateMany({
        where: { batchId },
        data: { batchId: null },
      });

      // 2. Delete course fee configurations for this batch
      await tx.courseFeeConfig.deleteMany({
        where: { batchId },
      });

      // 3. Delete attendance records & sessions
      await tx.attendanceRecord.deleteMany({
        where: { session: { batchId } },
      });
      await tx.attendanceSession.deleteMany({
        where: { batchId },
      });

      // 4. Delete enrollments for this batch
      await tx.studentBatchEnrollment.deleteMany({
        where: { batchId },
      });

      // 5. Clean up staff assignments for this batch
      await tx.staffCourseAssignment.deleteMany({
        where: { batchId },
      });

      // 6. Clean up schedules for this batch
      await tx.dailyScheduleException.deleteMany({
        where: { batchId },
      });
      await tx.classSchedule.deleteMany({
        where: { batchId },
      });

      // 7. Delete examinations linked to this batch
      await tx.examination.deleteMany({
        where: { batchId },
      });

      // 8. Delete the batch
      const deleted = await tx.batch.delete({
        where: { id: batchId },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BATCH_DELETE',
          entityType: 'Batch',
          entityId: batchId,
          details: { name: batch.name, code: batch.code, courseId: batch.classId },
        },
      });

      return {
        message: `Batch '${batch.name}' deleted successfully`,
        deletedId: batchId,
      };
    });
  }

  // --- SUBJECT MANAGEMENT ---

  async getSubjects(query?: { classId?: string; search?: string }) {
    const where: any = {};
    if (query?.classId) where.classId = query.classId;
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        class: {
          select: { id: true, name: true, code: true, category: true },
        },
        staffAssignments: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, designation: true },
            },
            batch: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            enrollments: { where: { isActive: true } },
            examinations: true,
          },
        },
      },
    });
  }

  async createSubject(courseId: string, dto: CreateSubjectDto, actorId?: string) {
    const course = await this.findOne(courseId);
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.subject.findFirst({
      where: {
        classId: courseId,
        code: normalizedCode,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Subject code '${normalizedCode}' already exists under '${course.name}'`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const subject = await tx.subject.create({
        data: {
          name: dto.name.trim(),
          code: normalizedCode,
          classId: courseId,
        },
        include: { class: true },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBJECT_CREATE',
          entityType: 'Subject',
          entityId: subject.id,
          details: { courseId, name: subject.name, code: subject.code },
        },
      });

      return subject;
    });
  }

  async updateSubject(subjectId: string, dto: UpdateSubjectDto, actorId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    if (dto.code) {
      const normalizedCode = dto.code.trim().toUpperCase();
      if (normalizedCode !== subject.code) {
        const conflict = await this.prisma.subject.findFirst({
          where: {
            classId: subject.classId,
            code: normalizedCode,
            id: { not: subjectId },
          },
        });
        if (conflict) {
          throw new ConflictException(`Subject code '${normalizedCode}' already in use for this course`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subject.update({
        where: { id: subjectId },
        data: {
          ...(dto.name && { name: dto.name.trim() }),
          ...(dto.code && { code: dto.code.trim().toUpperCase() }),
        },
        include: { class: true },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBJECT_UPDATE',
          entityType: 'Subject',
          entityId: subjectId,
          details: { ...dto } as any,
        },
      });

      return updated;
    });
  }

  async deleteSubject(subjectId: string, actorId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID ${subjectId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Detach salary ledgers
      await tx.staffSalaryLedger.updateMany({
        where: { subjectId },
        data: { subjectId: null },
      });

      // 2. Detach fee invoice lines & invoices
      await tx.feeInvoiceLine.updateMany({
        where: { subjectId },
        data: { subjectId: null },
      });
      await tx.feeInvoice.updateMany({
        where: { subjectId },
        data: { subjectId: null },
      });

      // 3. Delete course fee configurations for this subject
      await tx.courseFeeConfig.deleteMany({
        where: { subjectId },
      });

      // 4. Delete enrollments for this subject
      await tx.studentBatchEnrollment.deleteMany({
        where: { subjectId },
      });

      // 5. Delete staff assignments
      await tx.staffCourseAssignment.deleteMany({
        where: { subjectId },
      });

      // 6. Delete schedules
      await tx.dailyScheduleException.deleteMany({
        where: { subjectId },
      });
      await tx.classSchedule.deleteMany({
        where: { subjectId },
      });

      // 7. Delete examinations linked to this subject
      await tx.examination.deleteMany({
        where: { subjectId },
      });

      // 8. Delete the subject itself
      const deleted = await tx.subject.delete({
        where: { id: subjectId },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SUBJECT_DELETE',
          entityType: 'Subject',
          entityId: subjectId,
          details: { name: subject.name, code: subject.code },
        },
      });

      return { message: `Subject '${subject.name}' deleted successfully` };
    });
  }

  // --- OVERVIEW METRICS ---

  async getOverview() {
    const [academicCourses, skillCourses, totalSubjects, totalBatches, activeEnrollments, facultyAssignments] =
      await Promise.all([
        this.prisma.class.count({ where: { category: CourseCategory.ACADEMIC, isActive: true } }),
        this.prisma.class.count({ where: { category: CourseCategory.SKILL, isActive: true } }),
        this.prisma.subject.count(),
        this.prisma.batch.count({ where: { isActive: true } }),
        this.prisma.studentBatchEnrollment.findMany({
          where: { isActive: true },
          include: {
            batch: { include: { class: true } },
            subject: true,
          },
        }),
        this.prisma.staffCourseAssignment.findMany({
          where: { isActive: true },
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: true,
            subject: true,
          },
        }),
      ]);

    const academicEnrollments = activeEnrollments.filter(
      (e) => e.batch?.class?.category === CourseCategory.ACADEMIC,
    ).length;
    const skillEnrollments = activeEnrollments.filter(
      (e) => e.batch?.class?.category === CourseCategory.SKILL,
    ).length;

    // Multi-enrolled students
    const studentEnrollmentCounts = new Map<string, number>();
    for (const e of activeEnrollments) {
      studentEnrollmentCounts.set(e.studentId, (studentEnrollmentCounts.get(e.studentId) || 0) + 1);
    }
    const multiEnrolledStudents = Array.from(studentEnrollmentCounts.values()).filter((c) => c > 1).length;

    return {
      academicStandardsCount: academicCourses,
      skillCoursesCount: skillCourses,
      subjectsCount: totalSubjects,
      batchesCount: totalBatches,
      totalActiveEnrollments: activeEnrollments.length,
      academicEnrollments,
      skillEnrollments,
      multiEnrolledStudents,
      activeFacultyAssignments: facultyAssignments.length,
    };
  }

  // --- BOOTSTRAP STANDARDS & SKILL COURSES ---

  async bootstrapStandards(actorId?: string) {
    let academicYear = await this.prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });
    if (!academicYear) {
      academicYear = await this.prisma.academicYear.findFirst();
    }
    if (!academicYear) {
      academicYear = await this.prisma.academicYear.create({
        data: {
          name: '2026-2027',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
          isCurrent: true,
        },
      });
    }

    const academicDefs = [
      {
        name: '10th Standard',
        code: 'STD10',
        subjects: [
          { name: 'Mathematics', code: '10MTH' },
          { name: 'Science', code: '10SCI' },
          { name: 'Social Science', code: '10SOC' },
          { name: 'English', code: '10ENG' },
          { name: 'Hindi', code: '10HIN' },
        ],
        batches: ['Section A', 'Section B'],
      },
      {
        name: '12th Standard',
        code: 'STD12',
        subjects: [
          { name: 'Physics', code: '12PHY' },
          { name: 'Chemistry', code: '12CHE' },
          { name: 'Mathematics', code: '12MTH' },
          { name: 'Biology', code: '12BIO' },
          { name: 'English', code: '12ENG' },
        ],
        batches: ['Section A', 'Section B'],
      },
      {
        name: '9th Standard',
        code: 'STD09',
        subjects: [
          { name: 'Mathematics', code: '09MTH' },
          { name: 'Science', code: '09SCI' },
          { name: 'English', code: '09ENG' },
        ],
        batches: ['Section A'],
      },
      {
        name: '11th Standard',
        code: 'STD11',
        subjects: [
          { name: 'Physics', code: '11PHY' },
          { name: 'Chemistry', code: '11CHE' },
          { name: 'Mathematics', code: '11MTH' },
          { name: 'English', code: '11ENG' },
        ],
        batches: ['Section A'],
      },
    ];

    const skillDefs = [
      {
        name: 'Drawing Masterclass',
        code: 'SKL-DRAW',
        description: 'Pencil sketching, watercolor, portrait and fine arts training',
        batches: ['Weekend Morning Batch', 'Evening Cohort'],
      },
      {
        name: 'Spoken English & Communication',
        code: 'SKL-ENG',
        description: 'Grammar, vocabulary, public speaking and business conversation fluency',
        batches: ['Batch Alpha', 'Weekend Cohort'],
      },
      {
        name: 'Abacus & Mental Arithmetic',
        code: 'SKL-ABA',
        description: 'Speed math and visual arithmetic foundation for young learners',
        batches: ['Saturday Batch'],
      },
    ];

    const createdClasses = [];

    // Create Academic Standards
    for (const def of academicDefs) {
      let cls = await this.prisma.class.findFirst({ where: { code: def.code } });
      if (!cls) {
        cls = await this.prisma.class.create({
          data: {
            name: def.name,
            code: def.code,
            category: CourseCategory.ACADEMIC,
            academicYearId: academicYear.id,
            isActive: true,
          },
        });
      }

      // Create subjects
      for (const s of def.subjects) {
        const subExists = await this.prisma.subject.findFirst({
          where: { classId: cls.id, code: s.code },
        });
        if (!subExists) {
          await this.prisma.subject.create({
            data: {
              classId: cls.id,
              name: s.name,
              code: s.code,
            },
          });
        }
      }

      // Create batches
      for (const bName of def.batches) {
        const bCode = `${def.code}-${bName.replace(/\s+/g, '').toUpperCase()}`;
        const batchExists = await this.prisma.batch.findFirst({
          where: { classId: cls.id, name: bName },
        });
        if (!batchExists) {
          await this.prisma.batch.create({
            data: {
              classId: cls.id,
              name: bName,
              code: bCode,
              isActive: true,
            },
          });
        }
      }

      createdClasses.push(cls);
    }

    // Create Skill Courses
    for (const def of skillDefs) {
      let cls = await this.prisma.class.findFirst({ where: { code: def.code } });
      if (!cls) {
        cls = await this.prisma.class.create({
          data: {
            name: def.name,
            code: def.code,
            description: def.description,
            category: CourseCategory.SKILL,
            academicYearId: academicYear.id,
            isActive: true,
          },
        });
      }

      for (const bName of def.batches) {
        const bCode = `${def.code}-${bName.replace(/\s+/g, '').toUpperCase()}`;
        const batchExists = await this.prisma.batch.findFirst({
          where: { classId: cls.id, name: bName },
        });
        if (!batchExists) {
          await this.prisma.batch.create({
            data: {
              classId: cls.id,
              name: bName,
              code: bCode,
              isActive: true,
            },
          });
        }
      }

      createdClasses.push(cls);
    }

    return {
      message: `Bootstrapped ${createdClasses.length} academic standards and skill courses with core subjects and batches`,
      count: createdClasses.length,
    };
  }
}


