import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  StudentStatus,
  AttendanceStatus,
  InvoiceStatus,
  ExaminationStatus,
  UserRoleType,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(user?: any) {
    const roles: string[] = user?.roles || [];
    const isSuperAdmin = roles.includes(UserRoleType.SUPER_ADMIN);
    const isAcademyAdmin = roles.includes(UserRoleType.ACADEMY_ADMIN);
    const isPrivileged = isSuperAdmin || isAcademyAdmin;
    const isAccountant = roles.includes(UserRoleType.ACCOUNTANT);
    const isStaffOrTeacher = roles.includes(UserRoleType.STAFF) || roles.includes(UserRoleType.TEACHER);

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthName = now.toLocaleString('en-IN', { month: 'long' });

    // 1. Super Admin & Academy Admin: Full Academy Metrics
    if (isPrivileged || (!user && !isAccountant && !isStaffOrTeacher)) {
      const [
        activeStudents,
        todayAttendancePresent,
        todayAttendanceTotal,
        currentMonthUnpaidInvoices,
        unpaidInvoices,
        upcomingExams,
        pendingEvaluations,
      ] = await Promise.all([
        this.prisma.student.count({ where: { status: StudentStatus.ACTIVE } }),
        this.prisma.attendanceRecord.count({
          where: {
            recordedAt: { gte: today },
            status: AttendanceStatus.PRESENT,
          },
        }),
        this.prisma.attendanceRecord.count({
          where: { recordedAt: { gte: today } },
        }),
        this.prisma.feeInvoice.aggregate({
          where: {
            status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
            OR: [
              { dueDate: { gte: startOfMonth, lte: endOfMonth } },
              { createdAt: { gte: startOfMonth, lte: endOfMonth } },
            ],
          },
          _sum: { balanceAmount: true },
          _count: true,
        }),
        this.prisma.feeInvoice.aggregate({
          where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] } },
          _sum: { balanceAmount: true },
          _count: true,
        }),
        this.prisma.examination.count({
          where: {
            status: { in: [ExaminationStatus.DRAFT, ExaminationStatus.SCHEDULED] },
          },
        }),
        this.prisma.studentSubmission.count({
          where: { status: 'AI_EVALUATED' },
        }),
      ]);

      const attendanceRate =
        todayAttendanceTotal > 0
          ? Math.round((todayAttendancePresent / todayAttendanceTotal) * 100)
          : 0;

      return {
        activeStudents,
        todayAttendance: {
          present: todayAttendancePresent,
          total: todayAttendanceTotal,
          rate: attendanceRate,
        },
        finance: {
          currentMonthPending: Number(currentMonthUnpaidInvoices._sum.balanceAmount || 0),
          currentMonthInvoicesCount: currentMonthUnpaidInvoices._count,
          totalOutstanding: Number(unpaidInvoices._sum.balanceAmount || 0),
          pendingInvoicesCount: unpaidInvoices._count,
          monthName,
        },
        academics: {
          upcomingExams,
          pendingTeacherReviews: pendingEvaluations,
        },
        systemHealth: {
          apiStatus: 'ONLINE',
          aiServiceStatus: 'ONLINE',
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    // 2. Accountant: Full finance and total student counts, academics hidden
    if (isAccountant && !isStaffOrTeacher) {
      const [activeStudents, currentMonthUnpaidInvoices, unpaidInvoices] = await Promise.all([
        this.prisma.student.count({ where: { status: StudentStatus.ACTIVE } }),
        this.prisma.feeInvoice.aggregate({
          where: {
            status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
            OR: [
              { dueDate: { gte: startOfMonth, lte: endOfMonth } },
              { createdAt: { gte: startOfMonth, lte: endOfMonth } },
            ],
          },
          _sum: { balanceAmount: true },
          _count: true,
        }),
        this.prisma.feeInvoice.aggregate({
          where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] } },
          _sum: { balanceAmount: true },
          _count: true,
        }),
      ]);

      return {
        activeStudents,
        todayAttendance: { present: 0, total: 0, rate: 0 },
        finance: {
          currentMonthPending: Number(currentMonthUnpaidInvoices._sum.balanceAmount || 0),
          currentMonthInvoicesCount: currentMonthUnpaidInvoices._count,
          totalOutstanding: Number(unpaidInvoices._sum.balanceAmount || 0),
          pendingInvoicesCount: unpaidInvoices._count,
          monthName,
        },
        academics: null,
        systemHealth: {
          apiStatus: 'ONLINE',
          aiServiceStatus: 'ONLINE',
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    // 3. Staff / Teacher: Strictly Scoped to Assigned Students and Classes, Finance Hidden
    const staffId = user?.id;
    const [courseAssignments, classSchedules] = await Promise.all([
      this.prisma.staffCourseAssignment.findMany({
        where: { userId: staffId, isActive: true },
        select: { classId: true, batchId: true, subjectId: true },
      }),
      this.prisma.classSchedule.findMany({
        where: { staffId, isActive: true },
        select: { classId: true, batchId: true, subjectId: true },
      }),
    ]);

    const allAssignments = [...courseAssignments, ...classSchedules];
    const directBatchIds = Array.from(new Set(allAssignments.map((a) => a.batchId).filter(Boolean))) as string[];
    const classIds = Array.from(new Set(allAssignments.map((a) => a.classId).filter(Boolean))) as string[];

    let assignedActiveStudents = 0;
    let todayAttendancePresent = 0;
    let todayAttendanceTotal = 0;
    let upcomingExams = 0;
    let pendingEvaluations = 0;

    if (allAssignments.length > 0) {
      const studentWhere: any = {
        status: StudentStatus.ACTIVE,
        batchEnrollments: {
          some: {
            isActive: true,
            OR: [
              ...(directBatchIds.length > 0 ? [{ batchId: { in: directBatchIds } }] : []),
              ...(classIds.length > 0 ? [{ batch: { classId: { in: classIds } } }] : []),
            ],
          },
        },
      };

      const attendanceWhere: any = {
        recordedAt: { gte: today },
        session: {
          OR: [
            ...(directBatchIds.length > 0 ? [{ batchId: { in: directBatchIds } }] : []),
            ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
            { userId: staffId },
          ],
        },
      };

      const examWhere: any = {
        status: { in: [ExaminationStatus.DRAFT, ExaminationStatus.SCHEDULED] },
        OR: [
          ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
          { invigilatorId: staffId },
        ],
      };

      const submissionWhere: any = {
        status: 'AI_EVALUATED',
        examination: {
          OR: [
            ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
            { invigilatorId: staffId },
          ],
        },
      };

      [
        assignedActiveStudents,
        todayAttendancePresent,
        todayAttendanceTotal,
        upcomingExams,
        pendingEvaluations,
      ] = await Promise.all([
        this.prisma.student.count({ where: studentWhere }),
        this.prisma.attendanceRecord.count({
          where: { ...attendanceWhere, status: AttendanceStatus.PRESENT },
        }),
        this.prisma.attendanceRecord.count({ where: attendanceWhere }),
        this.prisma.examination.count({ where: examWhere }),
        this.prisma.studentSubmission.count({ where: submissionWhere }),
      ]);
    }

    const attendanceRate =
      todayAttendanceTotal > 0
        ? Math.round((todayAttendancePresent / todayAttendanceTotal) * 100)
        : 0;

    return {
      activeStudents: assignedActiveStudents,
      todayAttendance: {
        present: todayAttendancePresent,
        total: todayAttendanceTotal,
        rate: attendanceRate,
      },
      finance: null, // Strictly hidden for staff / teacher roles
      academics: {
        upcomingExams,
        pendingTeacherReviews: pendingEvaluations,
      },
      systemHealth: {
        apiStatus: 'ONLINE',
        aiServiceStatus: 'ONLINE',
        lastUpdated: new Date().toISOString(),
      },
      assignedStats: {
        assignedCoursesCount: classIds.length,
        assignedBatchesCount: directBatchIds.length,
      },
    };
  }
}
