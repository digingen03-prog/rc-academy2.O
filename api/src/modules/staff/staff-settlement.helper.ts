import { Decimal } from '@prisma/client/runtime/library';

export type SettlementRuleMode =
  | 'STUDENT_TIER_BASED'
  | 'PER_STUDENT_FIXED'
  | 'REVENUE_SHARE_PERCENTAGE'
  | 'LEGACY';

export type TierCalculationType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface StaffSettlementTierItem {
  type: TierCalculationType;
  value: number; // e.g., 25 (%) or 1000 (₹)
}

export interface StaffSettlementConfig {
  mode: SettlementRuleMode;
  // Student tier based rules (mirrors student fee config tiers)
  allSubjects?: StaffSettlementTierItem; // Student enrolled in all subjects / bundle
  singleSubject?: StaffSettlementTierItem; // Student enrolled in 1 subject
  twoSubjects?: StaffSettlementTierItem; // Student enrolled in 2 subjects (optional bundle)
  // Flat per-student amount
  perStudentAmount?: number; // e.g., ₹1,000 / student
  // Standard flat pool share %
  staffSharePercentage?: number; // e.g., 70%
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
 * Parses any staff compensationRule string (JSON-encoded or legacy string identifier).
 */
export function parseStaffSettlementRule(
  rawRule?: string | null,
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

  // Check if JSON-encoded configuration
  if (rawRule.trim().startsWith('{')) {
    try {
      const parsed: StaffSettlementConfig = JSON.parse(rawRule);
      if (parsed.mode === 'STUDENT_TIER_BASED') {
        const allDesc = parsed.allSubjects
          ? parsed.allSubjects.type === 'PERCENTAGE'
            ? `${parsed.allSubjects.value}%`
            : `₹${parsed.allSubjects.value}`
          : 'N/A';
        const singleDesc = parsed.singleSubject
          ? parsed.singleSubject.type === 'PERCENTAGE'
            ? `${parsed.singleSubject.value}%`
            : `₹${parsed.singleSubject.value}`
          : 'N/A';
        return {
          mode: 'STUDENT_TIER_BASED',
          displayText: `Tiered Rule: All-Subjects (${allDesc}) | Single-Subject (${singleDesc})`,
          badgeText: `Tiered: All ${allDesc} • Single ${singleDesc}`,
          config: parsed,
        };
      }

      if (parsed.mode === 'PER_STUDENT_FIXED') {
        const amt = parsed.perStudentAmount || 0;
        return {
          mode: 'PER_STUDENT_FIXED',
          displayText: `Fixed ₹${amt.toLocaleString('en-IN')} per Student`,
          badgeText: `₹${amt.toLocaleString('en-IN')}/Student`,
          config: parsed,
        };
      }

      if (parsed.mode === 'REVENUE_SHARE_PERCENTAGE') {
        const share = parsed.staffSharePercentage ?? fallbackShare;
        return {
          mode: 'REVENUE_SHARE_PERCENTAGE',
          displayText: `${share}% Revenue Share`,
          badgeText: `${share}% Pool`,
          config: parsed,
        };
      }
    } catch {
      // Fall through to string match
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

  if (rawRule === 'CUSTOM_CONTRACT') {
    return {
      mode: 'REVENUE_SHARE_PERCENTAGE',
      displayText: `${fallbackShare}% Custom Contract`,
      badgeText: `${fallbackShare}% Custom`,
      config: { mode: 'REVENUE_SHARE_PERCENTAGE', staffSharePercentage: fallbackShare },
    };
  }

  return {
    mode: 'LEGACY',
    displayText: rawRule,
    badgeText: rawRule,
    config: null,
  };
}

export interface SettlementCalculationInput {
  compensationRule?: string | null;
  defaultStaffRate: Decimal;
  collectedAmount: Decimal; // poolFraction or lineFraction
  studentTier: 'ALL' | 'TWO_SUBJECTS' | 'SINGLE_SUBJECT';
}

export interface SettlementCalculationOutput {
  staffPoolRate: Decimal;
  academyShareRate: Decimal;
  staffPoolAmount: Decimal;
  academyShareAmount: Decimal;
  earnedAmount: Decimal;
  ruleApplied: string;
}

/**
 * Calculates earnings for a faculty assignment based on collected fee and student tier.
 */
export function calculateStaffSettlement(
  input: SettlementCalculationInput,
): SettlementCalculationOutput {
  const { compensationRule, defaultStaffRate, collectedAmount, studentTier } = input;
  const parsed = parseStaffSettlementRule(
    compensationRule,
    Number(defaultStaffRate) || 70,
  );

  let staffRate = defaultStaffRate;
  let staffAmount = collectedAmount.mul(defaultStaffRate).div(100);
  let ruleApplied = compensationRule || 'REVENUE_SHARE_70_30';

  if (parsed.mode === 'STUDENT_TIER_BASED' && parsed.config) {
    const cfg = parsed.config;
    let targetTierConfig: StaffSettlementTierItem | undefined;

    if (studentTier === 'ALL') {
      targetTierConfig = cfg.allSubjects;
    } else if (studentTier === 'TWO_SUBJECTS') {
      targetTierConfig = cfg.twoSubjects || cfg.singleSubject;
    } else {
      // SINGLE_SUBJECT
      targetTierConfig = cfg.singleSubject;
    }

    if (targetTierConfig) {
      if (targetTierConfig.type === 'PERCENTAGE') {
        staffRate = new Decimal(targetTierConfig.value);
        staffAmount = collectedAmount.mul(staffRate).div(100);
        ruleApplied = `TIERED: ${studentTier} (${staffRate.toFixed(1)}%)`;
      } else {
        // FIXED_AMOUNT (per student)
        const fixedAmt = new Decimal(targetTierConfig.value);
        // Earnings are either fixed amount or capped by collected fee if collected is lower
        staffAmount = collectedAmount.gt(0)
          ? Decimal.min(collectedAmount, fixedAmt)
          : fixedAmt;
        staffRate = collectedAmount.gt(0)
          ? staffAmount.mul(100).div(collectedAmount)
          : new Decimal(100);
        ruleApplied = `TIERED: ${studentTier} (₹${fixedAmt.toNumber().toLocaleString('en-IN')}/student)`;
      }
    }
  } else if (parsed.mode === 'PER_STUDENT_FIXED' && parsed.config) {
    const fixedAmt = new Decimal(parsed.config.perStudentAmount || 0);
    staffAmount = collectedAmount.gt(0)
      ? Decimal.min(collectedAmount, fixedAmt)
      : fixedAmt;
    staffRate = collectedAmount.gt(0)
      ? staffAmount.mul(100).div(collectedAmount)
      : new Decimal(100);
    ruleApplied = `PER_STUDENT (₹${fixedAmt.toNumber().toLocaleString('en-IN')}/student)`;
  } else if (parsed.mode === 'REVENUE_SHARE_PERCENTAGE' && parsed.config) {
    staffRate = new Decimal(parsed.config.staffSharePercentage ?? Number(defaultStaffRate) ?? 70);
    staffAmount = collectedAmount.mul(staffRate).div(100);
    ruleApplied = `REVENUE_SHARE_${staffRate.toNumber()}_${new Decimal(100).sub(staffRate).toNumber()}`;
  }

  // Decimal rounding & bounds
  const staffPoolAmount = staffAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const academyShareAmount = Decimal.max(
    new Decimal(0),
    collectedAmount.sub(staffPoolAmount),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const effectiveStaffRate = staffRate.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const effectiveAcademyRate = Decimal.max(
    new Decimal(0),
    new Decimal(100).sub(effectiveStaffRate),
  ).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    staffPoolRate: effectiveStaffRate,
    academyShareRate: effectiveAcademyRate,
    staffPoolAmount,
    academyShareAmount,
    earnedAmount: staffPoolAmount,
    ruleApplied,
  };
}
