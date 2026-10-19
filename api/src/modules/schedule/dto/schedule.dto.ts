import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  Matches,
} from 'class-validator';
import { ScheduleDayOfWeek, ScheduleExceptionStatus } from '@prisma/client';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  classId!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @IsEnum(ScheduleDayOfWeek)
  dayOfWeek!: ScheduleDayOfWeek;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (e.g. 09:00)',
  })
  startTime!: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (e.g. 10:30)',
  })
  endTime!: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  effectiveStartDate?: string;

  @IsString()
  @IsOptional()
  effectiveEndDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateScheduleDto {
  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsEnum(ScheduleDayOfWeek)
  @IsOptional()
  dayOfWeek?: ScheduleDayOfWeek;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (e.g. 09:00)',
  })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (e.g. 10:30)',
  })
  endTime?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  effectiveStartDate?: string;

  @IsString()
  @IsOptional()
  effectiveEndDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateScheduleExceptionDto {
  @IsString()
  @IsNotEmpty()
  date!: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  scheduleId?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsEnum(ScheduleExceptionStatus)
  @IsOptional()
  status?: ScheduleExceptionStatus;

  @IsString()
  @IsOptional()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateScheduleConfigDto {
  @IsString()
  @IsOptional()
  academyName?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  headerTemplate?: string;

  @IsString()
  @IsOptional()
  classItemTemplate?: string;

  @IsString()
  @IsOptional()
  footerTemplate?: string;

  @IsBoolean()
  @IsOptional()
  groupByBatch?: boolean;
}

export class GenerateScheduleQueryDto {
  @IsString()
  @IsOptional()
  date?: string; // YYYY-MM-DD

  @IsBoolean()
  @IsOptional()
  groupByBatch?: boolean;
}
