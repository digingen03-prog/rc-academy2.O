import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, InvoiceStatus, FeeAdjustmentType } from '@prisma/client';

export class InstallmentScheduleItemDto {
  @IsNumber()
  installmentNumber!: number;

  @IsNumber()
  percentage!: number;

  @IsNumber()
  dueDaysOffset!: number;
}

export class CreateCourseFeeConfigDto {
  @IsString()
  @IsNotEmpty({ message: 'Configuration name is required' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Academic year ID is required' })
  academicYearId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Course/Class ID is required' })
  classId!: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsNumber()
  @Min(0, { message: 'Fee amount must be greater than or equal to zero' })
  amount!: number;

  @IsOptional()
  @IsString()
  billingPeriod?: string = 'ANNUAL';

  @IsOptional()
  @IsNumber()
  @Min(1)
  installmentCount?: number = 1;

  @IsOptional()
  @IsArray()
  installmentsSchedule?: any[];

  @IsOptional()
  @IsArray()
  allowedDiscounts?: any[];

  @IsOptional()
  @IsString()
  effectiveStartDate?: string;

  @IsOptional()
  @IsString()
  effectiveEndDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsBoolean()
  replicateToStudents?: boolean;
}

export class UpdateCourseFeeConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

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
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  billingPeriod?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  installmentCount?: number;

  @IsOptional()
  @IsArray()
  installmentsSchedule?: any[];

  @IsOptional()
  @IsArray()
  allowedDiscounts?: any[];

  @IsOptional()
  @IsString()
  effectiveStartDate?: string;

  @IsOptional()
  @IsString()
  effectiveEndDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  replicateToStudents?: boolean;
}

export class CourseInvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class CreateCourseInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Student ID is required' })
  studentId!: string;

  @IsOptional()
  @IsString()
  enrollmentId?: string;

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
  courseFeeConfigId?: string;

  @IsOptional()
  @IsString()
  billingPeriod?: string = 'ANNUAL';

  @IsNumber()
  @Min(0, { message: 'Total amount must be greater than or equal to zero' })
  totalAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsString()
  @IsNotEmpty({ message: 'Due date is required' })
  dueDate!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseInvoiceLineDto)
  lines?: CourseInvoiceLineDto[];
}

export class ApplyFeeAdjustmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Invoice ID is required' })
  invoiceId!: string;

  @IsEnum(FeeAdjustmentType, { message: 'Invalid adjustment type' })
  type!: FeeAdjustmentType;

  @IsNumber()
  @Min(0.01, { message: 'Adjustment amount must be greater than zero' })
  amount!: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason for adjustment is required' })
  reason!: string;
}

export class PaymentAllocationItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Invoice ID is required' })
  invoiceId!: string;

  @IsNumber()
  @Min(0.01, { message: 'Allocated amount must be greater than zero' })
  amount!: number;
}

export class RecordCoursePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Student ID is required' })
  studentId!: string;

  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than zero' })
  amount!: number;

  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationItemDto)
  allocations?: PaymentAllocationItemDto[];
}
