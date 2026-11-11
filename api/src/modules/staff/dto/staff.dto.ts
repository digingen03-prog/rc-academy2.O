import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '@prisma/client';

export class CourseAssignmentItemDto {
  @IsString()
  @IsNotEmpty()
  courseId!: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsOptional()
  staffSharePercentage?: number;

  @IsString()
  @IsOptional()
  compensationRule?: string;

  @IsOptional()
  settlementConfig?: any;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  isActive?: boolean;
}

export class CreateStaffDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  role!: string; // 'TEACHER' | 'ACADEMY_ADMIN' | 'ACCOUNTANT' | 'STAFF'

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  staffCategory?: 'GENERAL' | 'FACULTY';

  @IsString()
  @IsOptional()
  compensationModel?: 'FIXED_SALARY' | 'REVENUE_SHARING';

  @IsOptional()
  fixedSalaryAmount?: number;

  @IsString()
  @IsOptional()
  payFrequency?: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';

  @IsString()
  @IsOptional()
  compensationEffectiveDate?: string;

  @IsString()
  @IsOptional()
  dateOfJoining?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CourseAssignmentItemDto)
  courseAssignments?: CourseAssignmentItemDto[];
}

export class UpdateStaffDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  staffCategory?: 'GENERAL' | 'FACULTY';

  @IsString()
  @IsOptional()
  compensationModel?: 'FIXED_SALARY' | 'REVENUE_SHARING';

  @IsOptional()
  fixedSalaryAmount?: number;

  @IsString()
  @IsOptional()
  payFrequency?: 'MONTHLY' | 'BI_WEEKLY' | 'WEEKLY';

  @IsString()
  @IsOptional()
  compensationEffectiveDate?: string;

  @IsString()
  @IsOptional()
  dateOfJoining?: string;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CourseAssignmentItemDto)
  courseAssignments?: CourseAssignmentItemDto[];
}

export class AssignStaffCoursesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseAssignmentItemDto)
  assignments!: CourseAssignmentItemDto[];
}
