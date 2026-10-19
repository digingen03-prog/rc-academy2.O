import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, InvoiceStatus } from '@prisma/client';

export class CreateFeePlanDto {
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Academic year ID is required' })
  academicYearId!: string;

  @IsNumber()
  @Min(1, { message: 'Total amount must be greater than zero' })
  totalAmount!: number;
}

export class InvoiceLineDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Student ID is required' })
  studentId!: string;

  @IsOptional()
  @IsString()
  feePlanId?: string;

  @IsNumber()
  @Min(1, { message: 'Total amount must be greater than zero' })
  totalAmount!: number;

  @IsString()
  @IsNotEmpty({ message: 'Due date is required' })
  dueDate!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];
}

export class PaymentAllocationItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Invoice ID is required' })
  invoiceId!: string;

  @IsNumber()
  @Min(0.01, { message: 'Allocated amount must be greater than zero' })
  amount!: number;
}

export class RecordPaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Student ID is required' })
  studentId!: string;

  @IsNumber()
  @Min(1, { message: 'Amount must be greater than zero' })
  amount!: number;

  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationItemDto)
  allocations?: PaymentAllocationItemDto[];
}

export class ReversePaymentDto {
  @IsString()
  @IsNotEmpty({ message: 'Reversal reason is required' })
  reason!: string;
}
