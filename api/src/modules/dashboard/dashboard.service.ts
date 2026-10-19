import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentStatus, AttendanceStatus, InvoiceStatus, ExaminationStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activeStudents,
      todayAttendancePresent,
      todayAttendanceTotal,
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
        totalOutstanding: Number(unpaidInvoices._sum.balanceAmount || 0),
        pendingInvoicesCount: unpaidInvoices._count,
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
}
