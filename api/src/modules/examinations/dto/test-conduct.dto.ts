import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import {
  InvigilatorAssignmentStatus,
  WhatsAppShareStatus,
  ExaminationStatus,
} from '@prisma/client';

export class ScheduleExamDto {
  @IsString()
  @IsNotEmpty({ message: 'Examination date is required (YYYY-MM-DD)' })
  date!: string;

  @IsString()
  @IsNotEmpty({ message: 'Start time is required (e.g. 09:30)' })
  startTime!: string;

  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 minute' })
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  invigilatorInstructions?: string;

  @IsOptional()
  @IsString()
  invigilatorId?: string;
}

export class AssignInvigilatorDto {
  @IsString()
  @IsNotEmpty({ message: 'Invigilator staff ID is required' })
  invigilatorId!: string;

  @IsOptional()
  @IsEnum(InvigilatorAssignmentStatus)
  invigilatorStatus?: InvigilatorAssignmentStatus;

  @IsOptional()
  @IsString()
  invigilatorNotes?: string;

  @IsOptional()
  @IsString()
  invigilatorInstructions?: string;
}

export class AcknowledgeInvigilatorDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateConductStatusDto {
  @IsEnum(ExaminationStatus, { message: 'Invalid examination conduct status' })
  status!: ExaminationStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordAnnouncementShareDto {
  @IsEnum(WhatsAppShareStatus, { message: 'Invalid WhatsApp share status' })
  status!: WhatsAppShareStatus;

  @IsOptional()
  @IsString()
  messageSnapshot?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class TestConductQueryDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsEnum(ExaminationStatus)
  status?: ExaminationStatus;

  @IsOptional()
  @IsEnum(InvigilatorAssignmentStatus)
  invigilatorStatus?: InvigilatorAssignmentStatus;

  @IsOptional()
  @IsEnum(WhatsAppShareStatus)
  announcementStatus?: WhatsAppShareStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
