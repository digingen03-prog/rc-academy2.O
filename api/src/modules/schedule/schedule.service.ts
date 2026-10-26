import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ScheduleDayOfWeek,
  ScheduleExceptionStatus,
} from '@prisma/client';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateScheduleExceptionDto,
  UpdateScheduleConfigDto,
} from './dto/schedule.dto';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // CONFIGURATION
  // ==========================================

  async getScheduleConfig() {
    let config = await this.prisma.academyScheduleConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!config) {
      config = await this.prisma.academyScheduleConfig.create({
        data: {
          academyName: 'RC Academy',
          timezone: 'Asia/Kolkata',
          headerTemplate: "*{academy_name} – Tomorrow's Class Schedule*\n📅 {date}",
          classItemTemplate:
            '🕘 {start_time} – {end_time}\n📚 Class: {class_name}\n📘 Subject: {subject_name}\n👨‍🏫 Teacher: {teacher_name}\n👥 Batch: {batch_name}\n📍 Room: {room}',
          footerTemplate:
            '🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework. Have a great learning session!',
          groupByBatch: false,
        },
      });
    }

    return config;
  }

  async updateScheduleConfig(dto: UpdateScheduleConfigDto, actorId?: string) {
    const existing = await this.getScheduleConfig();

    const updated = await this.prisma.academyScheduleConfig.update({
      where: { id: existing.id },
      data: {
        ...(dto.academyName !== undefined && { academyName: dto.academyName.trim() }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone.trim() }),
        ...(dto.headerTemplate !== undefined && { headerTemplate: dto.headerTemplate }),
        ...(dto.classItemTemplate !== undefined && { classItemTemplate: dto.classItemTemplate }),
        ...(dto.footerTemplate !== undefined && { footerTemplate: dto.footerTemplate }),
        ...(dto.groupByBatch !== undefined && { groupByBatch: dto.groupByBatch }),
        updatedById: actorId,
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'SCHEDULE_CONFIG_UPDATED',
          entityType: 'AcademyScheduleConfig',
          entityId: updated.id,
          details: { ...dto } as any,
        },
      });
    }

    return updated;
  }

  // ==========================================
  // RECURRING SCHEDULE MANAGEMENT
  // ==========================================

  async createSchedule(dto: CreateScheduleDto, actorId?: string) {
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    // 1. Verify Class
    const classRecord = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });
    if (!classRecord) {
      throw new NotFoundException(`Class ${dto.classId} not found`);
    }

    // 2. Verify Subject
    const subjectRecord = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subjectRecord || subjectRecord.classId !== dto.classId) {
      throw new BadRequestException(`Subject ${dto.subjectId} does not belong to class ${dto.classId}`);
    }

    // 3. Verify Batch if specified
    if (dto.batchId) {
      const batchRecord = await this.prisma.batch.findUnique({
        where: { id: dto.batchId },
      });
      if (!batchRecord || batchRecord.classId !== dto.classId) {
        throw new BadRequestException(`Batch ${dto.batchId} does not belong to class ${dto.classId}`);
      }
    }

    // 4. Verify Staff
    const staffRecord = await this.prisma.user.findUnique({
      where: { id: dto.staffId },
    });
    if (!staffRecord) {
      throw new NotFoundException(`Staff ${dto.staffId} not found`);
    }

    // 5. Conflict Detection
    await this.checkRecurringConflicts({
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      staffId: dto.staffId,
      batchId: dto.batchId,
      room: dto.room,
    });

    const schedule = await this.prisma.classSchedule.create({
      data: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        batchId: dto.batchId || null,
        staffId: dto.staffId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        room: dto.room?.trim() || null,
        effectiveStartDate: dto.effectiveStartDate ? new Date(dto.effectiveStartDate) : null,
        effectiveEndDate: dto.effectiveEndDate ? new Date(dto.effectiveEndDate) : null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        class: true,
        subject: true,
        batch: true,
        staff: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'SCHEDULE_ENTRY_CREATED',
          entityType: 'ClassSchedule',
          entityId: schedule.id,
          details: {
            day: schedule.dayOfWeek,
            time: `${schedule.startTime}-${schedule.endTime}`,
            class: classRecord.name,
            subject: subjectRecord.name,
          },
        },
      });
    }

    return schedule;
  }

  async getSchedules(query: {
    classId?: string;
    batchId?: string;
    subjectId?: string;
    staffId?: string;
    dayOfWeek?: ScheduleDayOfWeek;
    isActive?: boolean;
  }) {
    const where: any = {};
    if (query.classId) where.classId = query.classId;
    if (query.batchId) where.batchId = query.batchId;
    if (query.subjectId) where.subjectId = query.subjectId;
    if (query.staffId) where.staffId = query.staffId;
    if (query.dayOfWeek) where.dayOfWeek = query.dayOfWeek;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.prisma.classSchedule.findMany({
      where,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      include: {
        class: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, code: true } },
        staff: { select: { id: true, firstName: true, lastName: true, email: true, designation: true } },
      },
    });
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto, actorId?: string) {
    const existing = await this.prisma.classSchedule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    const startTime = dto.startTime || existing.startTime;
    const endTime = dto.endTime || existing.endTime;
    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    const dayOfWeek = dto.dayOfWeek || existing.dayOfWeek;
    const staffId = dto.staffId || existing.staffId;
    const batchId = dto.batchId !== undefined ? dto.batchId : existing.batchId;
    const room = dto.room !== undefined ? dto.room : existing.room;

    // Check conflict excluding current record
    await this.checkRecurringConflicts({
      dayOfWeek,
      startTime,
      endTime,
      staffId,
      batchId,
      room,
      excludeId: id,
    });

    const updated = await this.prisma.classSchedule.update({
      where: { id },
      data: {
        ...(dto.classId && { classId: dto.classId }),
        ...(dto.subjectId && { subjectId: dto.subjectId }),
        ...(dto.batchId !== undefined && { batchId: dto.batchId || null }),
        ...(dto.staffId && { staffId: dto.staffId }),
        ...(dto.dayOfWeek && { dayOfWeek: dto.dayOfWeek }),
        ...(dto.startTime && { startTime: dto.startTime }),
        ...(dto.endTime && { endTime: dto.endTime }),
        ...(dto.room !== undefined && { room: dto.room?.trim() || null }),
        ...(dto.effectiveStartDate !== undefined && {
          effectiveStartDate: dto.effectiveStartDate ? new Date(dto.effectiveStartDate) : null,
        }),
        ...(dto.effectiveEndDate !== undefined && {
          effectiveEndDate: dto.effectiveEndDate ? new Date(dto.effectiveEndDate) : null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        class: true,
        subject: true,
        batch: true,
        staff: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'SCHEDULE_ENTRY_UPDATED',
          entityType: 'ClassSchedule',
          entityId: id,
          details: { ...dto } as any,
        },
      });
    }

    return updated;
  }

  async deleteSchedule(id: string, actorId?: string) {
    const existing = await this.prisma.classSchedule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    const deleted = await this.prisma.classSchedule.delete({
      where: { id },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'SCHEDULE_ENTRY_DELETED',
          entityType: 'ClassSchedule',
          entityId: id,
        },
      });
    }

    return deleted;
  }

  // ==========================================
  // DAILY EXCEPTIONS MANAGEMENT
  // ==========================================

  async createException(dto: CreateScheduleExceptionDto, actorId?: string) {
    let classId = dto.classId;
    let subjectId = dto.subjectId;
    let batchId = dto.batchId;
    let staffId = dto.staffId;
    let startTime = dto.startTime;
    let endTime = dto.endTime;
    let room = dto.room;

    if (dto.scheduleId) {
      const schedule = await this.prisma.classSchedule.findUnique({
        where: { id: dto.scheduleId },
      });
      if (!schedule) {
        throw new NotFoundException(`Schedule ${dto.scheduleId} not found`);
      }
      classId = classId || schedule.classId;
      subjectId = subjectId || schedule.subjectId;
      batchId = batchId !== undefined ? batchId : (schedule.batchId || undefined);
      staffId = staffId || schedule.staffId;
      startTime = startTime || schedule.startTime;
      endTime = endTime || schedule.endTime;
      room = room !== undefined ? room : (schedule.room || undefined);
    }

    if (!classId || !subjectId || !staffId || !startTime || !endTime) {
      throw new BadRequestException(
        'Missing required class, subject, staff, or time range information for exception',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException('startTime must be earlier than endTime');
    }

    const exceptionDate = new Date(`${dto.date}T00:00:00Z`);

    const exception = await this.prisma.dailyScheduleException.create({
      data: {
        date: exceptionDate,
        scheduleId: dto.scheduleId || null,
        classId,
        subjectId,
        batchId: batchId || null,
        staffId,
        startTime,
        endTime,
        room: room?.trim() || null,
        status: dto.status || ScheduleExceptionStatus.ACTIVE,
        cancellationReason: dto.cancellationReason || null,
        notes: dto.notes || null,
      },
      include: {
        class: true,
        subject: true,
        batch: true,
        staff: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DAILY_SCHEDULE_EXCEPTION_CREATED',
          entityType: 'DailyScheduleException',
          entityId: exception.id,
          details: {
            date: dto.date,
            status: dto.status,
            reason: dto.cancellationReason,
          },
        },
      });
    }

    return exception;
  }

  async getExceptions(date?: string) {
    const where: any = {};
    if (date) {
      where.date = new Date(`${date}T00:00:00Z`);
    }

    return this.prisma.dailyScheduleException.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        class: { select: { id: true, name: true, code: true } },
        subject: { select: { id: true, name: true, code: true } },
        batch: { select: { id: true, name: true, code: true } },
        staff: { select: { id: true, firstName: true, lastName: true, email: true } },
        schedule: true,
      },
    });
  }

  async deleteException(id: string, actorId?: string) {
    const existing = await this.prisma.dailyScheduleException.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Exception ${id} not found`);
    }

    const deleted = await this.prisma.dailyScheduleException.delete({
      where: { id },
    });

    if (actorId) {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DAILY_SCHEDULE_EXCEPTION_DELETED',
          entityType: 'DailyScheduleException',
          entityId: id,
        },
      });
    }

    return deleted;
  }

  // ==========================================
  // RESOLVED SCHEDULE & WHATSAPP GENERATION
  // ==========================================

  getTomorrowDateString(timezone: string = 'Asia/Kolkata') {
    const now = new Date();
    // Resolve date in target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find((p) => p.type === 'year')!.value;
    const month = parts.find((p) => p.type === 'month')!.value;
    const day = parts.find((p) => p.type === 'day')!.value;

    const todayDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
    const tomorrow = new Date(todayDate);
    tomorrow.setUTCDate(todayDate.getUTCDate() + 1);

    const tomYear = tomorrow.getUTCFullYear();
    const tomMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
    const tomDay = String(tomorrow.getUTCDate()).padStart(2, '0');
    const dateStr = `${tomYear}-${tomMonth}-${tomDay}`;

    const days = [
      ScheduleDayOfWeek.SUNDAY,
      ScheduleDayOfWeek.MONDAY,
      ScheduleDayOfWeek.TUESDAY,
      ScheduleDayOfWeek.WEDNESDAY,
      ScheduleDayOfWeek.THURSDAY,
      ScheduleDayOfWeek.FRIDAY,
      ScheduleDayOfWeek.SATURDAY,
    ];
    const dayOfWeek = days[tomorrow.getUTCDay()];

    return { date: dateStr, dateStr, dayOfWeek };
  }

  async getDailySchedule(targetDate?: string, requestedGroupByBatch?: boolean) {
    const config = await this.getScheduleConfig();
    const tz = config.timezone || 'Asia/Kolkata';

    let dateStr = targetDate;
    let dayOfWeek: ScheduleDayOfWeek;

    if (!dateStr) {
      const tom = this.getTomorrowDateString(tz);
      dateStr = tom.dateStr;
      dayOfWeek = tom.dayOfWeek;
    } else {
      const parsed = new Date(`${dateStr}T00:00:00Z`);
      const days = [
        ScheduleDayOfWeek.SUNDAY,
        ScheduleDayOfWeek.MONDAY,
        ScheduleDayOfWeek.TUESDAY,
        ScheduleDayOfWeek.WEDNESDAY,
        ScheduleDayOfWeek.THURSDAY,
        ScheduleDayOfWeek.FRIDAY,
        ScheduleDayOfWeek.SATURDAY,
      ];
      dayOfWeek = days[parsed.getUTCDay()];
    }

    const targetDateObj = new Date(`${dateStr}T00:00:00Z`);

    // 1. Fetch recurring schedules for that weekday
    const recurringSchedules = await this.prisma.classSchedule.findMany({
      where: {
        dayOfWeek,
        isActive: true,
        OR: [
          { effectiveStartDate: null },
          { effectiveStartDate: { lte: targetDateObj } },
        ],
        AND: [
          {
            OR: [
              { effectiveEndDate: null },
              { effectiveEndDate: { gte: targetDateObj } },
            ],
          },
        ],
      },
      include: {
        class: true,
        subject: true,
        batch: true,
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // 2. Fetch exceptions for this specific date
    const dailyExceptions = await this.prisma.dailyScheduleException.findMany({
      where: {
        date: targetDateObj,
      },
      include: {
        class: true,
        subject: true,
        batch: true,
        staff: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // 3. Merge recurring and exceptions
    const resolvedClasses: any[] = [];
    const cancelledClasses: any[] = [];
    const exceptionMap = new Map<string, any>();

    for (const ex of dailyExceptions) {
      if (ex.scheduleId) {
        exceptionMap.set(ex.scheduleId, ex);
      } else {
        // Special additional class
        resolvedClasses.push({
          id: `exc-${ex.id}`,
          classId: ex.classId,
          className: ex.class.name,
          classCode: ex.class.code,
          subjectId: ex.subjectId,
          subjectName: ex.subject.name,
          subjectCode: ex.subject.code,
          batchId: ex.batchId,
          batchName: ex.batch?.name || null,
          staffId: ex.staffId,
          teacherId: ex.staffId,
          teacherName: `${ex.staff.firstName} ${ex.staff.lastName}`,
          startTime: ex.startTime,
          endTime: ex.endTime,
          room: ex.room || null,
          isException: true,
          isSpecialClass: ex.status === ScheduleExceptionStatus.SPECIAL_CLASS,
          exceptionStatus: ex.status,
          notes: ex.notes,
        });
      }
    }

    for (const rec of recurringSchedules) {
      const ex = exceptionMap.get(rec.id);
      if (ex) {
        if (ex.status === ScheduleExceptionStatus.CANCELLED) {
          cancelledClasses.push({
            id: rec.id,
            className: rec.class.name,
            subjectName: rec.subject.name,
            batchName: rec.batch?.name || null,
            startTime: rec.startTime,
            endTime: rec.endTime,
            teacherName: `${rec.staff.firstName} ${rec.staff.lastName}`,
            reason: ex.cancellationReason || 'Class cancelled for this date',
          });
          continue; // Exclude cancelled class
        } else {
          // Substituted / Rescheduled / Modified
          resolvedClasses.push({
            id: rec.id,
            classId: ex.classId,
            className: ex.class.name,
            classCode: ex.class.code,
            subjectId: ex.subjectId,
            subjectName: ex.subject.name,
            subjectCode: ex.subject.code,
            batchId: ex.batchId,
            batchName: ex.batch?.name || null,
            staffId: ex.staffId,
            teacherId: ex.staffId,
            teacherName: `${ex.staff.firstName} ${ex.staff.lastName}`,
            startTime: ex.startTime,
            endTime: ex.endTime,
            room: ex.room || rec.room || null,
            isException: true,
            isSpecialClass: false,
            exceptionStatus: ex.status,
            notes: ex.notes,
          });
        }
      } else {
        resolvedClasses.push({
          id: rec.id,
          classId: rec.classId,
          className: rec.class.name,
          classCode: rec.class.code,
          subjectId: rec.subjectId,
          subjectName: rec.subject.name,
          subjectCode: rec.subject.code,
          batchId: rec.batchId,
          batchName: rec.batch?.name || null,
          staffId: rec.staffId,
          teacherId: rec.staffId,
          teacherName: `${rec.staff.firstName} ${rec.staff.lastName}`,
          startTime: rec.startTime,
          endTime: rec.endTime,
          room: rec.room || null,
          isException: false,
          isSpecialClass: false,
          exceptionStatus: 'RECURRING',
        });
      }
    }

    // 4. Sort chronologically by startTime
    resolvedClasses.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // 5. Detect conflicts among resolved classes
    const conflicts = this.detectScheduleConflicts(resolvedClasses);

    // 6. Generate WhatsApp Message
    const groupByBatch =
      requestedGroupByBatch !== undefined ? requestedGroupByBatch : config.groupByBatch;

    const formattedDate = new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });

    const whatsappMessage = this.formatWhatsAppMessage({
      config,
      dateString: formattedDate,
      classes: resolvedClasses,
      groupByBatch,
    });

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

    return {
      date: dateStr,
      dayOfWeek,
      formattedDate,
      academyName: config.academyName,
      classesCount: resolvedClasses.length,
      cancelledCount: cancelledClasses.length,
      conflictsCount: conflicts.length,
      conflicts,
      cancelledClasses,
      classes: resolvedClasses,
      schedule: resolvedClasses,
      whatsappMessage,
      whatsappUrl,
      config: {
        academyName: config.academyName,
        timezone: config.timezone,
        groupByBatch: config.groupByBatch,
      },
    };
  }

  // ==========================================
  // WHATSAPP FORMATTER
  // ==========================================

  private formatWhatsAppMessage(params: {
    config: any;
    dateString: string;
    classes: any[];
    groupByBatch: boolean;
  }): string {
    const { config, dateString, classes, groupByBatch } = params;

    if (classes.length === 0) {
      return `*${config.academyName} – Class Schedule*\n📅 ${dateString}\n\n🏖️ *No classes scheduled for tomorrow.* Enjoy your day!`;
    }

    const header = (config.headerTemplate || "*{academy_name} – Tomorrow's Class Schedule*\n📅 {date}")
      .replace('{academy_name}', config.academyName)
      .replace('{date}', dateString);

    const DEFAULT_CLASS_START_TIME = '09:00'; // 09:00 AM
    const DEFAULT_CLASS_END_TIME = '10:30';   // 10:30 AM

    const formatTime12h = (timeStr?: string | null, fallback = ''): string => {
      const effective = (timeStr && timeStr.trim()) ? timeStr.trim() : fallback;
      if (!effective) return '';
      const parts = effective.split(':');
      if (parts.length < 2) return effective;
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1].padStart(2, '0');
      if (isNaN(hours)) return effective;

      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;

      const hh = hours < 10 ? `0${hours}` : `${hours}`;
      return `${hh}:${minutes} ${ampm}`;
    };

    let body = '';

    if (!groupByBatch) {
      const classLines = classes.map((c) => {
        const startTime = formatTime12h(c.startTime, DEFAULT_CLASS_START_TIME);
        const endTime = formatTime12h(c.endTime, DEFAULT_CLASS_END_TIME);
        let text = `🕘 *${startTime} – ${endTime}*\n📚 Class: *${c.className}*`;
        if (c.subjectName) text += `\n📘 Subject: *${c.subjectName}*`;
        if (c.teacherName) text += `\n👨‍🏫 Teacher: ${c.teacherName}`;
        if (c.batchName) text += `\n👥 Batch: ${c.batchName}`;
        if (c.room) text += `\n📍 Room: ${c.room}`;
        if (c.isException && c.exceptionStatus === ScheduleExceptionStatus.SUBSTITUTED) {
          text += `\n⚠️ _(Teacher Substitution)_`;
        } else if (c.isException && c.exceptionStatus === ScheduleExceptionStatus.SPECIAL_CLASS) {
          text += `\n⭐ _(Special Additional Class)_`;
        }
        return text;
      });

      body = classLines.join('\n\n');
    } else {
      // Group classes by Batch or Class
      const groups = new Map<string, any[]>();
      for (const c of classes) {
        const key = c.batchName ? `${c.className} (${c.batchName})` : c.className;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(c);
      }

      const groupSections: string[] = [];
      for (const [groupName, groupClasses] of groups.entries()) {
        const items = groupClasses.map((c) => {
          const startTime = formatTime12h(c.startTime, DEFAULT_CLASS_START_TIME);
          const endTime = formatTime12h(c.endTime, DEFAULT_CLASS_END_TIME);
          let text = `  • *${startTime} – ${endTime}*: ${c.subjectName} (${c.teacherName})`;
          if (c.room) text += ` [${c.room}]`;
          return text;
        });
        groupSections.push(`🎓 *${groupName}*\n${items.join('\n')}`);
      }
      body = groupSections.join('\n\n');
    }

    const footer = config.footerTemplate
      ? `\n\n${config.footerTemplate}`
      : '\n\n🔔 *Reminder:* Please arrive 10 minutes before class with textbooks and completed homework.';

    return `${header}\n\n${body}${footer}`;
  }

  // ==========================================
  // CONFLICT DETECTION
  // ==========================================

  private async checkRecurringConflicts(params: {
    dayOfWeek: ScheduleDayOfWeek;
    startTime: string;
    endTime: string;
    staffId: string;
    batchId?: string | null;
    room?: string | null;
    excludeId?: string;
  }) {
    const existingSchedules = await this.prisma.classSchedule.findMany({
      where: {
        dayOfWeek: params.dayOfWeek,
        isActive: true,
        ...(params.excludeId && { id: { not: params.excludeId } }),
      },
      include: {
        class: true,
        subject: true,
        batch: true,
        staff: true,
      },
    });

    for (const item of existingSchedules) {
      const isOverlapping =
        params.startTime < item.endTime && item.startTime < params.endTime;

      if (isOverlapping) {
        if (item.staffId === params.staffId) {
          throw new ConflictException(
            `Teacher conflict: ${item.staff.firstName} ${item.staff.lastName} already has a scheduled class (${item.class.name} - ${item.subject.name}, ${item.startTime}-${item.endTime}) on ${params.dayOfWeek}`,
          );
        }

        if (params.batchId && item.batchId && item.batchId === params.batchId) {
          throw new ConflictException(
            `Batch conflict: Batch ${item.batch?.name || ''} already has a scheduled class (${item.class.name} - ${item.subject.name}, ${item.startTime}-${item.endTime}) on ${params.dayOfWeek}`,
          );
        }

        if (
          params.room &&
          item.room &&
          params.room.toLowerCase() === item.room.toLowerCase()
        ) {
          throw new ConflictException(
            `Room conflict: Room '${item.room}' is already booked for ${item.class.name} (${item.startTime}-${item.endTime}) on ${params.dayOfWeek}`,
          );
        }
      }
    }
  }

  private detectScheduleConflicts(classes: any[]) {
    const conflicts: any[] = [];

    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        const a = classes[i];
        const b = classes[j];

        const isOverlapping = a.startTime < b.endTime && b.startTime < a.endTime;
        if (isOverlapping) {
          if (a.staffId === b.staffId) {
            conflicts.push({
              type: 'TEACHER_OVERLAP',
              message: `Teacher ${a.teacherName} is double-booked for ${a.className} (${a.startTime}-${a.endTime}) and ${b.className} (${b.startTime}-${b.endTime})`,
              classA: a,
              classB: b,
            });
          }

          if (a.batchId && b.batchId && a.batchId === b.batchId) {
            conflicts.push({
              type: 'BATCH_OVERLAP',
              message: `Batch ${a.batchName} has overlapping classes: ${a.subjectName} and ${b.subjectName}`,
              classA: a,
              classB: b,
            });
          }

          if (
            a.room &&
            b.room &&
            a.room.toLowerCase() === b.room.toLowerCase()
          ) {
            conflicts.push({
              type: 'ROOM_OVERLAP',
              message: `Room '${a.room}' is double-booked between ${a.className} and ${b.className}`,
              classA: a,
              classB: b,
            });
          }
        }
      }
    }

    return conflicts;
  }
}
