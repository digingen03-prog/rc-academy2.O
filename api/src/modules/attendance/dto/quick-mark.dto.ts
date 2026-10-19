import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus, SessionType, SessionStatus } from '@prisma/client';

export class QuickMarkDto {
  @IsString()
  @IsNotEmpty({ message: 'Attendance code or student code is required' })
  studentCode!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}

export class StaffQuickMarkDto {
  @IsString()
  @IsNotEmpty({ message: 'Staff attendance code or identifier is required' })
  code!: string;
}

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'Batch ID is required' })
  batchId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Session date is required' })
  date!: string; // YYYY-MM-DD

  @IsEnum(SessionType)
  sessionType!: SessionType;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  classScheduleId?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;
}

export class StartClassSessionDto {
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  date?: string; // YYYY-MM-DD (defaults to today in academy timezone)

  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;
}

export class MarkStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'Session ID is required' })
  sessionId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Student ID is required' })
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}

export class BulkMarkStudentsDto {
  @IsString()
  @IsNotEmpty({ message: 'Session ID is required' })
  sessionId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  studentIds?: string[];
}

export class CreateCorrectionDto {
  @IsString()
  @IsNotEmpty({ message: 'Record ID is required' })
  recordId!: string;

  @IsEnum(AttendanceStatus)
  newStatus!: AttendanceStatus;

  @IsString()
  @IsNotEmpty({ message: 'Reason for attendance correction is required' })
  reason!: string;
}

export class CloseSessionDto {
  @IsOptional()
  @IsBoolean()
  markUnmarkedAsAbsent?: boolean;
}

export class AttendanceHistoryQueryDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  studentQuery?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  sessionStatus?: SessionStatus;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  attendanceStatus?: AttendanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export class StaffAttendanceManualDto {
  @IsString()
  @IsNotEmpty({ message: 'Staff user ID is required' })
  userId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Date is required' })
  date!: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  checkInAt?: string;

  @IsOptional()
  @IsString()
  checkOutAt?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
