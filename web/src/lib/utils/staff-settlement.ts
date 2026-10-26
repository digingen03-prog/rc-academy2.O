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
  allSubjectsType: 'PERCENTAGE',
  allSubjectsValue: 25,
  singleSubjectType: 'PERCENTAGE',
  singleSubjectValue: 70,
  twoSubjectsType: 'PERCENTAGE',
  twoSubjectsValue: 35,
  includeTwoSubjects: false,
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
    const allDesc =
      state.allSubjectsType === 'PERCENTAGE'
        ? `${state.allSubjectsValue}%`
        : `₹${state.allSubjectsValue.toLocaleString('en-IN')}`;
    const singleDesc =
      state.singleSubjectType === 'PERCENTAGE'
        ? `${state.singleSubjectValue}%`
        : `₹${state.singleSubjectValue.toLocaleString('en-IN')}`;

    const config: StaffSettlementConfig = {
      mode: 'STUDENT_TIER_BASED',
      allSubjects: {
        type: state.allSubjectsType,
        value: Number(state.allSubjectsValue) || 0,
      },
      singleSubject: {
        type: state.singleSubjectType,
        value: Number(state.singleSubjectValue) || 0,
      },
      ...(state.includeTwoSubjects && {
        twoSubjects: {
          type: state.twoSubjectsType,
          value: Number(state.twoSubjectsValue) || 0,
        },
      }),
      label: `All-Sub ${allDesc} | Single ${singleDesc}`,
    };

    const effectiveShare =
      state.singleSubjectType === 'PERCENTAGE'
        ? Number(state.singleSubjectValue) || 70
        : 70;

    return {
      compensationRule: JSON.stringify(config),
      staffSharePercentage: effectiveShare,
      settlementConfig: config,
    };
  }

  if (state.mode === 'PER_STUDENT_FIXED') {
    const amt = Number(state.perStudentAmount) || 0;
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
  const share = Number(state.staffSharePercentage) || 70;
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
        return {
          mode: 'STUDENT_TIER_BASED',
          allSubjectsType: parsed.allSubjects?.type || 'PERCENTAGE',
          allSubjectsValue: parsed.allSubjects?.value ?? 25,
          singleSubjectType: parsed.singleSubject?.type || 'PERCENTAGE',
          singleSubjectValue: parsed.singleSubject?.value ?? 70,
          twoSubjectsType: parsed.twoSubjects?.type || 'PERCENTAGE',
          twoSubjectsValue: parsed.twoSubjects?.value ?? 35,
          includeTwoSubjects: Boolean(parsed.twoSubjects),
          perStudentAmount: 1000,
          staffSharePercentage: fallbackShare,
        };
      }

      if (parsed.mode === 'PER_STUDENT_FIXED') {
        return {
          ...defaultSettlementState,
          mode: 'PER_STUDENT_FIXED',
          perStudentAmount: parsed.perStudentAmount ?? 1000,
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
    mode: 'REVENUE_SHARE_PERCENTAGE',
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
          text: `Tiered: All ${allDesc} • Single ${singleDesc}`,
          badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
          tooltip: `All-Subject Students: ${allDesc} | Single-Subject: ${singleDesc}`,
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
