import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubmissionStatus } from '@prisma/client';

export class ExtractedAnswerItemDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsString()
  @IsNotEmpty()
  extractedAnswer!: string;
}

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty({ message: 'Examination ID is required' })
  examinationId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Student ID is required' })
  studentId!: string;

  @IsOptional()
  @IsString()
  fileAssetUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSizeBytes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pageCount?: number;

  @IsOptional()
  @IsString()
  ocrText?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtractedAnswerItemDto)
  answers?: ExtractedAnswerItemDto[];
}

export class ReviewQuestionEvaluationDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsNumber()
  @Min(0)
  reviewedMarks!: number;

  @IsOptional()
  @IsString()
  teacherNotes?: string;
}

export class ApproveEvaluationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewQuestionEvaluationDto)
  questionReviews?: ReviewQuestionEvaluationDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  transferToOfficialResult?: boolean;
}

export class RejectSubmissionDto {
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  reason!: string;
}
