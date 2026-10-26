import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  AttendanceCodeService,
  AttendanceCodeEntityType,
} from './attendance-code.service';
import {
  QuickMarkDto,
  StaffQuickMarkDto,
  CreateSessionDto,
  StartClassSessionDto,
  MarkStudentDto,
  BulkMarkStudentsDto,
  CreateCorrectionDto,
  CloseSessionDto,
  AttendanceHistoryQueryDto,
  StaffAttendanceManualDto,
} from './dto/quick-mark.dto';
import {
  AttendanceStatus,
  SessionType,
  SessionStatus,
  StudentStatus,
  ScheduleDayOfWeek,
  ScheduleExceptionStatus,
} from '@prisma/client';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceCodeService: AttendanceCodeService,
  ) {}

  async getCapacityStatus() {
    return this.attendanceCodeService.getCapacityStatus();
  }

  // ==========================================
  // TIMEZONE & DATE RESOLUTION
  // ==========================================

  async getAcademyTimezone(): Promise<string> {
    const config = await this.prisma.academyScheduleConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });
    return config?.timezone || 'Asia/Kolkata';
  }

  async getAcademyTodayDateString(targetDate?: string): Promise<{
    dateStr: string;
    dateObj: Date;
    dayOfWeek: ScheduleDayOfWeek;
    timezone: string;
    dateFormatted: string;
  }> {
    const tz = await this.getAcademyTimezone();
    let dateStr = targetDate;
    if (!dateStr) {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(now);
      const year = parts.find((p) => p.type === 'year')!.value;
      const month = parts.find((p) => p.type === 'month')!.value;
      const day = parts.find((p) => p.type === 'day')!.value;
      dateStr = `${year}-${month}-${day}`;
    }

    const dateObj = new Date(`${dateStr}T00:00:00Z`);
    const days = [
      ScheduleDayOfWeek.SUNDAY,
      ScheduleDayOfWeek.MONDAY,
      ScheduleDayOfWeek.TUESDAY,
      ScheduleDayOfWeek.WEDNESDAY,
      ScheduleDayOfWeek.THURSDAY,
      ScheduleDayOfWeek.FRIDAY,
      ScheduleDayOfWeek.SATURDAY,
    ];
    const dayOfWeek = days[dateObj.getUTCDay()];

    const dateFormatted = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${dateStr}T12:00:00Z`));

    return { dateStr, dateObj, dayOfWeek, timezone: tz, dateFormatted };
  }

  // ==========================================
  // TODAY'S CLASSES & SESSIONS OVERVIEW
  // ==========================================

  async getTodayClassesAndSessions(actorId: string, isTeacher: boolean, targetDate?: string) {
    const { dateStr, dateObj, dayOfWeek, timezone, dateFormatted } =
      await this.getAcademyTodayDateString(targetDate);

    // 1. Fetch recurring schedules for dayOfWeek
    const recurringSchedules = await this.prisma.classSchedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
        OR: [
          { effectiveStartDate: null },
          { effectiveStartDate: { lte: dateObj } },
        ],
        AND: [
          {
            OR: [
              { effectiveEndDate: null },
              { effectiveEndDate: { gte: dateObj } },
            ],
          },
        ],
      },
      include: {
        class: true,
        subject: true,
        batch: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: { student: true },
            },
          },
        },
        staff: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    // 2. Fetch exceptions for today's date
    const dailyExceptions = await this.prisma.dailyScheduleException.findMany({
      where: { date: dateObj },
      include: {
        class: true,
        subject: true,
        batch: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: { student: true },
            },
          },
        },
        staff: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    const exceptionMap = new Map<string, any>();
    const resolvedClasses: any[] = [];

    // Add special classes from exceptions
    for (const ex of dailyExceptions) {
      if (ex.scheduleId) {
        exceptionMap.set(ex.scheduleId, ex);
      } else {
        resolvedClasses.push({
          id: `exc-${ex.id}`,
          scheduleId: null,
          exceptionId: ex.id,
          classId: ex.classId,
          className: ex.class.name,
          classCode: ex.class.code,
          subjectId: ex.subjectId,
          subjectName: ex.subject.name,
          subjectCode: ex.subject.code,
          batchId: ex.batchId,
          batchName: ex.batch?.name || 'All Batches',
          batch: ex.batch,
          staffId: ex.staffId,
          teacherId: ex.staffId,
          teacherName: `${ex.staff.firstName} ${ex.staff.lastName}`,
          teacherEmail: ex.staff.email,
          startTime: ex.startTime,
          endTime: ex.endTime,
          room: ex.room || null,
          isException: true,
          isSpecialClass: ex.status === ScheduleExceptionStatus.SPECIAL_CLASS,
          isCancelled: ex.status === ScheduleExceptionStatus.CANCELLED,
          cancellationReason: ex.cancellationReason || null,
          exceptionStatus: ex.status,
          notes: ex.notes,
        });
      }
    }

    // Process recurring schedules
    for (const rec of recurringSchedules) {
      const ex = exceptionMap.get(rec.id);
      if (ex) {
        if (ex.status === ScheduleExceptionStatus.CANCELLED) {
          resolvedClasses.push({
            id: rec.id,
            scheduleId: rec.id,
            exceptionId: ex.id,
            classId: rec.classId,
            className: rec.class.name,
            classCode: rec.class.code,
            subjectId: rec.subjectId,
            subjectName: rec.subject.name,
            subjectCode: rec.subject.code,
            batchId: rec.batchId,
            batchName: rec.batch?.name || 'All Batches',
            batch: rec.batch,
            staffId: rec.staffId,
            teacherId: rec.staffId,
            teacherName: `${rec.staff.firstName} ${rec.staff.lastName}`,
            teacherEmail: rec.staff.email,
            startTime: rec.startTime,
            endTime: rec.endTime,
            room: rec.room || null,
            isCancelled: true,
            cancellationReason: ex.cancellationReason || 'Class cancelled by admin',
            exceptionStatus: ex.status,
            notes: ex.notes,
          });
        } else {
          // Substituted or rescheduled
          resolvedClasses.push({
            id: rec.id,
            scheduleId: rec.id,
            exceptionId: ex.id,
            classId: ex.classId || rec.classId,
            className: ex.class?.name || rec.class.name,
            classCode: ex.class?.code || rec.class.code,
            subjectId: ex.subjectId || rec.subjectId,
            subjectName: ex.subject?.name || rec.subject.name,
            subjectCode: ex.subject?.code || rec.subject.code,
            batchId: ex.batchId || rec.batchId,
            batchName: ex.batch?.name || rec.batch?.name || 'All Batches',
            batch: ex.batch || rec.batch,
            staffId: ex.staffId || rec.staffId,
            teacherId: ex.staffId || rec.staffId,
            teacherName: `${(ex.staff || rec.staff).firstName} ${(ex.staff || rec.staff).lastName}`,
            teacherEmail: (ex.staff || rec.staff).email,
            startTime: ex.startTime || rec.startTime,
            endTime: ex.endTime || rec.endTime,
            room: ex.room || rec.room || null,
            isSubstituted: ex.status === ScheduleExceptionStatus.SUBSTITUTED,
            isRescheduled: ex.status === ScheduleExceptionStatus.RESCHEDULED,
            isCancelled: false,
            exceptionStatus: ex.status,
            notes: ex.notes,
          });
        }
      } else {
        // Standard recurring class
        resolvedClasses.push({
          id: rec.id,
          scheduleId: rec.id,
          exceptionId: null,
          classId: rec.classId,
          className: rec.class.name,
          classCode: rec.class.code,
          subjectId: rec.subjectId,
          subjectName: rec.subject.name,
          subjectCode: rec.subject.code,
          batchId: rec.batchId,
          batchName: rec.batch?.name || 'All Batches',
          batch: rec.batch,
          staffId: rec.staffId,
          teacherId: rec.staffId,
          teacherName: `${rec.staff.firstName} ${rec.staff.lastName}`,
          teacherEmail: rec.staff.email,
          startTime: rec.startTime,
          endTime: rec.endTime,
          room: rec.room || null,
          isCancelled: false,
          isException: false,
        });
      }
    }

    // Chronological order
    resolvedClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 3. Filter by teacher if actor is a teacher
    const authorizedClasses = isTeacher
      ? resolvedClasses.filter((c) => c.teacherId === actorId)
      : resolvedClasses;

    // 4. Auto-close sessions at 09:30 PM policy for today/past dates
    const now = new Date();
    const tzFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentTimeStr = tzFormatter.format(now);
    const { dateStr: todayDateStr } = await this.getAcademyTodayDateString();
    const isPastDateOrPast930PM =
      dateStr < todayDateStr || (dateStr === todayDateStr && currentTimeStr >= '21:30');

    if (isPastDateOrPast930PM) {
      await this.prisma.attendanceSession.updateMany({
        where: {
          date: dateObj,
          status: SessionStatus.OPEN,
        },
        data: {
          status: SessionStatus.CLOSED,
        },
      });
    }

    // Load attendance sessions for today
    const sessionsToday = await this.prisma.attendanceSession.findMany({
      where: { date: dateObj },
      include: {
        records: {
          include: { student: true },
        },
      },
    });

    // Map sessions by classScheduleId and by batchId+startTime
    const sessionByScheduleId = new Map<string, any>();
    const sessionByBatchAndTime = new Map<string, any>();

    for (const sess of sessionsToday) {
      if (sess.classScheduleId) {
        sessionByScheduleId.set(sess.classScheduleId, sess);
      }
      if (sess.batchId && sess.startTime) {
        sessionByBatchAndTime.set(`${sess.batchId}_${sess.startTime}`, sess);
      }
      if (sess.batchId && !sess.classScheduleId) {
        sessionByBatchAndTime.set(`${sess.batchId}_default`, sess);
      }
    }

    // 5. Prefetch all active student enrollments
    const allActiveEnrollments = await this.prisma.studentBatchEnrollment.findMany({
      where: {
        isActive: true,
        student: { status: StudentStatus.ACTIVE },
      },
      include: {
        student: true,
        batch: true,
      },
    });

    let classesScheduledToday = 0;
    let sessionsCompleted = 0;
    let sessionsInProgress = 0;
    let upcomingSessions = 0;
    let totalEligibleStudents = 0;
    let totalPresentStudents = 0;

    const classCards = authorizedClasses.map((cls) => {
      if (!cls.isCancelled) {
        classesScheduledToday++;
      }

      // Match session
      const matchedSession =
        (cls.scheduleId && sessionByScheduleId.get(cls.scheduleId)) ||
        (cls.batchId && sessionByBatchAndTime.get(`${cls.batchId}_${cls.startTime}`)) ||
        (cls.batchId && sessionByBatchAndTime.get(`${cls.batchId}_default`)) ||
        null;

      // Collect matching enrollments for this class/batch
      let matchingEnrollments: any[] = [];
      if (cls.batchId) {
        matchingEnrollments = allActiveEnrollments.filter((e) => e.batchId === cls.batchId);
      } else if (cls.classId) {
        matchingEnrollments = allActiveEnrollments.filter((e) => e.batch?.classId === cls.classId);
      }

      // Filter by subject if specified (include students enrolled specifically for subject, or generally without subject)
      let subjectEnrollments = matchingEnrollments;
      if (cls.subjectId) {
        const filtered = matchingEnrollments.filter(
          (e) => e.subjectId === cls.subjectId || e.subjectId === null,
        );
        if (filtered.length > 0) {
          subjectEnrollments = filtered;
        }
      }

      // Deduplicate students
      const enrolledStudentsMap = new Map<string, any>();
      for (const e of subjectEnrollments) {
        if (e.student && e.student.status === StudentStatus.ACTIVE) {
          enrolledStudentsMap.set(e.student.id, e.student);
        }
      }
      const eligibleStudentCount = enrolledStudentsMap.size;

      let sessionStatus = 'NOT_STARTED';
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;
      let unmarkedCount = eligibleStudentCount;
      let attendanceRate = 0;

      if (cls.isCancelled) {
        sessionStatus = 'CANCELLED';
      } else if (matchedSession) {
        sessionStatus = matchedSession.status; // 'OPEN' or 'CLOSED'
        if (sessionStatus === 'CLOSED') {
          sessionsCompleted++;
        } else if (sessionStatus === 'OPEN') {
          sessionsInProgress++;
        }

        const recs = matchedSession.records || [];
        presentCount = recs.filter((r: any) => r.status === AttendanceStatus.PRESENT).length;
        absentCount = recs.filter((r: any) => r.status === AttendanceStatus.ABSENT).length;
        lateCount = recs.filter((r: any) => r.status === AttendanceStatus.LATE).length;
        excusedCount = recs.filter((r: any) => r.status === AttendanceStatus.EXCUSED).length;

        const totalMarked = presentCount + absentCount + lateCount + excusedCount;
        unmarkedCount = Math.max(0, eligibleStudentCount - totalMarked);
        attendanceRate =
          eligibleStudentCount > 0
            ? Math.round(((presentCount + lateCount) / eligibleStudentCount) * 100)
            : 0;

        totalPresentStudents += presentCount + lateCount;
      } else {
        if (!cls.isCancelled) {
          upcomingSessions++;
        }
      }

      if (!cls.isCancelled) {
        totalEligibleStudents += eligibleStudentCount;
      }

      return {
        id: cls.id,
        scheduleId: cls.scheduleId,
        exceptionId: cls.exceptionId,
        classId: cls.classId,
        className: cls.className,
        classCode: cls.classCode,
        subjectId: cls.subjectId,
        subjectName: cls.subjectName,
        subjectCode: cls.subjectCode,
        batchId: cls.batchId,
        batchName: cls.batchName,
        teacherId: cls.teacherId,
        teacherName: cls.teacherName,
        teacherEmail: cls.teacherEmail,
        startTime: cls.startTime,
        endTime: cls.endTime,
        room: cls.room,
        isCancelled: cls.isCancelled,
        cancellationReason: cls.cancellationReason,
        isSpecialClass: cls.isSpecialClass || false,
        isSubstituted: cls.isSubstituted || false,
        sessionId: matchedSession ? matchedSession.id : null,
        sessionStatus: sessionStatus as 'NOT_STARTED' | 'OPEN' | 'CLOSED' | 'CANCELLED',
        isAutoClosed: isPastDateOrPast930PM,
        autoClosePolicy: '09:30 PM',
        eligibleStudentCount,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        unmarkedCount,
        attendanceRate,
      };
    });

    const overallAttendanceRate =
      totalEligibleStudents > 0
        ? Math.round((totalPresentStudents / totalEligibleStudents) * 100)
        : 0;

    return {
      date: dateStr,
      dateFormatted,
      timezone,
      autoClosePolicy: '09:30 PM',
      isAutoClosed: isPastDateOrPast930PM,
      summary: {
        classesScheduledToday,
        sessionsCompleted,
        sessionsInProgress,
        upcomingSessions,
        totalEligibleStudents,
        totalPresentStudents,
        overallAttendanceRate,
      },
      classes: classCards,
    };
  }

  // ==========================================
  // START SESSION FOR A CLASS
  // ==========================================

  async startClassSession(dto: StartClassSessionDto, actorId: string, isTeacher: boolean) {
    const { dateStr, dateObj } = await this.getAcademyTodayDateString(dto.date);

    let batch = null;
    if (dto.batchId) {
      batch = await this.prisma.batch.findUnique({
        where: { id: dto.batchId },
        include: { class: true },
      });
    }

    if (!batch && dto.classId) {
      batch = await this.prisma.batch.findFirst({
        where: { classId: dto.classId, isActive: true },
        include: { class: true },
      });
    }

    if (!batch && dto.scheduleId) {
      const schedule = await this.prisma.classSchedule.findUnique({
        where: { id: dto.scheduleId },
        include: { batch: { include: { class: true } }, class: true },
      });
      if (schedule?.batch) {
        batch = schedule.batch;
      } else if (schedule?.classId) {
        batch = await this.prisma.batch.findFirst({
          where: { classId: schedule.classId, isActive: true },
          include: { class: true },
        });
      }
    }

    if (!batch) {
      throw new NotFoundException(`No active batch found for class session`);
    }

    if (isTeacher && dto.scheduleId) {
      const schedule = await this.prisma.classSchedule.findUnique({
        where: { id: dto.scheduleId },
      });
      if (schedule && schedule.staffId !== actorId) {
        throw new BadRequestException(
          'You are not authorized to start attendance for another teacher’s scheduled class',
        );
      }
    }

    // Check if session already exists for this schedule and date
    let existingSession = null;
    if (dto.scheduleId) {
      existingSession = await this.prisma.attendanceSession.findFirst({
        where: {
          classScheduleId: dto.scheduleId,
          date: dateObj,
        },
        include: {
          batch: { include: { class: true } },
          records: true,
        },
      });
    }

    // Fallback: check by batch, date, and startTime
    if (!existingSession) {
      existingSession = await this.prisma.attendanceSession.findFirst({
        where: {
          batchId: batch.id,
          date: dateObj,
          startTime: dto.startTime || null,
        },
        include: {
          batch: { include: { class: true } },
          records: true,
        },
      });
    }

    if (existingSession) {
      return existingSession;
    }

    // Create session
    const session = await this.prisma.attendanceSession.create({
      data: {
        batchId: batch.id,
        classId: dto.classId || batch.classId,
        subjectId: dto.subjectId || null,
        classScheduleId: dto.scheduleId || null,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        date: dateObj,
        sessionType: dto.sessionType || SessionType.MORNING,
        status: SessionStatus.OPEN,
        createdById: actorId,
      },
      include: {
        batch: { include: { class: true } },
        class: true,
        subject: true,
        records: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ATTENDANCE_SESSION_STARTED',
        entityType: 'AttendanceSession',
        entityId: session.id,
        details: {
          batchId: batch.id,
          scheduleId: dto.scheduleId,
          date: dateStr,
          startTime: dto.startTime,
        },
      },
    });

    return session;
  }

  // ==========================================
  // STUDENT ATTENDANCE SESSION MANAGEMENT
  // ==========================================

  async getSessions(query: { batchId?: string; date?: string; status?: SessionStatus }) {
    const where: any = {};
    if (query.batchId) where.batchId = query.batchId;
    if (query.status) where.status = query.status;
    if (query.date) where.date = new Date(query.date);

    return this.prisma.attendanceSession.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        batch: {
          include: {
            class: true,
          },
        },
        class: true,
        subject: true,
        classSchedule: {
          include: { staff: { select: { firstName: true, lastName: true } } },
        },
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
        _count: {
          select: { records: true },
        },
      },
    });
  }

  async getSessionById(sessionId: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        batch: {
          include: {
            class: true,
            enrollments: {
              where: { isActive: true },
              include: {
                student: true,
              },
            },
          },
        },
        class: true,
        subject: true,
        classSchedule: {
          include: { staff: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        records: {
          include: {
            student: true,
            recordedBy: {
              select: { firstName: true, lastName: true },
            },
            corrections: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        createdBy: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Attendance session with ID ${sessionId} not found`);
    }

    const recordedStudentIds = new Set(session.records.map((r) => r.studentId));

    // Deduplicate and collect all active enrolled students for this session
    const studentMap = new Map<string, any>();
    const targetClassId = session.classId || session.batch?.classId;
    const isScheduleAllBatches = !session.classSchedule?.batchId;

    // 1. If session has a specific batch (not All Batches)
    if (!isScheduleAllBatches && session.batch?.enrollments) {
      for (const e of session.batch.enrollments) {
        if (
          e.student &&
          e.student.status === StudentStatus.ACTIVE &&
          (!session.subjectId || e.subjectId === session.subjectId || e.subjectId === null)
        ) {
          studentMap.set(e.student.id, e.student);
        }
      }
    }

    // 2. If schedule is for "All Batches" or batch enrollments didn't yield students:
    if (studentMap.size === 0 && targetClassId) {
      const classEnrollments = await this.prisma.studentBatchEnrollment.findMany({
        where: {
          batch: { classId: targetClassId },
          isActive: true,
          student: { status: StudentStatus.ACTIVE },
        },
        include: { student: true },
      });

      // Filter by subject if specified
      let matched = classEnrollments;
      if (session.subjectId) {
        const bySubject = classEnrollments.filter(
          (ce) => ce.subjectId === session.subjectId || ce.subjectId === null,
        );
        if (bySubject.length > 0) {
          matched = bySubject;
        }
      }

      for (const ce of matched) {
        if (ce.student && ce.student.status === StudentStatus.ACTIVE) {
          studentMap.set(ce.student.id, ce.student);
        }
      }
    }

    const allEnrolled = Array.from(studentMap.values());
    const unmarkedStudents = allEnrolled.filter(
      (s) => !recordedStudentIds.has(s.id),
    );

    const presentCount = session.records.filter(
      (r) => r.status === AttendanceStatus.PRESENT,
    ).length;
    const absentCount = session.records.filter(
      (r) => r.status === AttendanceStatus.ABSENT,
    ).length;
    const lateCount = session.records.filter(
      (r) => r.status === AttendanceStatus.LATE,
    ).length;
    const excusedCount = session.records.filter(
      (r) => r.status === AttendanceStatus.EXCUSED,
    ).length;

    const totalEnrolled = allEnrolled.length;
    const attendanceRate =
      totalEnrolled > 0
        ? Math.round(((presentCount + lateCount) / totalEnrolled) * 100)
        : 0;

    return {
      session: {
        id: session.id,
        batchId: session.batchId,
        batchName: session.batch.name,
        classId: session.classId || session.batch.classId,
        className: session.class?.name || session.batch.class.name,
        subjectId: session.subjectId || null,
        subjectName: session.subject?.name || null,
        classScheduleId: session.classScheduleId || null,
        startTime: session.startTime || session.classSchedule?.startTime || null,
        endTime: session.endTime || session.classSchedule?.endTime || null,
        teacherName: session.classSchedule?.staff
          ? `${session.classSchedule.staff.firstName} ${session.classSchedule.staff.lastName}`
          : null,
        date: session.date.toISOString().split('T')[0],
        sessionType: session.sessionType,
        status: session.status,
        createdAt: session.createdAt,
        createdBy: session.createdBy,
      },
      summary: {
        totalEnrolled,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        unmarkedCount: unmarkedStudents.length,
        attendanceRate,
      },
      records: session.records.map((r) => ({
        id: r.id,
        studentId: r.student.id,
        studentCode: r.student.studentCode,
        attendanceCode: r.student.attendanceCode,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        status: r.status,
        recordedAt: r.recordedAt,
        recordedBy: r.recordedBy ? `${r.recordedBy.firstName} ${r.recordedBy.lastName}` : 'System',
        corrections: r.corrections,
      })),
      unmarkedStudents: unmarkedStudents.map((s) => ({
        id: s.id,
        studentCode: s.studentCode,
        attendanceCode: s.attendanceCode,
        studentName: `${s.firstName} ${s.lastName}`,
        gender: s.gender,
      })),
    };
  }

  async createSession(dto: CreateSessionDto, actorId: string) {
    const sessionDate = new Date(dto.date);

    // Verify batch exists
    const batch = await this.prisma.batch.findUnique({
      where: { id: dto.batchId },
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${dto.batchId} not found`);
    }

    let existing = null;
    if (dto.classScheduleId) {
      existing = await this.prisma.attendanceSession.findFirst({
        where: {
          classScheduleId: dto.classScheduleId,
          date: sessionDate,
        },
        include: { batch: { include: { class: true } } },
      });
    } else {
      existing = await this.prisma.attendanceSession.findFirst({
        where: {
          batchId: dto.batchId,
          date: sessionDate,
          sessionType: dto.sessionType,
        },
        include: { batch: { include: { class: true } } },
      });
    }

    if (existing) {
      return existing;
    }

    return this.prisma.attendanceSession.create({
      data: {
        batchId: dto.batchId,
        classId: dto.classId || batch.classId,
        subjectId: dto.subjectId || null,
        classScheduleId: dto.classScheduleId || null,
        startTime: dto.startTime || null,
        endTime: dto.endTime || null,
        date: sessionDate,
        sessionType: dto.sessionType,
        status: SessionStatus.OPEN,
        createdById: actorId,
      },
      include: {
        batch: {
          include: {
            class: true,
          },
        },
      },
    });
  }

  async closeSession(sessionId: string, dto: CloseSessionDto, actorId: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        batch: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: { student: true },
            },
          },
        },
        records: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. If markUnmarkedAsAbsent is requested, auto-populate ABSENT records
      if (dto.markUnmarkedAsAbsent) {
        const recordedStudentIds = new Set(session.records.map((r) => r.studentId));
        const eligibleEnrollments = session.batch.enrollments.filter(
          (e) => !session.subjectId || e.subjectId === session.subjectId || e.subjectId === null,
        );
        const unmarked = eligibleEnrollments
          .map((e) => e.student)
          .filter((s) => !recordedStudentIds.has(s.id) && s.status === StudentStatus.ACTIVE);

        for (const s of unmarked) {
          await tx.attendanceRecord.create({
            data: {
              sessionId: session.id,
              studentId: s.id,
              status: AttendanceStatus.ABSENT,
              recordedById: actorId,
            },
          });
        }
      }

      // 2. Close session status
      const updated = await tx.attendanceSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.CLOSED,
        },
      });

      // 3. Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ATTENDANCE_SESSION_CLOSED',
          entityType: 'AttendanceSession',
          entityId: session.id,
          details: { batchId: session.batchId, markUnmarkedAsAbsent: !!dto.markUnmarkedAsAbsent },
        },
      });

      return updated;
    });
  }

  // ==========================================
  // QUICK MARK & MANUAL MARK
  // ==========================================

  async quickMark(dto: QuickMarkDto, actorId: string) {
    const inputCode = dto.studentCode.trim();
    const upperCode = inputCode.toUpperCase();

    // 1. Check if the code is allocated to a staff member
    const codeRecord = await this.prisma.attendanceCode.findUnique({
      where: { code: inputCode },
      include: { user: true, student: true },
    });

    if (codeRecord && codeRecord.entityType === AttendanceCodeEntityType.STAFF && codeRecord.user) {
      throw new BadRequestException(
        `Code '${inputCode}' is assigned to staff member '${codeRecord.user.firstName} ${codeRecord.user.lastName}'. Please record attendance via the Staff Terminal.`,
      );
    }

    // 2. Locate student by 3-digit attendance code, studentCode, admissionNumber, or student id
    const student = await this.prisma.student.findFirst({
      where: {
        OR: [
          { id: inputCode },
          { attendanceCode: inputCode },
          { studentCode: upperCode },
          { admissionNumber: upperCode },
        ],
      },
      include: {
        batchEnrollments: {
          where: { isActive: true },
          include: { batch: { include: { class: true } } },
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with code or attendance code '${inputCode}' not found`);
    }

    if (student.status !== StudentStatus.ACTIVE) {
      throw new BadRequestException(
        `Student '${student.firstName} ${student.lastName}' (${student.studentCode}) is currently ${student.status}`,
      );
    }

    if (student.batchEnrollments.length === 0) {
      throw new BadRequestException(
        `Student '${student.firstName} ${student.lastName}' (${student.studentCode}) is not currently enrolled in any active batch`,
      );
    }

    // Determine target batch
    let targetBatchId = dto.batchId;
    let targetSessionId = dto.sessionId;
    const enrolledBatchIds = student.batchEnrollments.map((e) => e.batchId);

    if (targetSessionId) {
      const specifiedSession = await this.prisma.attendanceSession.findUnique({
        where: { id: targetSessionId },
      });

      if (!specifiedSession) {
        throw new NotFoundException(`Attendance session ${targetSessionId} not found`);
      }

      if (specifiedSession.status === SessionStatus.CLOSED) {
        await this.prisma.attendanceSession.update({
          where: { id: specifiedSession.id },
          data: { status: SessionStatus.OPEN },
        });
        specifiedSession.status = SessionStatus.OPEN;
      }

      targetBatchId = specifiedSession.batchId;

      const matchingEnrollment = student.batchEnrollments.find(
        (e) =>
          e.batchId === specifiedSession.batchId &&
          (!specifiedSession.subjectId || e.subjectId === specifiedSession.subjectId || e.subjectId === null),
      );

      if (!matchingEnrollment) {
        throw new BadRequestException(
          `Student '${student.firstName} ${student.lastName}' is not enrolled in this session's course/subject`,
        );
      }
    } else {
      if (!targetBatchId) {
        targetBatchId = enrolledBatchIds[0];
      } else if (!enrolledBatchIds.includes(targetBatchId)) {
        throw new BadRequestException(
          `Student '${student.firstName} ${student.lastName}' is not enrolled in batch ${targetBatchId}`,
        );
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionType = dto.sessionType || SessionType.MORNING;

    // 3. Resolve or create session
    let session = targetSessionId
      ? await this.prisma.attendanceSession.findUnique({ where: { id: targetSessionId } })
      : await this.prisma.attendanceSession.findFirst({
          where: {
            batchId: targetBatchId,
            date: today,
            sessionType,
          },
        });

    if (!session) {
      const matchedEnrollment = student.batchEnrollments.find((e) => e.batchId === targetBatchId);
      session = await this.prisma.attendanceSession.create({
        data: {
          batchId: targetBatchId,
          classId: matchedEnrollment?.batch?.classId || null,
          date: today,
          sessionType,
          status: SessionStatus.OPEN,
          createdById: actorId,
        },
      });
    }

    if (session.status === SessionStatus.CLOSED) {
      await this.prisma.attendanceSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.OPEN },
      });
      session.status = SessionStatus.OPEN;
    }

    // 4. Atomically check for duplicate record
    const existingRecord = await this.prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: student.id,
        },
      },
    });

    if (existingRecord) {
      return {
        alreadyMarked: true,
        message: `Student '${student.firstName} ${student.lastName}' (Code: ${student.attendanceCode || student.studentCode}) was already marked ${existingRecord.status} at ${existingRecord.recordedAt.toISOString()}`,
        record: existingRecord,
        student: {
          id: student.id,
          studentCode: student.studentCode,
          attendanceCode: student.attendanceCode,
          name: `${student.firstName} ${student.lastName}`,
        },
      };
    }

    // 5. Create new AttendanceRecord
    const newStatus = dto.status || AttendanceStatus.PRESENT;
    const record = await this.prisma.attendanceRecord.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        status: newStatus,
        recordedById: actorId,
      },
    });

    return {
      alreadyMarked: false,
      message: `Marked '${student.firstName} ${student.lastName}' (Code: ${student.attendanceCode || student.studentCode}) as ${record.status}`,
      record,
      student: {
        id: student.id,
        studentCode: student.studentCode,
        attendanceCode: student.attendanceCode,
        name: `${student.firstName} ${student.lastName}`,
      },
    };
  }

  async markStudent(dto: MarkStudentDto, actorId: string, isTeacher: boolean) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: dto.sessionId },
      include: {
        batch: {
          include: {
            enrollments: {
              where: { isActive: true },
            },
          },
        },
        classSchedule: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Attendance session ${dto.sessionId} not found`);
    }

    if (session.status === SessionStatus.CLOSED) {
      await this.prisma.attendanceSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.OPEN },
      });
      session.status = SessionStatus.OPEN;
    }

    if (isTeacher && session.classSchedule && session.classSchedule.staffId !== actorId) {
      throw new BadRequestException('You are not authorized to mark attendance for another teacher’s session');
    }

    // Verify enrollment
    let isEnrolled = session.batch?.enrollments?.some((e) => e.studentId === dto.studentId);
    if (!isEnrolled && session.classId) {
      const classEnrollment = await this.prisma.studentBatchEnrollment.findFirst({
        where: {
          studentId: dto.studentId,
          batch: { classId: session.classId },
          isActive: true,
        },
      });
      if (classEnrollment) isEnrolled = true;
    }
    if (!isEnrolled) {
      const studentExists = await this.prisma.student.findUnique({
        where: { id: dto.studentId },
      });
      if (studentExists) isEnrolled = true;
    }

    const existingRecord = await this.prisma.attendanceRecord.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: session.id,
          studentId: dto.studentId,
        },
      },
    });

    let record;
    if (existingRecord) {
      record = await this.prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          status: dto.status,
          recordedById: actorId,
        },
        include: { student: true },
      });
    } else {
      record = await this.prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: dto.studentId,
          status: dto.status,
          recordedById: actorId,
        },
        include: { student: true },
      });
    }

    return record;
  }

  async bulkMark(dto: BulkMarkStudentsDto, actorId: string) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: dto.sessionId },
      include: {
        batch: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: { student: true },
            },
          },
        },
        records: true,
      },
    });

    if (!session) {
      throw new NotFoundException(`Attendance session ${dto.sessionId} not found`);
    }

    if (session.status === SessionStatus.CLOSED) {
      await this.prisma.attendanceSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.OPEN },
      });
    }

    let targetStudentIds = dto.studentIds;
    if (!targetStudentIds || targetStudentIds.length === 0) {
      const recordedIds = new Set(session.records.map((r) => r.studentId));
      let availableStudents: any[] = [];
      if (session.batch?.enrollments) {
        availableStudents = session.batch.enrollments
          .filter((e) => !recordedIds.has(e.studentId) && e.student?.status === StudentStatus.ACTIVE)
          .map((e) => e.studentId);
      }
      if (availableStudents.length === 0 && session.classId) {
        const classEnrollments = await this.prisma.studentBatchEnrollment.findMany({
          where: {
            batch: { classId: session.classId },
            isActive: true,
            student: { status: StudentStatus.ACTIVE },
          },
          include: { student: true },
        });
        availableStudents = classEnrollments
          .filter((ce) => !recordedIds.has(ce.studentId))
          .map((ce) => ce.studentId);
      }
      targetStudentIds = Array.from(new Set(availableStudents));
    }

    const createdOrUpdated: any[] = [];
    for (const studentId of targetStudentIds) {
      const existing = await this.prisma.attendanceRecord.findUnique({
        where: {
          sessionId_studentId: {
            sessionId: session.id,
            studentId,
          },
        },
      });

      if (existing) {
        const updated = await this.prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            status: dto.status,
            recordedById: actorId,
          },
        });
        createdOrUpdated.push(updated);
      } else {
        const created = await this.prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId,
            status: dto.status,
            recordedById: actorId,
          },
        });
        createdOrUpdated.push(created);
      }
    }

    return { count: createdOrUpdated.length, records: createdOrUpdated };
  }

  // ==========================================
  // ATTENDANCE HISTORY & FILTERING
  // ==========================================

  async getAttendanceHistory(query: AttendanceHistoryQueryDto, actorId: string, isTeacher: boolean) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.startDate || query.endDate) {
      where.session = where.session || {};
      where.session.date = {};
      if (query.startDate) {
        where.session.date.gte = new Date(`${query.startDate}T00:00:00Z`);
      }
      if (query.endDate) {
        where.session.date.lte = new Date(`${query.endDate}T23:59:59Z`);
      }
    }

    if (query.classId) {
      where.session = where.session || {};
      where.session.batch = { classId: query.classId };
    }

    if (query.batchId) {
      where.session = where.session || {};
      where.session.batchId = query.batchId;
    }

    if (query.subjectId) {
      where.session = where.session || {};
      where.session.subjectId = query.subjectId;
    }

    if (query.sessionStatus) {
      where.session = where.session || {};
      where.session.status = query.sessionStatus;
    }

    if (query.teacherId) {
      where.session = where.session || {};
      where.session.OR = [
        { createdById: query.teacherId },
        { classSchedule: { staffId: query.teacherId } },
      ];
    }

    if (query.attendanceStatus) {
      where.status = query.attendanceStatus;
    }

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.studentQuery) {
      const q = query.studentQuery.trim();
      where.student = {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { studentCode: { contains: q, mode: 'insensitive' } },
          { admissionNumber: { contains: q, mode: 'insensitive' } },
          { attendanceCode: { contains: q } },
        ],
      };
    }

    if (isTeacher) {
      where.session = where.session || {};
      where.session.OR = [
        { createdById: actorId },
        { classSchedule: { staffId: actorId } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.attendanceRecord.count({ where }),
      this.prisma.attendanceRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ recordedAt: 'desc' }],
        include: {
          student: true,
          recordedBy: { select: { firstName: true, lastName: true, email: true } },
          corrections: {
            orderBy: { createdAt: 'desc' },
          },
          session: {
            include: {
              batch: { include: { class: true } },
              subject: true,
              class: true,
              classSchedule: {
                include: {
                  staff: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const statusCounts = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const countsMap = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const sc of statusCounts) {
      countsMap[sc.status] = sc._count;
    }

    const presentCount = countsMap.PRESENT;
    const absentCount = countsMap.ABSENT;
    const lateCount = countsMap.LATE;
    const excusedCount = countsMap.EXCUSED;
    const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

    return {
      records: records.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        sessionDate: r.session.date.toISOString().split('T')[0],
        sessionType: r.session.sessionType,
        sessionStatus: r.session.status,
        startTime: r.session.startTime || (r.session.classSchedule?.startTime ?? null),
        endTime: r.session.endTime || (r.session.classSchedule?.endTime ?? null),
        className: r.session.class?.name || r.session.batch.class.name,
        classCode: r.session.class?.code || r.session.batch.class.code,
        subjectName: r.session.subject?.name || 'General',
        batchName: r.session.batch.name,
        teacherName: r.session.classSchedule?.staff
          ? `${r.session.classSchedule.staff.firstName} ${r.session.classSchedule.staff.lastName}`
          : null,
        studentId: r.student.id,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        studentCode: r.student.studentCode,
        attendanceCode: r.student.attendanceCode,
        status: r.status,
        recordedAt: r.recordedAt,
        recordedBy: r.recordedBy ? `${r.recordedBy.firstName} ${r.recordedBy.lastName}` : 'System',
        corrections: r.corrections,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalRecords: total,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate,
      },
    };
  }

  // ==========================================
  // STAFF ATTENDANCE
  // ==========================================

  async staffQuickMark(dto: StaffQuickMarkDto, actorId?: string) {
    const input = dto.code.trim();

    // Check if code belongs to a student
    const codeRecord = await this.prisma.attendanceCode.findUnique({
      where: { code: input },
      include: { student: true, user: true },
    });

    if (codeRecord && codeRecord.entityType === AttendanceCodeEntityType.STUDENT && codeRecord.student) {
      throw new BadRequestException(
        `Code '${input}' belongs to student '${codeRecord.student.firstName} ${codeRecord.student.lastName}'. Please use the Student Attendance screen.`,
      );
    }

    // Locate staff user by attendanceCode, email, or id
    const staff = await this.prisma.user.findFirst({
      where: {
        OR: [
          { attendanceCode: input },
          { email: input.toLowerCase() },
          { id: input },
        ],
      },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member not found with code or identifier '${input}'`);
    }

    const { dateStr, dateObj } = await this.getAcademyTodayDateString();
    const autoCheckOutTime = new Date(`${dateStr}T21:30:00+05:30`);

    // Look for today's record
    const existing = await this.prisma.staffAttendanceRecord.findUnique({
      where: {
        userId_date: {
          userId: staff.id,
          date: dateObj,
        },
      },
    });

    const now = new Date();

    if (!existing) {
      // Check-In: Staff only check in at terminal; checkout is automated to 9:30 PM
      const newRecord = await this.prisma.staffAttendanceRecord.create({
        data: {
          userId: staff.id,
          date: dateObj,
          checkInAt: now,
          checkOutAt: autoCheckOutTime,
          status: 'PRESENT',
          notes: 'Auto Check-Out scheduled for 09:30 PM',
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'STAFF_CHECK_IN',
          entityType: 'StaffAttendanceRecord',
          entityId: newRecord.id,
          details: { userId: staff.id, checkInAt: now, autoCheckOutAt: autoCheckOutTime },
        },
      });

      return {
        type: 'CHECK_IN',
        message: `Welcome, ${staff.firstName} ${staff.lastName}! Check-In recorded at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Check-Out is automatic at 09:30 PM.`,
        staff: {
          id: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          attendanceCode: staff.attendanceCode,
          designation: staff.designation,
          email: staff.email,
        },
        record: newRecord,
      };
    } else {
      // Already checked in today
      return {
        type: 'ALREADY_CHECKED_IN',
        message: `${staff.firstName} ${staff.lastName} is already checked in for today at ${existing.checkInAt ? new Date(existing.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier'}. Check-Out is automatic at 09:30 PM.`,
        staff: {
          id: staff.id,
          name: `${staff.firstName} ${staff.lastName}`,
          attendanceCode: staff.attendanceCode,
          designation: staff.designation,
          email: staff.email,
        },
        record: existing,
      };
    }
  }

  async getStaffAttendanceRecords(query: { date?: string; userId?: string }) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.date) {
      where.date = new Date(`${query.date}T00:00:00Z`);
    } else {
      const { dateObj } = await this.getAcademyTodayDateString();
      where.date = dateObj;
    }

    const records = await this.prisma.staffAttendanceRecord.findMany({
      where,
      orderBy: { checkInAt: 'desc' },
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
    });

    return records.map((r) => {
      const dateStr = r.date.toISOString().split('T')[0];
      const autoCheckOutTime = new Date(`${dateStr}T21:30:00+05:30`);
      const effectiveCheckOut = r.checkOutAt || autoCheckOutTime;

      let durationHours = null;
      if (r.checkInAt && effectiveCheckOut) {
        durationHours = Number(
          ((effectiveCheckOut.getTime() - r.checkInAt.getTime()) / (1000 * 60 * 60)).toFixed(2),
        );
      }

      return {
        id: r.id,
        date: dateStr,
        checkInAt: r.checkInAt,
        checkOutAt: effectiveCheckOut,
        isAutoCheckOut: true,
        status: r.status,
        durationHours,
        notes: r.notes || 'Auto Check-Out on 09:30 PM',
        user: {
          id: r.user.id,
          name: `${r.user.firstName} ${r.user.lastName}`,
          designation: r.user.designation,
          attendanceCode: r.user.attendanceCode,
          email: r.user.email,
        },
      };
    });
  }

  async manualStaffRecord(dto: StaffAttendanceManualDto, actorId: string) {
    const targetDate = new Date(`${dto.date}T00:00:00Z`);
    const staff = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff user ${dto.userId} not found`);
    }

    const checkIn = dto.checkInAt ? new Date(dto.checkInAt) : new Date();
    const autoCheckOutTime = new Date(`${dto.date}T21:30:00+05:30`);
    const checkOut = dto.checkOutAt ? new Date(dto.checkOutAt) : autoCheckOutTime;

    const record = await this.prisma.staffAttendanceRecord.upsert({
      where: {
        userId_date: {
          userId: dto.userId,
          date: targetDate,
        },
      },
      update: {
        ...(dto.checkInAt && { checkInAt: checkIn }),
        ...(dto.checkOutAt !== undefined && { checkOutAt: checkOut }),
        ...(dto.status && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      create: {
        userId: dto.userId,
        date: targetDate,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        status: dto.status || 'PRESENT',
        notes: dto.notes || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'STAFF_ATTENDANCE_MANUAL_RECORD',
        entityType: 'StaffAttendanceRecord',
        entityId: record.id,
        details: { userId: dto.userId, date: dto.date, status: record.status },
      },
    });

    return record;
  }

  // ==========================================
  // CORRECTIONS & AUDIT LOGS
  // ==========================================

  async createCorrection(dto: CreateCorrectionDto, actorId: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: dto.recordId },
      include: { student: true, session: true },
    });

    if (!record) {
      throw new NotFoundException(`Attendance record ${dto.recordId} not found`);
    }

    const previousStatus = record.status;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update record
      const updatedRecord = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: { status: dto.newStatus },
      });

      // 2. Create correction log
      const correction = await tx.attendanceCorrection.create({
        data: {
          recordId: record.id,
          previousStatus,
          newStatus: dto.newStatus,
          reason: dto.reason.trim(),
          authorizedById: actorId,
        },
      });

      // 3. Record audit log
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ATTENDANCE_CORRECTION',
          entityType: 'AttendanceRecord',
          entityId: record.id,
          details: {
            studentCode: record.student.studentCode,
            previousStatus,
            newStatus: dto.newStatus,
            reason: dto.reason,
          },
        },
      });

      return {
        record: updatedRecord,
        correction,
        message: `Status corrected from ${previousStatus} to ${dto.newStatus}`,
      };
    });
  }

  // ==========================================
  // BATCH & STUDENT REPORTS
  // ==========================================

  async getBatchAttendanceReport(batchId: string, startDate?: string, endDate?: string) {
    const where: any = { batchId };
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const sessions = await this.prisma.attendanceSession.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        records: {
          include: { student: true },
        },
        batch: {
          include: {
            class: true,
            enrollments: { where: { isActive: true }, include: { student: true } },
          },
        },
      },
    });

    return sessions.map((s) => {
      const totalEnrolled = s.batch.enrollments.length;
      const presentCount = s.records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
      const lateCount = s.records.filter((r) => r.status === AttendanceStatus.LATE).length;
      const absentCount = s.records.filter((r) => r.status === AttendanceStatus.ABSENT).length;

      return {
        sessionId: s.id,
        date: s.date.toISOString().split('T')[0],
        sessionType: s.sessionType,
        status: s.status,
        totalEnrolled,
        presentCount,
        lateCount,
        absentCount,
        attendanceRate:
          totalEnrolled > 0 ? Math.round(((presentCount + lateCount) / totalEnrolled) * 100) : 0,
      };
    });
  }

  async getStudentAttendanceHistory(studentId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { studentId },
      orderBy: { recordedAt: 'desc' },
      include: {
        session: {
          include: {
            batch: {
              include: { class: true },
            },
          },
        },
        corrections: true,
      },
    });

    const totalRecorded = records.length;
    const presentCount = records.filter(
      (r) => r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE,
    ).length;

    return {
      summary: {
        totalSessionsAttended: totalRecorded,
        presentCount,
        attendanceRate: totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0,
      },
      history: records.map((r) => ({
        id: r.id,
        date: r.session.date.toISOString().split('T')[0],
        sessionType: r.session.sessionType,
        batchName: r.session.batch.name,
        className: r.session.batch.class.name,
        status: r.status,
        recordedAt: r.recordedAt,
        hasCorrection: r.corrections.length > 0,
      })),
    };
  }
}
