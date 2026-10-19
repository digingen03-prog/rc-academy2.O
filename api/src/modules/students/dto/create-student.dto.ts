import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsEnum,
  IsArray,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Gender, StudentStatus } from '@prisma/client';

export class GuardianItemDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @ValidateIf((o) => !!o.email)
  @IsEmail()
  email?: string;

  @IsString()
  @IsNotEmpty()
  relationship!: string;
}

export class CourseEnrollmentItemDto {
  @IsOptional()
  @IsString()
  courseId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Batch selection is required' })
  batchId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class CreateStudentDto {
  @IsString()
  @IsOptional()
  studentCode?: string;

  @IsString()
  @IsOptional()
  admissionNumber?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  schoolName?: string;

  @IsString()
  @IsOptional()
  dateOfJoining?: string;

  @IsString()
  @IsOptional()
  academicBoard?: string;

  @IsString()
  @IsOptional()
  referralSource?: string;

  @IsString()
  @IsOptional()
  alternativePhone?: string;

  @IsString()
  @IsOptional()
  fatherName?: string;

  @IsString()
  @IsOptional()
  fatherPhone?: string;

  @IsString()
  @IsOptional()
  motherName?: string;

  @IsString()
  @IsOptional()
  motherPhone?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  dob!: string;

  @IsEnum(Gender, { message: 'Gender must be MALE, FEMALE, or OTHER' })
  gender!: Gender;

  @IsOptional()
  @ValidateIf((o) => !!o.email)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  batchId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CourseEnrollmentItemDto)
  enrollments?: CourseEnrollmentItemDto[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  batchIds?: string[];

  @IsArray()
  @IsOptional()
  targetEnrollments?: any[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GuardianItemDto)
  guardians?: GuardianItemDto[];

  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  @IsOptional()
  guardianPhone?: string;

  @IsString()
  @IsOptional()
  guardianRelationship?: string;
}

export class UpdateStudentDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  schoolName?: string;

  @IsString()
  @IsOptional()
  dateOfJoining?: string;

  @IsString()
  @IsOptional()
  academicBoard?: string;

  @IsString()
  @IsOptional()
  referralSource?: string;

  @IsString()
  @IsOptional()
  alternativePhone?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  dob?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsOptional()
  @ValidateIf((o) => !!o.email)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GuardianItemDto)
  guardians?: GuardianItemDto[];
}

export class EnrollStudentDto {
  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsNotEmpty()
  batchId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  allowMultipleInCourse?: boolean;
}

export class BulkImportRowDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  rawName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  schoolName?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  gender?: Gender;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternativePhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  dateOfJoining?: string;

  @IsOptional()
  @IsString()
  academicBoard?: string;

  @IsOptional()
  @IsString()
  referralSource?: string;

  @IsOptional()
  @IsString()
  courseCode?: string;

  @IsOptional()
  @IsString()
  batchCode?: string;

  @IsOptional()
  @IsString()
  subjectCode?: string;

  @IsOptional()
  @IsString()
  subjects?: string;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  guardianRelationship?: string;

  @IsOptional()
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  fatherPhone?: string;

  @IsOptional()
  @IsString()
  motherName?: string;

  @IsOptional()
  @IsString()
  motherPhone?: string;

  @IsOptional()
  @IsArray()
  guardians?: GuardianItemDto[];

  @IsOptional()
  @IsString()
  targetCourseId?: string;

  @IsOptional()
  @IsString()
  targetBatchId?: string;

  @IsOptional()
  @IsArray()
  targetSubjectIds?: string[];
}

export class BulkValidateDto {
  @IsArray()
  rows!: BulkImportRowDto[];

  @IsOptional()
  @IsString()
  defaultCourseId?: string;

  @IsOptional()
  @IsString()
  defaultBatchId?: string;
}

export class BulkImportDto {
  @IsArray()
  rows!: BulkImportRowDto[];

  @IsOptional()
  @IsString()
  defaultCourseId?: string;

  @IsOptional()
  @IsString()
  defaultBatchId?: string;
}
