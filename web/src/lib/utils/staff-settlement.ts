export type SettlementRuleMode =
  | 'STUDENT_TIER_BASED'
  | 'PER_STUDENT_FIXED'
  | 'REVENUE_SHARE_PERCENTAGE';

export type TierCalculationType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface StaffSettlementTierItem {
  type: TierCalculationType;
  value: number; // e.g. 25 (%) or 1000 (₹)
}

export interface StaffSettlementConfig {
  mode: SettlementRuleMode;
  allSubjects?: StaffSettlementTierItem;
  singleSubject?: StaffSettlementTierItem;
  twoSubjects?: StaffSettlementTierItem;
  perStudentAmount?: number;
  staffSharePercentage?: number;
  label?: string;
  notes?: string;
}

export interface SettlementFormState {
  mode: SettlementRuleMode;
  // Student tier fields (mirrors fee config tiers: ALL, SINGLE_SUBJECT, TWO_SUBJECTS)
  allSubjectsType: TierCalculationType;
  allSubjectsValue: number;
  singleSubjectType: TierCalculationType;
  singleSubjectValue: number;
  twoSubjectsType: TierCalculationType;
  twoSubjectsValue: number;
  includeTwoSubjects: boolean;
  // Flat per-student amount
  perStudentAmount: number;
  // Standard percentage share
  staffSharePercentage: number;
}

export const defaultSettlementState: SettlementFormState = {
  mode: 'STUDENT_TIER_BASED',
  allSubjectsType: 'FIXED_AMOUNT',
  allSubjectsValue: 1000,
  singleSubjectType: 'FIXED_AMOUNT',
  singleSubjectValue: 500,
  twoSubjectsType: 'FIXED_AMOUNT',
  twoSubjectsValue: 700,
  includeTwoSubjects: true,
  perStudentAmount: 1000,
  staffSharePercentage: 70,
};

/**
 * Builds API payload from form state
 */
export function buildSettlementPayload(state: SettlementFormState): {
  compensationRule: string;
  staffSharePercentage: number;
  settlementConfig: StaffSettlementConfig;
} {
  if (state.mode === 'STUDENT_TIER_BASED') {
    const safeAllVal = Math.max(0, Number(state.allSubjectsValue) || 0);
    const safeSingleVal = Math.max(0, Number(state.singleSubjectValue) || 0);
    const safeTwoVal = Math.max(0, Number(state.twoSubjectsValue) || 0);

    const allDesc = `₹${safeAllVal.toLocaleString('en-IN')}`;
    const singleDesc = `₹${safeSingleVal.toLocaleString('en-IN')}`;
    const twoDesc = `₹${safeTwoVal.toLocaleString('en-IN')}`;

    const config: StaffSettlementConfig = {
      mode: 'STUDENT_TIER_BASED',
      allSubjects: {
        type: 'FIXED_AMOUNT',
        value: safeAllVal,
      },
      singleSubject: {
        type: 'FIXED_AMOUNT',
        value: safeSingleVal,
      },
      twoSubjects: {
        type: 'FIXED_AMOUNT',
        value: safeTwoVal,
      },
      label: `All: ${allDesc} | 2-Sub: ${twoDesc} | 1-Sub: ${singleDesc}`,
    };

    return {
      compensationRule: JSON.stringify(config),
      staffSharePercentage: 70,
      settlementConfig: config,
    };
  }

  if (state.mode === 'PER_STUDENT_FIXED') {
    const amt = Math.max(0, Number(state.perStudentAmount) || 0);
    const config: StaffSettlementConfig = {
      mode: 'PER_STUDENT_FIXED',
      perStudentAmount: amt,
      label: `₹${amt.toLocaleString('en-IN')}/Student`,
    };
    return {
      compensationRule: JSON.stringify(config),
      staffSharePercentage: 70,
      settlementConfig: config,
    };
  }

  // REVENUE_SHARE_PERCENTAGE
  const share = Math.min(100, Math.max(0, Number(state.staffSharePercentage) || 70));
  const config: StaffSettlementConfig = {
    mode: 'REVENUE_SHARE_PERCENTAGE',
    staffSharePercentage: share,
    label: `${share}% Revenue Share`,
  };
  return {
    compensationRule: JSON.stringify(config),
    staffSharePercentage: share,
    settlementConfig: config,
  };
}

/**
 * Initializes form state from existing assignment rule string
 */
