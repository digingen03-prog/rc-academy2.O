import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import {
  AttendanceCodeService,
  AttendanceCodeEntityType,
} from '../attendance/attendance-code.service';
import {
  CreateStaffDto,
  UpdateStaffDto,
  AssignStaffCoursesDto,
  CourseAssignmentItemDto,
} from './dto/staff.dto';
import { UserRoleType, UserStatus, StaffCategory, CompensationModel, PayFrequency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { parseStaffSettlementRule } from './staff-settlement.helper';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceCodeService: AttendanceCodeService,
  ) {}

  async findAll(query: { search?: string; role?: string; status?: UserStatus }) {
    const where: any = {
      // Exclude pure student users if any
      userRoles: {
        some: {
          role: {
            name: {
              in: ['SUPER_ADMIN', 'ACADEMY_ADMIN', 'TEACHER', 'ACCOUNTANT', 'STAFF'],
            },
          },
        },
      },
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.userRoles = {
        some: {
          role: { name: query.role as UserRoleType },
        },
      };
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { attendanceCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const staffMembers = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        userRoles: {
          include: { role: true },
        },
        staffAssignments: {
          where: { isActive: true },
          include: {
            class: true,
            batch: true,
            subject: true,
          },
        },
        _count: {
          select: {
            staffAttendanceRecords: true,
          },
        },
      },
    });

    return staffMembers.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      email: s.email,
      phone: s.phone,
      designation: s.designation,
      staffCategory: s.staffCategory,
      compensationModel: s.compensationModel,
      fixedSalaryAmount: Number(s.fixedSalaryAmount),
      payFrequency: s.payFrequency,
      compensationEffectiveDate: s.compensationEffectiveDate,
      attendanceCode: s.attendanceCode,
      status: s.status,
      roles: s.userRoles.map((ur) => ur.role.name),
      primaryRole: s.userRoles[0]?.role.name || 'STAFF',
      assignments: s.staffAssignments.map((a) => ({
        id: a.id,
        courseId: a.classId,
        courseName: a.class.name,
        courseCode: a.class.code,
        batchId: a.batchId,
        batchName: a.batch?.name || null,
        batchCode: a.batch?.code || null,
        subjectId: a.subjectId || null,
        subjectName: a.subject?.name || null,
        subjectCode: a.subject?.code || null,
        role: a.role,
        staffSharePercentage: Number(a.staffSharePercentage),
        compensationRule: a.compensationRule,
        ...(() => {
          const parsed = parseStaffSettlementRule(a.compensationRule, Number(a.staffSharePercentage));
          return {
            settlementConfig: parsed.config,
            settlementRuleSummary: parsed.displayText,
            settlementRuleBadge: parsed.badgeText,
            settlementRuleMode: parsed.mode,
          };
        })(),
        isActive: a.isActive,
        startDate: a.startDate,
        endDate: a.endDate,
        assignedAt: a.startDate,
      })),
      totalAttendanceRecorded: s._count.staffAttendanceRecords,
      createdAt: s.createdAt,
    }));
  }

  async findOne(id: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { role: true },
        },
        staffAssignments: {
          include: {
            class: true,
            batch: true,
            subject: true,
          },
        },
        staffAttendanceRecords: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return {
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      fullName: `${staff.firstName} ${staff.lastName}`,
      email: staff.email,
      phone: staff.phone,
      designation: staff.designation,
      staffCategory: staff.staffCategory,
      compensationModel: staff.compensationModel,
      fixedSalaryAmount: Number(staff.fixedSalaryAmount),
      payFrequency: staff.payFrequency,
      compensationEffectiveDate: staff.compensationEffectiveDate,
      attendanceCode: staff.attendanceCode,
      status: staff.status,
      roles: staff.userRoles.map((ur) => ur.role.name),
      primaryRole: staff.userRoles[0]?.role.name || 'STAFF',
      assignments: staff.staffAssignments.map((a) => ({
        id: a.id,
        courseId: a.classId,
        courseName: a.class.name,
        courseCode: a.class.code,
        batchId: a.batchId,
        batchName: a.batch?.name || null,
        batchCode: a.batch?.code || null,
        subjectId: a.subjectId || null,
        subjectName: a.subject?.name || null,
        subjectCode: a.subject?.code || null,
        role: a.role,
        staffSharePercentage: Number(a.staffSharePercentage),
        compensationRule: a.compensationRule,
        ...(() => {
          const parsed = parseStaffSettlementRule(a.compensationRule, Number(a.staffSharePercentage));
          return {
            settlementConfig: parsed.config,
            settlementRuleSummary: parsed.displayText,
            settlementRuleBadge: parsed.badgeText,
            settlementRuleMode: parsed.mode,
          };
        })(),
        isActive: a.isActive,
        startDate: a.startDate,
        endDate: a.endDate,
        assignedAt: a.startDate,
      })),
      recentAttendance: staff.staffAttendanceRecords,
      createdAt: staff.createdAt,
    };
  }

  async create(dto: CreateStaffDto, actorId?: string) {
    let firstName = dto.firstName?.trim() || '';
    let lastName = dto.lastName?.trim() || '';

    if (dto.name) {
      const parts = dto.name.trim().split(/\s+/);
      firstName = parts[0] || 'Staff';
      lastName = parts.slice(1).join(' ') || '.';
    } else if (!firstName) {
      firstName = 'Staff';
      lastName = lastName || '.';
    } else if (!lastName) {
      lastName = '.';
    }

    const cleanPhone = (dto.phone || '').trim().replace(/\D/g, '');
    let normalizedEmail = dto.email && dto.email.trim()
      ? dto.email.trim().toLowerCase()
      : `staff_${cleanPhone || Date.now()}@rcacademy.local`;

    // Check duplicate email
    let existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing && !dto.email) {
      normalizedEmail = `staff_${cleanPhone}_${Date.now()}@rcacademy.local`;
    } else if (existing) {
      throw new ConflictException(`User with email '${normalizedEmail}' already exists`);
    }

    // Resolve Role (support 'ADMIN' -> 'ACADEMY_ADMIN' and 'SUPER_ADMIN')
    let targetRoleName = (dto.role || '').trim().toUpperCase();
    if (targetRoleName === 'ADMIN') {
      targetRoleName = 'ACADEMY_ADMIN';
    }

    const roleRecord = await this.prisma.role.findFirst({
      where: { name: targetRoleName as UserRoleType },
    });
    if (!roleRecord) {
      throw new BadRequestException(`Role '${dto.role}' not recognized`);
    }

    // Only SUPER_ADMIN can create another SUPER_ADMIN
    if (roleRecord.name === UserRoleType.SUPER_ADMIN && actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        include: { userRoles: { include: { role: true } } },
      });
      const isSuperAdmin = actor?.userRoles.some((ur) => ur.role.name === UserRoleType.SUPER_ADMIN);
      if (!isSuperAdmin) {
        throw new ForbiddenException('Only a Super Admin can create another Super Admin account.');
      }
    }

    // Validate course/batch/subject assignments if provided
    if (dto.courseAssignments && dto.courseAssignments.length > 0) {
      for (const assign of dto.courseAssignments) {
        const course = await this.prisma.class.findUnique({
          where: { id: assign.courseId },
        });
        if (!course) {
          throw new NotFoundException(`Course ${assign.courseId} not found`);
        }
        if (assign.batchId) {
          const batch = await this.prisma.batch.findUnique({
            where: { id: assign.batchId },
          });
          if (!batch || batch.classId !== assign.courseId) {
            throw new BadRequestException(
              `Batch ${assign.batchId} does not belong to course ${assign.courseId}`,
            );
          }
        }
        if (assign.subjectId) {
          const subject = await this.prisma.subject.findUnique({
            where: { id: assign.subjectId },
          });
          if (!subject || subject.classId !== assign.courseId) {
            throw new BadRequestException(
              `Subject ${assign.subjectId} does not belong to course ${assign.courseId}`,
            );
          }
        }
      }
    }

    // Default password if not given: Admin accounts get Admin@12345, staff get Staff@12345
    const isAdminRole =
      roleRecord.name === UserRoleType.SUPER_ADMIN || roleRecord.name === UserRoleType.ACADEMY_ADMIN;
    const plainPassword = dto.password?.trim() || (isAdminRole ? 'Admin@12345' : 'Staff@12345');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      const staffCategory = dto.staffCategory
        ? (dto.staffCategory as StaffCategory)
        : roleRecord.name === 'TEACHER'
        ? StaffCategory.FACULTY
        : StaffCategory.GENERAL;

      const compensationModel = dto.compensationModel
        ? (dto.compensationModel as CompensationModel)
        : staffCategory === StaffCategory.FACULTY
        ? CompensationModel.REVENUE_SHARING
        : CompensationModel.FIXED_SALARY;

      const fixedSalaryAmount =
        dto.fixedSalaryAmount !== undefined
          ? new Decimal(dto.fixedSalaryAmount)
          : new Decimal(0);

      const payFrequency = (dto.payFrequency as PayFrequency) || PayFrequency.MONTHLY;

      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName,
          lastName,
          phone: dto.phone.trim(),
          designation: dto.designation?.trim(),
          staffCategory,
          compensationModel,
          fixedSalaryAmount,
          payFrequency,
          compensationEffectiveDate: dto.compensationEffectiveDate
            ? new Date(dto.compensationEffectiveDate)
            : new Date(),
          status: UserStatus.ACTIVE,
        },
      });

      // 2. Assign Role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: roleRecord.id,
        },
      });

      // 3. Allocate unique 3-digit attendance code
      const attendanceCode = await this.attendanceCodeService.allocateCode(
        tx,
        AttendanceCodeEntityType.STAFF,
        user.id,
      );

      // 4. Create assignments
      if (dto.courseAssignments && dto.courseAssignments.length > 0) {
        for (const assign of dto.courseAssignments) {
          const compRule = assign.settlementConfig
            ? (typeof assign.settlementConfig === 'string' ? assign.settlementConfig : JSON.stringify(assign.settlementConfig))
            : assign.compensationRule || 'REVENUE_SHARE_70_30';

          let sharePercent = assign.staffSharePercentage !== undefined
            ? new Decimal(assign.staffSharePercentage)
            : new Decimal(70.0);

          if (assign.settlementConfig && typeof assign.settlementConfig === 'object') {
            if (assign.settlementConfig.mode === 'STUDENT_TIER_BASED' && assign.settlementConfig.singleSubject?.type === 'PERCENTAGE') {
              sharePercent = new Decimal(assign.settlementConfig.singleSubject.value);
            } else if (assign.settlementConfig.mode === 'REVENUE_SHARE_PERCENTAGE' && assign.settlementConfig.staffSharePercentage !== undefined) {
              sharePercent = new Decimal(assign.settlementConfig.staffSharePercentage);
            }
          }

          await tx.staffCourseAssignment.create({
            data: {
              userId: user.id,
              classId: assign.courseId,
              batchId: assign.batchId || null,
              subjectId: assign.subjectId || null,
              role: assign.role || dto.role,
              staffSharePercentage: sharePercent,
              compensationRule: compRule,
              startDate: assign.startDate ? new Date(assign.startDate) : new Date(),
              endDate: assign.endDate ? new Date(assign.endDate) : null,
              isActive: assign.isActive !== undefined ? assign.isActive : true,
            },
          });
        }
      }

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_CREATE',
          entityType: 'User',
          entityId: user.id,
          details: {
            email: user.email,
            role: roleRecord.name,
            attendanceCode,
            assignmentsCount: dto.courseAssignments?.length || 0,
          },
        },
      });

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        designation: user.designation,
        role: roleRecord.name,
        attendanceCode,
        message: 'Staff member onboarded successfully',
      };
    });
  }

  async update(id: string, dto: UpdateStaffDto, actorId?: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Update core user attributes - NEVER alter attendanceCode
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(dto.firstName && { firstName: dto.firstName.trim() }),
          ...(dto.lastName && { lastName: dto.lastName.trim() }),
          ...(dto.phone !== undefined && { phone: dto.phone?.trim() }),
          ...(dto.designation !== undefined && { designation: dto.designation?.trim() }),
          ...(dto.staffCategory && { staffCategory: dto.staffCategory as StaffCategory }),
          ...(dto.compensationModel && { compensationModel: dto.compensationModel as CompensationModel }),
          ...(dto.fixedSalaryAmount !== undefined && { fixedSalaryAmount: new Decimal(dto.fixedSalaryAmount) }),
          ...(dto.payFrequency && { payFrequency: dto.payFrequency as PayFrequency }),
          ...(dto.compensationEffectiveDate && { compensationEffectiveDate: new Date(dto.compensationEffectiveDate) }),
          ...(dto.status && { status: dto.status }),
        },
      });

      // Update role if changed
      if (dto.role) {
        let targetRole = dto.role.trim().toUpperCase();
        if (targetRole === 'ADMIN') {
          targetRole = 'ACADEMY_ADMIN';
        }
        const newRole = await tx.role.findFirst({
          where: { name: targetRole as UserRoleType },
        });
        if (!newRole) {
          throw new BadRequestException(`Role '${dto.role}' not recognized`);
        }

        if (newRole.name === UserRoleType.SUPER_ADMIN && actorId) {
          const actor = await this.prisma.user.findUnique({
            where: { id: actorId },
            include: { userRoles: { include: { role: true } } },
          });
          const isSuperAdmin = actor?.userRoles.some((ur) => ur.role.name === UserRoleType.SUPER_ADMIN);
          if (!isSuperAdmin) {
            throw new ForbiddenException('Only a Super Admin can promote a user to Super Admin.');
          }
        }

        await tx.userRole.deleteMany({
          where: { userId: id },
        });
        await tx.userRole.create({
          data: {
            userId: id,
            roleId: newRole.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_UPDATE',
          entityType: 'User',
          entityId: id,
          details: { ...dto } as any,
        },
      });

      return updatedUser;
    });
  }

  async assignCourses(staffId: string, dto: AssignStaffCoursesDto, actorId?: string) {
    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} not found`);
    }

    // Validate all assignments
    for (const assign of dto.assignments) {
      const course = await this.prisma.class.findUnique({
        where: { id: assign.courseId },
      });
      if (!course) {
        throw new NotFoundException(`Course ${assign.courseId} not found`);
      }
      if (assign.batchId) {
        const batch = await this.prisma.batch.findUnique({
          where: { id: assign.batchId },
        });
        if (!batch || batch.classId !== assign.courseId) {
          throw new BadRequestException(
            `Batch ${assign.batchId} does not belong to course ${assign.courseId}`,
          );
        }
      }
      if (assign.subjectId) {
        const subject = await this.prisma.subject.findUnique({
          where: { id: assign.subjectId },
        });
        if (!subject || subject.classId !== assign.courseId) {
          throw new BadRequestException(
            `Subject ${assign.subjectId} does not belong to course ${assign.courseId}`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const createdAssignments = [];

      for (const assign of dto.assignments) {
        // Check if existing assignment exists for (userId, classId, subjectId, batchId)
        const existing = await tx.staffCourseAssignment.findFirst({
          where: {
            userId: staffId,
            classId: assign.courseId,
            subjectId: assign.subjectId || null,
            batchId: assign.batchId || null,
          },
        });

        const compRule = assign.settlementConfig
          ? (typeof assign.settlementConfig === 'string' ? assign.settlementConfig : JSON.stringify(assign.settlementConfig))
          : assign.compensationRule;

        let sharePercent = assign.staffSharePercentage !== undefined
          ? new Decimal(assign.staffSharePercentage)
          : undefined;

        if (assign.settlementConfig && typeof assign.settlementConfig === 'object') {
          if (assign.settlementConfig.mode === 'STUDENT_TIER_BASED' && assign.settlementConfig.singleSubject?.type === 'PERCENTAGE') {
            sharePercent = new Decimal(assign.settlementConfig.singleSubject.value);
          } else if (assign.settlementConfig.mode === 'REVENUE_SHARE_PERCENTAGE' && assign.settlementConfig.staffSharePercentage !== undefined) {
            sharePercent = new Decimal(assign.settlementConfig.staffSharePercentage);
          }
        }

        if (existing) {
          const updated = await tx.staffCourseAssignment.update({
            where: { id: existing.id },
            data: {
              isActive: assign.isActive !== undefined ? assign.isActive : true,
              role: assign.role || existing.role,
              ...(sharePercent !== undefined && {
                staffSharePercentage: sharePercent,
              }),
              ...(compRule && { compensationRule: compRule }),
              ...(assign.startDate && { startDate: new Date(assign.startDate) }),
              ...(assign.endDate !== undefined && {
                endDate: assign.endDate ? new Date(assign.endDate) : null,
              }),
            },
          });
          createdAssignments.push(updated);
        } else {
          const newAssign = await tx.staffCourseAssignment.create({
            data: {
              userId: staffId,
              classId: assign.courseId,
              subjectId: assign.subjectId || null,
              batchId: assign.batchId || null,
              role: assign.role || 'INSTRUCTOR',
              staffSharePercentage: sharePercent || new Decimal(70.0),
              compensationRule: compRule || 'REVENUE_SHARE_70_30',
              startDate: assign.startDate ? new Date(assign.startDate) : new Date(),
              endDate: assign.endDate ? new Date(assign.endDate) : null,
              isActive: true,
            },
          });
          createdAssignments.push(newAssign);
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ASSIGNMENT_CHANGE',
          entityType: 'StaffCourseAssignment',
          entityId: staffId,
          details: { assignedCount: createdAssignments.length },
        },
      });

      return createdAssignments;
    });
  }

  async updateAssignment(
    staffId: string,
    assignmentId: string,
    dto: Partial<CourseAssignmentItemDto>,
    actorId?: string,
  ) {
    const assignment = await this.prisma.staffCourseAssignment.findFirst({
      where: { id: assignmentId, userId: staffId },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found for staff ${staffId}`);
    }

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({
        where: { id: dto.subjectId },
      });
      if (!subject || subject.classId !== assignment.classId) {
        throw new BadRequestException(
          `Subject ${dto.subjectId} does not belong to course ${assignment.classId}`,
        );
      }
    }

    const compRule = dto.settlementConfig
      ? (typeof dto.settlementConfig === 'string' ? dto.settlementConfig : JSON.stringify(dto.settlementConfig))
      : dto.compensationRule;

    let sharePercent = dto.staffSharePercentage !== undefined
      ? new Decimal(dto.staffSharePercentage)
      : undefined;

    if (dto.settlementConfig && typeof dto.settlementConfig === 'object') {
      if (dto.settlementConfig.mode === 'STUDENT_TIER_BASED' && dto.settlementConfig.singleSubject?.type === 'PERCENTAGE') {
        sharePercent = new Decimal(dto.settlementConfig.singleSubject.value);
      } else if (dto.settlementConfig.mode === 'REVENUE_SHARE_PERCENTAGE' && dto.settlementConfig.staffSharePercentage !== undefined) {
        sharePercent = new Decimal(dto.settlementConfig.staffSharePercentage);
      }
    }

    const updated = await this.prisma.staffCourseAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(dto.role && { role: dto.role }),
        ...(dto.subjectId !== undefined && { subjectId: dto.subjectId || null }),
        ...(sharePercent !== undefined && {
          staffSharePercentage: sharePercent,
        }),
        ...(compRule && { compensationRule: compRule }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ASSIGNMENT_UPDATED',
          entityType: 'StaffCourseAssignment',
          entityId: assignmentId,
          details: { ...dto } as any,
        },
      });
    }

    return updated;
  }

  async removeAssignment(staffId: string, assignmentId: string, actorId?: string) {
    const assignment = await this.prisma.staffCourseAssignment.findFirst({
      where: { id: assignmentId, userId: staffId },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment ${assignmentId} not found for staff ${staffId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Soft-deactivate to preserve assignment history
      const updated = await tx.staffCourseAssignment.update({
        where: { id: assignmentId },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_ASSIGNMENT_REMOVED',
          entityType: 'StaffCourseAssignment',
          entityId: assignmentId,
          details: { userId: staffId, classId: assignment.classId, batchId: assignment.batchId },
        },
      });

      return updated;
    });
  }

  async remove(staffId: string, actorId?: string) {
    if (actorId && staffId === actorId) {
      throw new BadRequestException('You cannot delete your own account.');
    }

    const staff = await this.prisma.user.findUnique({
      where: { id: staffId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffId} not found`);
    }

    // Check if user is the only SUPER_ADMIN
    const isSuperAdmin = staff.userRoles.some((ur) => ur.role.name === UserRoleType.SUPER_ADMIN);
    if (isSuperAdmin) {
      const superAdminCount = await this.prisma.userRole.count({
        where: { role: { name: UserRoleType.SUPER_ADMIN } },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the sole Super Admin of the academy.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Release assigned attendance code so 3-digit code can be reused
      await tx.attendanceCode.deleteMany({
        where: { userId: staffId },
      });

      // 2. Reassign creator/recorder references to actor or fallback admin
      let fallbackUserId = actorId;
      if (!fallbackUserId || fallbackUserId === staffId) {
        const anyAdmin = await tx.user.findFirst({
          where: { id: { not: staffId } },
          select: { id: true },
        });
        fallbackUserId = anyAdmin?.id;
      }

      if (fallbackUserId) {
        await tx.attendanceSession.updateMany({
          where: { createdById: staffId },
          data: { createdById: fallbackUserId },
        });

        await tx.attendanceRecord.updateMany({
          where: { recordedById: staffId },
          data: { recordedById: fallbackUserId },
        });

        await tx.payment.updateMany({
          where: { recordedById: staffId },
          data: { recordedById: fallbackUserId },
        });

        await tx.staffSalaryPayout.updateMany({
          where: { approvedById: staffId },
          data: { approvedById: fallbackUserId },
        });

        await tx.feeAdjustment.updateMany({
          where: { authorizedById: staffId },
          data: { authorizedById: fallbackUserId },
        });
      }

      // 3. Delete daily schedule exceptions & class schedules
      await tx.dailyScheduleException.deleteMany({
        where: { staffId },
      });
      await tx.classSchedule.deleteMany({
        where: { staffId },
      });

      // 4. Delete teacher reviews
      await tx.teacherReview.deleteMany({
        where: { teacherId: staffId },
      });

      // 5. Delete staff attendance records
      await tx.staffAttendanceRecord.deleteMany({
        where: { userId: staffId },
      });

      // 6. Delete salary ledgers and payouts
      await tx.staffSalaryLedger.deleteMany({
        where: { userId: staffId },
      });
      await tx.staffSalaryPayout.deleteMany({
        where: { userId: staffId },
      });

      // 7. Delete staff course assignments
      await tx.staffCourseAssignment.deleteMany({
        where: { userId: staffId },
      });

      // 8. Delete user roles
      await tx.userRole.deleteMany({
        where: { userId: staffId },
      });

      // 9. Delete user
      await tx.user.delete({
        where: { id: staffId },
      });

      // 10. Audit log
      if (actorId) {
        await tx.auditLog.create({
          data: {
            actorId,
            action: 'STAFF_DELETED',
            entityType: 'User',
            entityId: staffId,
            details: {
              name: `${staff.firstName} ${staff.lastName}`,
              email: staff.email,
              attendanceCode: staff.attendanceCode,
              designation: staff.designation,
            },
          },
        });
      }

      return {
        message: `Staff member '${staff.firstName} ${staff.lastName}' deleted successfully`,
        deletedId: staffId,
        releasedAttendanceCode: staff.attendanceCode,
      };
    });
  }
}
