import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';

export type StudentTier = 'ALL' | 'TWO_SUBJECTS' | 'SINGLE' | 'SINGLE_SUBJECT' | 'CUSTOM';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export type SettlementRuleMode =
  | 'STUDENT_TIER_BASED'
  | 'PER_STUDENT_FIXED'
  | 'REVENUE_SHARE_PERCENTAGE'
  | 'LEGACY';

export type TierCalculationType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export const TierConfigItemSchema = z.object({
  type: z.enum(['FIXED_AMOUNT', 'PERCENTAGE']),
  value: z.number().min(0),
});

export const CompensationRuleSchema = z.object({
  mode: z.enum(['STUDENT_TIER_BASED', 'PER_STUDENT_FIXED', 'REVENUE_SHARE_PERCENTAGE', 'LEGACY']),
  config: z
    .object({
      allSubjects: TierConfigItemSchema.optional(),
      twoSubjects: TierConfigItemSchema.optional(),
      singleSubject: TierConfigItemSchema.optional(),
      perStudentAmount: z.number().min(0).optional(),
      staffSharePercentage: z.number().min(0).max(100).optional(),
      customFallbackTier: z.enum(['ALL', 'TWO_SUBJECTS', 'SINGLE']).optional(),
      subjectId: z.string().optional(),
      billingPeriod: z.string().optional(),
      label: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export type CompensationRule = z.infer<typeof CompensationRuleSchema>;

export interface StaffSettlementTierItem {
  type: TierCalculationType;
  value: number;
}

export interface StaffSettlementConfig {
  mode: SettlementRuleMode;
  allSubjects?: StaffSettlementTierItem;
  singleSubject?: StaffSettlementTierItem;
  twoSubjects?: StaffSettlementTierItem;
  perStudentAmount?: number;
  staffSharePercentage?: number;
  customFallbackTier?: 'ALL' | 'TWO_SUBJECTS' | 'SINGLE';
  subjectId?: string;
  billingPeriod?: string;
  label?: string;
  notes?: string;
}

export interface ParsedStaffSettlementRule {
  mode: SettlementRuleMode;
  displayText: string;
  badgeText: string;
  config: StaffSettlementConfig | null;
}

/**
 * Parses any staff compensationRule (JSON object, JSON string, or legacy identifier).
 */
export function parseStaffSettlementRule(
  rawRule?: any,
  fallbackShare: number = 70,
): ParsedStaffSettlementRule {
  if (!rawRule) {
    return {
      mode: 'REVENUE_SHARE_PERCENTAGE',
      displayText: `${fallbackShare}% Pool Share`,
      badgeText: `${fallbackShare}% Pool`,
      config: {
        mode: 'REVENUE_SHARE_PERCENTAGE',
        staffSharePercentage: fallbackShare,
      },
    };
  }

  let parsed: any = rawRule;
  if (typeof rawRule === 'string' && rawRule.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(rawRule);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === 'object') {
    const mode = parsed.mode || 'STUDENT_TIER_BASED';
    const cfg = parsed.config || parsed;

    if (mode === 'STUDENT_TIER_BASED') {
      const allDesc = cfg.allSubjects
        ? cfg.allSubjects.type === 'PERCENTAGE'
          ? `${cfg.allSubjects.value}%`
          : `₹${Number(cfg.allSubjects.value).toLocaleString('en-IN')}`
        : 'N/A';
      const singleDesc = cfg.singleSubject
        ? cfg.singleSubject.type === 'PERCENTAGE'
          ? `${cfg.singleSubject.value}%`
          : `₹${Number(cfg.singleSubject.value).toLocaleString('en-IN')}`
        : 'N/A';
      return {
        mode: 'STUDENT_TIER_BASED',
        displayText: `Tiered Rule: All (${allDesc}) | Single (${singleDesc})`,
        badgeText: `All ${allDesc} • Single ${singleDesc}`,
        config: {
          mode: 'STUDENT_TIER_BASED',
          allSubjects: cfg.allSubjects,
          twoSubjects: cfg.twoSubjects,
          singleSubject: cfg.singleSubject,
          customFallbackTier: cfg.customFallbackTier,
        },
      };
    }

    if (mode === 'PER_STUDENT_FIXED') {
      const amt = cfg.perStudentAmount || 0;
      return {
        mode: 'PER_STUDENT_FIXED',
        displayText: `Fixed ₹${amt.toLocaleString('en-IN')} per Student`,
        badgeText: `₹${amt.toLocaleString('en-IN')}/Student`,
        config: {
          mode: 'PER_STUDENT_FIXED',
          perStudentAmount: amt,
          subjectId: cfg.subjectId,
          billingPeriod: cfg.billingPeriod,
          label: cfg.label,
        },
      };
    }

    if (mode === 'REVENUE_SHARE_PERCENTAGE') {
      const share = cfg.staffSharePercentage ?? fallbackShare;
      return {
        mode: 'REVENUE_SHARE_PERCENTAGE',
        displayText: `${share}% Revenue Share`,
        badgeText: `${share}% Pool`,
        config: { mode: 'REVENUE_SHARE_PERCENTAGE', staffSharePercentage: share },
      };
    }
  }

  // Handle legacy string patterns
  if (rawRule === 'REVENUE_SHARE_70_30') {
    return {
      mode: 'REVENUE_SHARE_PERCENTAGE',
      displayText: '70/30 Standard Revenue Share',
      badgeText: '70% Pool',
      config: { mode: 'REVENUE_SHARE_PERCENTAGE', staffSharePercentage: 70 },
    };
  }

  if (rawRule === 'FULL_POOL_100') {
    return {
      mode: 'REVENUE_SHARE_PERCENTAGE',
      displayText: '100% Direct Payout',
      badgeText: '100% Direct',
      config: { mode: 'REVENUE_SHARE_PERCENTAGE', staffSharePercentage: 100 },
    };
  }

  return {
    mode: 'LEGACY',
    displayText: typeof rawRule === 'string' ? rawRule : 'Custom Rule',
    badgeText: 'Custom',
    config: null,
  };
}

export interface SettlementCalculationInput {
  compensationRule: unknown;
  studentTier: StudentTier;
  collectedAmount: Decimal; // actual amount the student paid this event
  defaultStaffRate?: number | Decimal; // legacy fallback only
  studentFee?: Decimal | number; // base student fee for this tier (for realizedAmount calculation)
}

export interface SettlementCalculationOutput {
  staffPoolAmount: Decimal; // = fixed amount for tier (entitlement)
  academyShareAmount: Decimal;
  realizedAmount: Decimal; // = min(staffPoolAmount, collected × ratio) — for display
  ruleApplied: string;
  tierUsed: StudentTier;
  // Backwards-compatibility properties for existing salary calculations
  earnedAmount: Decimal;
  staffPoolRate: Decimal;
  academyShareRate: Decimal;
}

/**
 * Calculates earnings for a faculty assignment based on fixed student tier amount or fallback rule.
 * Entitlement accrues as a fixed rupee amount and is NOT capped by collectedAmount.
 */
export function calculateStaffSettlement(
  input: SettlementCalculationInput,
): SettlementCalculationOutput {
  const { compensationRule, studentTier, collectedAmount, defaultStaffRate = 70, studentFee } = input;
  const numericDefaultRate = Number(defaultStaffRate) || 70;

  // Normalize SINGLE_SUBJECT to SINGLE
  const normalizedTier: StudentTier = studentTier === 'SINGLE_SUBJECT' ? 'SINGLE' : studentTier;

  let parsedRule: any = compensationRule;
  if (typeof compensationRule === 'string') {
    try {
      parsedRule = JSON.parse(compensationRule);
    } catch {
      parsedRule = {
        mode: 'REVENUE_SHARE_PERCENTAGE',
        config: { staffSharePercentage: numericDefaultRate },
      };
    }
  }

  if (!parsedRule) {
    parsedRule = {
      mode: 'REVENUE_SHARE_PERCENTAGE',
      config: { staffSharePercentage: numericDefaultRate },
    };
  }

  // If parsed rule has no nested `config` wrapper but has properties at root, normalize it
  if (parsedRule.mode && !parsedRule.config && (parsedRule.allSubjects || parsedRule.perStudentAmount || parsedRule.staffSharePercentage)) {
    parsedRule = {
      mode: parsedRule.mode,
      config: {
        allSubjects: parsedRule.allSubjects,
        twoSubjects: parsedRule.twoSubjects,
        singleSubject: parsedRule.singleSubject,
        perStudentAmount: parsedRule.perStudentAmount,
        staffSharePercentage: parsedRule.staffSharePercentage,
        customFallbackTier: parsedRule.customFallbackTier,
      },
    };
  }

  // Validate with zod
  const zodResult = CompensationRuleSchema.safeParse(parsedRule);
  if (!zodResult.success) {
    throw new ValidationError(`MALFORMED_COMPENSATION_RULE: ${zodResult.error.message}`);
  }

  const validRule = zodResult.data;
  const config = validRule.config || {};

  let staffPoolAmount: Decimal = new Decimal(0);
  let effectiveTier: StudentTier = normalizedTier;
  let ruleApplied = '';

  if (validRule.mode === 'STUDENT_TIER_BASED') {
    // Check CUSTOM tier handling
    if (normalizedTier === 'CUSTOM') {
      if (!config.customFallbackTier) {
        throw new ValidationError('CUSTOM_TIER_NOT_SUPPORTED_WITHOUT_FALLBACK');
      }
      effectiveTier = config.customFallbackTier;
    }

    let targetTierConfig: z.infer<typeof TierConfigItemSchema> | undefined;
    if (effectiveTier === 'ALL') {
      targetTierConfig = config.allSubjects;
      if (!targetTierConfig) {
        throw new ValidationError('MISSING_TIER_CONFIG:ALL');
      }
    } else if (effectiveTier === 'TWO_SUBJECTS') {
      targetTierConfig = config.twoSubjects;
      if (!targetTierConfig) {
        throw new ValidationError('MISSING_TIER_CONFIG:TWO_SUBJECTS');
      }
    } else if (effectiveTier === 'SINGLE') {
      targetTierConfig = config.singleSubject;
      if (!targetTierConfig) {
        throw new ValidationError('MISSING_TIER_CONFIG:SINGLE');
      }
    } else {
      throw new ValidationError(`MISSING_TIER_CONFIG:${effectiveTier}`);
    }

    if (targetTierConfig.type === 'FIXED_AMOUNT') {
      // Entitlement is fixed amount — DO NOT cap at collectedAmount
      staffPoolAmount = new Decimal(targetTierConfig.value);
      ruleApplied = `FIXED_AMOUNT_${effectiveTier}_${targetTierConfig.value}`;
    } else {
      // PERCENTAGE mode
      const rate = new Decimal(targetTierConfig.value);
      staffPoolAmount = collectedAmount.mul(rate).div(100);
      ruleApplied = `PERCENTAGE_${effectiveTier}_${rate.toFixed(1)}%`;
    }
  } else if (validRule.mode === 'PER_STUDENT_FIXED') {
    if (config.perStudentAmount === undefined) {
      throw new ValidationError('MISSING_CONFIG:perStudentAmount');
    }
    staffPoolAmount = new Decimal(config.perStudentAmount);
    ruleApplied = `PER_STUDENT_FIXED_${config.perStudentAmount}`;
  } else if (validRule.mode === 'REVENUE_SHARE_PERCENTAGE') {
    const share = config.staffSharePercentage ?? numericDefaultRate;
    staffPoolAmount = collectedAmount.mul(new Decimal(share)).div(100);
    ruleApplied = `REVENUE_SHARE_${share}%`;
  } else {
    // LEGACY fallback
    staffPoolAmount = collectedAmount.mul(new Decimal(numericDefaultRate)).div(100);
    ruleApplied = `LEGACY_${numericDefaultRate}%`;
  }

  // Round staffPoolAmount HALF_UP to 2 decimal places
  staffPoolAmount = staffPoolAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // academyShareAmount = max(0, collectedAmount - staffPoolAmount)
  const academyShareAmount = Decimal.max(
    new Decimal(0),
    collectedAmount.sub(staffPoolAmount),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Calculate effective rates for legacy consumers
  let staffPoolRate = new Decimal(numericDefaultRate);
  if (collectedAmount.gt(0)) {
    staffPoolRate = Decimal.min(new Decimal(100), staffPoolAmount.mul(100).div(collectedAmount));
  }
  staffPoolRate = staffPoolRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const academyShareRate = Decimal.max(new Decimal(0), new Decimal(100).sub(staffPoolRate)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // realizedAmount (display only) = staffPoolAmount × (collected / studentFee) clamped to [0, staffPoolAmount]
  let realizedAmount = new Decimal(0);
  const effectiveStudentFee = studentFee ? new Decimal(studentFee) : null;

  if (effectiveStudentFee && effectiveStudentFee.gt(0)) {
    const ratio = collectedAmount.div(effectiveStudentFee);
    realizedAmount = staffPoolAmount.mul(ratio);
  } else {
    realizedAmount = Decimal.min(staffPoolAmount, collectedAmount);
  }

  realizedAmount = Decimal.max(
    new Decimal(0),
    Decimal.min(staffPoolAmount, realizedAmount),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    staffPoolAmount,
    academyShareAmount,
    realizedAmount,
    ruleApplied,
    tierUsed: effectiveTier,
    earnedAmount: staffPoolAmount,
    staffPoolRate,
    academyShareRate,
  };
}

export interface SubjectFeeItem {
  subjectId: string;
  catalogFee: Decimal | number;
}

export interface SubjectFeeAllocationInput {
  netPackageFee: Decimal | number;
  subjects: SubjectFeeItem[];
}

export interface SubjectFeeAllocationResult {
  allocations: {
    subjectId: string;
    allocatedFee: Decimal;
    weight: Decimal;
  }[];
  totalAllocated: Decimal;
}

/**
 * Deterministically allocates a net package fee across enrolled subjects using catalog fee weights
 * with exact penny-reconciliation (the sum of allocations equals netPackageFee to the exact cent).
 */
export function allocatePackageFeeToSubjects(
  input: SubjectFeeAllocationInput,
): SubjectFeeAllocationResult {
  const netPkg = new Decimal(input.netPackageFee).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const subjects = input.subjects || [];

  if (subjects.length === 0) {
    return { allocations: [], totalAllocated: new Decimal(0) };
  }

  const totalCatalog = subjects.reduce(
    (sum, s) => sum.add(new Decimal(s.catalogFee)),
    new Decimal(0),
  );

  if (totalCatalog.lte(0)) {
    // Equal distribution with penny reconciliation on last subject
    const equalShare = netPkg.div(subjects.length).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    let runningTotal = new Decimal(0);
    const allocations = subjects.map((s, idx) => {
      let amt = equalShare;
      if (idx === subjects.length - 1) {
        amt = netPkg.sub(runningTotal);
      } else {
        runningTotal = runningTotal.add(amt);
      }
      return {
        subjectId: s.subjectId,
        allocatedFee: amt,
        weight: new Decimal(1).div(subjects.length).toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
      };
    });
    return { allocations, totalAllocated: netPkg };
  }

  let runningAllocated = new Decimal(0);
  const allocations = subjects.map((s, idx) => {
    const catalog = new Decimal(s.catalogFee);
    const weight = catalog.div(totalCatalog);
    let allocatedFee: Decimal;

    if (idx === subjects.length - 1) {
      // Final subject absorbs rounding remainder to ensure exact penny reconciliation
      allocatedFee = netPkg.sub(runningAllocated);
    } else {
      allocatedFee = netPkg.mul(weight).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      runningAllocated = runningAllocated.add(allocatedFee);
    }

    return {
      subjectId: s.subjectId,
      allocatedFee,
      weight: weight.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
    };
  });

  return { allocations, totalAllocated: netPkg };
}

export interface SalaryProrationResult {
  fullMonthlySalary: number;
  daysInMonth: number;
  daysWorked: number;
  proratedSalary: number;
  isProrated: boolean;
  joiningDate: string;
  month: string;
}

/**
 * Calculates monthly salary entitlement prorated from joining date for fixed salary staff.
 * If joined during the target month: (salary * daysWorked) / daysInMonth.
 * If joined in prior months: full monthly salary.
 * If joined in future months: 0.
 */
export function calculateMonthlySalaryProration(
  fixedSalary: number,
  joiningDateInput: Date | string | null | undefined,
  targetMonth: string,
): SalaryProrationResult {
  const [yearStr, monthStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const daysInMonth = new Date(year, month, 0).getDate();

  if (!joiningDateInput || isNaN(fixedSalary) || fixedSalary <= 0) {
    return {
      fullMonthlySalary: fixedSalary || 0,
      daysInMonth,
      daysWorked: daysInMonth,
      proratedSalary: fixedSalary || 0,
      isProrated: false,
      joiningDate: '',
      month: targetMonth,
    };
  }

  const joinDate = new Date(joiningDateInput);
  const joinYear = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth() + 1; // 1-12
  const joinDay = joinDate.getDate();

  // Joined in a future month: 0 settlement for this past month
  if (joinYear > year || (joinYear === year && joinMonth > month)) {
    return {
      fullMonthlySalary: fixedSalary,
      daysInMonth,
      daysWorked: 0,
      proratedSalary: 0,
      isProrated: true,
      joiningDate: joinDate.toISOString().split('T')[0],
      month: targetMonth,
    };
  }

  // Joined before target month: full monthly salary
  if (joinYear < year || (joinYear === year && joinMonth < month)) {
    return {
      fullMonthlySalary: fixedSalary,
      daysInMonth,
      daysWorked: daysInMonth,
      proratedSalary: fixedSalary,
      isProrated: false,
      joiningDate: joinDate.toISOString().split('T')[0],
      month: targetMonth,
    };
  }

  // Joined during target month: prorate from joinDay to month end
  const daysWorked = Math.max(0, daysInMonth - joinDay + 1);
  const proratedSalary = Math.round((fixedSalary * daysWorked) / daysInMonth);

  return {
    fullMonthlySalary: fixedSalary,
    daysInMonth,
    daysWorked,
    proratedSalary,
    isProrated: daysWorked < daysInMonth,
    joiningDate: joinDate.toISOString().split('T')[0],
    month: targetMonth,
  };
}