export function parseSettlementToForm(
  rawRule?: string | null,
  fallbackShare: number = 70,
): SettlementFormState {
  if (!rawRule) {
    return {
      ...defaultSettlementState,
      staffSharePercentage: fallbackShare,
    };
  }

  if (rawRule.trim().startsWith('{')) {
    try {
      const parsed: StaffSettlementConfig = JSON.parse(rawRule);
      if (parsed.mode === 'STUDENT_TIER_BASED') {
        const allVal = Number(parsed.allSubjects?.value ?? 1000);
        const twoVal = Number(parsed.twoSubjects?.value ?? 700);
        const singleVal = Number(parsed.singleSubject?.value ?? 500);

        return {
          mode: 'STUDENT_TIER_BASED',
          allSubjectsType: 'FIXED_AMOUNT',
          allSubjectsValue: allVal,
          singleSubjectType: 'FIXED_AMOUNT',
          singleSubjectValue: singleVal,
          twoSubjectsType: 'FIXED_AMOUNT',
          twoSubjectsValue: twoVal,
          includeTwoSubjects: true,
          perStudentAmount: allVal,
          staffSharePercentage: fallbackShare,
        };
      }

      if (parsed.mode === 'PER_STUDENT_FIXED') {
        const base = Number(parsed.perStudentAmount ?? 1000);
        return {
          ...defaultSettlementState,
          mode: 'STUDENT_TIER_BASED',
          allSubjectsType: 'FIXED_AMOUNT',
          allSubjectsValue: base,
          twoSubjectsType: 'FIXED_AMOUNT',
          twoSubjectsValue: Math.round(base * 0.7),
          singleSubjectType: 'FIXED_AMOUNT',
          singleSubjectValue: Math.round(base * 0.5),
          includeTwoSubjects: true,
          perStudentAmount: base,
        };
      }

      if (parsed.mode === 'REVENUE_SHARE_PERCENTAGE') {
        return {
          ...defaultSettlementState,
          mode: 'REVENUE_SHARE_PERCENTAGE',
          staffSharePercentage: parsed.staffSharePercentage ?? fallbackShare,
        };
      }
    } catch {
      // ignore JSON parse error
    }
  }

  if (rawRule === 'FULL_POOL_100') {
    return {
      ...defaultSettlementState,
      mode: 'REVENUE_SHARE_PERCENTAGE',
      staffSharePercentage: 100,
    };
  }

  return {
    ...defaultSettlementState,
    mode: 'STUDENT_TIER_BASED',
    staffSharePercentage: fallbackShare,
  };
}

export interface SettlementBadgeDisplay {
  text: string;
  badgeClass: string;
  tooltip: string;
  mode: SettlementRuleMode | 'LEGACY';
}

/**
 * Determines badge label and styling for an assignment card
 */
export function getSettlementBadgeDisplay(as: {
  compensationRule?: string | null;
  staffSharePercentage?: number;
  settlementRuleBadge?: string;
  settlementRuleSummary?: string;
  settlementRuleMode?: string;
}): SettlementBadgeDisplay {
  if (as.settlementRuleBadge) {
    const mode = (as.settlementRuleMode || 'REVENUE_SHARE_PERCENTAGE') as SettlementRuleMode;
    return {
      text: as.settlementRuleBadge,
      badgeClass:
        mode === 'STUDENT_TIER_BASED'
          ? 'bg-purple-50 text-purple-700 border-purple-200'
          : mode === 'PER_STUDENT_FIXED'
          ? 'bg-teal-50 text-teal-700 border-teal-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      tooltip: as.settlementRuleSummary || as.settlementRuleBadge,
      mode,
    };
  }

  const rawRule = as.compensationRule || '';
  if (rawRule.trim().startsWith('{')) {
    try {
      const parsed: StaffSettlementConfig = JSON.parse(rawRule);
      if (parsed.mode === 'STUDENT_TIER_BASED') {
        const allVal = Number(parsed.allSubjects?.value ?? 0);
        const twoVal = Number(parsed.twoSubjects?.value ?? 0);
        const singleVal = Number(parsed.singleSubject?.value ?? 0);
        return {
          text: `All ₹${allVal} • 2-Sub ₹${twoVal} • 1-Sub ₹${singleVal}`,
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          tooltip: `Fixed Per-Tier: All-Sub ₹${allVal} | 2-Sub ₹${twoVal} | 1-Sub ₹${singleVal}`,
          mode: 'STUDENT_TIER_BASED',
        };
      }

      if (parsed.mode === 'PER_STUDENT_FIXED') {
        const amt = (parsed.perStudentAmount || 0).toLocaleString('en-IN');
        return {
          text: `₹${amt}/Student`,
          badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
          tooltip: `Fixed ₹${amt} per enrolled student payment`,
          mode: 'PER_STUDENT_FIXED',
        };
      }

      if (parsed.mode === 'REVENUE_SHARE_PERCENTAGE') {
        const share = parsed.staffSharePercentage ?? as.staffSharePercentage ?? 70;
        return {
          text: `${share}% Pool`,
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          tooltip: `${share}% of collected fee revenue`,
          mode: 'REVENUE_SHARE_PERCENTAGE',
        };
      }
    } catch {
      // Fall through
    }
  }

  const share = as.staffSharePercentage || 70;
  return {
    text: `${share}% Pool`,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    tooltip: `${share}% pool share standard`,
    mode: 'REVENUE_SHARE_PERCENTAGE',
  };
}
