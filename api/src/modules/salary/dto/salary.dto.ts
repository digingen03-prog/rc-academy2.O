import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSalaryConfigDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultStaffPoolRate?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultAcademyShareRate?: number;

  @IsBoolean()
  @IsOptional()
  isApprovalRequired?: boolean;
}

export class CreatePayoutDto {
  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  ledgerIds?: string[];

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ProcessPayoutDto {
  @IsString()
  @IsIn(['APPROVE', 'PAY', 'CANCEL'])
  action!: 'APPROVE' | 'PAY' | 'CANCEL';

  @IsString()
  @IsOptional()
  transactionRef?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ResolveExceptionDto {
  @IsString()
  @IsNotEmpty()
  resolutionNotes!: string;

  @IsString()
  @IsIn(['RESOLVED', 'IGNORED'])
  @IsOptional()
  status?: 'RESOLVED' | 'IGNORED';
}

export class SalaryLedgerQueryDto {
  @IsString()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  compensationModel?: string;

  @IsString()
  @IsOptional()
  payPeriod?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isReversed?: boolean;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

export class AccrueFixedSalaryDto {
  @IsString()
  @IsNotEmpty()
  payPeriod!: string; // e.g. "2026-10" or "OCT-2026"

  @IsString()
  @IsOptional()
  staffId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateSalaryAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  staffId!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  @IsIn(['BONUS', 'DEDUCTION', 'ADJUSTMENT'])
  type!: 'BONUS' | 'DEDUCTION' | 'ADJUSTMENT';

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  payPeriod?: string;
}
