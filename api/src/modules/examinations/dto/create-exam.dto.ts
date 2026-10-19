import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsOptional,
  IsEnum,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  QuestionType,
  DifficultyLevel,
  ExaminationStatus,
  ExamType,
  QuestionStatus,
  ExamAttendanceStatus,
} from '@prisma/client';

export class CreateQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty({ message: 'Subject ID is required' })
  subjectId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Topic is required' })
  topic!: string;

  @IsEnum(QuestionType, { message: 'Invalid question type' })
  questionType!: QuestionType;

  @IsEnum(DifficultyLevel, { message: 'Invalid difficulty level' })
  difficulty!: DifficultyLevel;

  @IsString()
  @IsNotEmpty({ message: 'Question content is required' })
  content!: string;

  @IsNumber()
  @Min(0.5, { message: 'Marks must be at least 0.5' })
  maxMarks!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];

  @IsOptional()
  @IsString()
  answerKeyText?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  sourceReference?: string;

  @IsOptional()
  markingRubricJson?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  maxMarks?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];

  @IsOptional()
  @IsString()
  answerKeyText?: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsString()
  sourceReference?: string;

  @IsOptional()
  markingRubricJson?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;
}

export class CreateExaminationDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title!: string;

  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;

  @IsString()
  @IsNotEmpty({ message: 'Class ID is required' })
  classId!: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Subject ID is required' })
  subjectId!: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Date is required (YYYY-MM-DD)' })
  date!: string; // YYYY-MM-DD

  @IsNumber()
  @Min(1, { message: 'Duration must be at least 1 minute' })
  durationMinutes!: number;

  @IsNumber()
  @Min(1, { message: 'Total marks must be greater than zero' })
  totalMarks!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class UpdateExaminationDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(ExamType)
  examType?: ExamType;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  totalMarks?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  passMarks?: number;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsEnum(ExaminationStatus)
  status?: ExaminationStatus;
}

export class PaperQuestionItemDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsOptional()
  @IsString()
  sectionName?: string;

  @IsOptional()
  @IsString()
  sectionInstructions?: string;

  @IsOptional()
  @IsNumber()
  orderNumber?: number;
}

export class ConfigurePaperDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaperQuestionItemDto)
  questions!: PaperQuestionItemDto[];
}

export class GenerateAIQuestionsDto {
  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsString()
  @IsNotEmpty()
  topic!: string;

  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @IsNumber()
  @Min(1)
  @Max(50)
  count!: number;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @IsOptional()
  @IsNumber()
  marksPerQuestion?: number;
}

export class RecordExamAttendanceDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsEnum(ExamAttendanceStatus)
  status!: ExamAttendanceStatus;
}

export class StudentMarkEntryDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsNumber()
  @Min(0)
  marks!: number;

  @IsOptional()
  @IsEnum(ExamAttendanceStatus)
  attendanceStatus?: ExamAttendanceStatus;
}

export class SubmitMarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentMarkEntryDto)
  entries!: StudentMarkEntryDto[];
}

export class CorrectResultDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsNumber()
  @Min(0)
  correctedMarks!: number;

  @IsString()
  @IsNotEmpty({ message: 'Correction reason is required' })
  reason!: string;
}
