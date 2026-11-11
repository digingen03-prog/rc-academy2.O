import { Decimal } from '@prisma/client/runtime/library';
import {
  calculateStaffSettlement,
  ValidationError,
  CompensationRule,
} from './staff-settlement.helper';

describe('StaffSettlementHelper Unit Tests', () => {
  const sureshCompensationRule: CompensationRule = {
    mode: 'STUDENT_TIER_BASED',
    config: {
      allSubjects: { type: 'FIXED_AMOUNT', value: 1166 },
      twoSubjects: { type: 'FIXED_AMOUNT', value: 1260 },
      singleSubject: { type: 'FIXED_AMOUNT', value: 1260 },
    },
  };

  // T1. 10 ALL + 5 TWO + 8 SINGLE, config 1166/1260/1260 -> 28,040 exactly.
  it('T1: calculates 10 ALL + 5 TWO + 8 SINGLE as 28,040 exactly', () => {
    let totalEntitlement = new Decimal(0);

    // 10 ALL
    for (let i = 0; i < 10; i++) {
      const res = calculateStaffSettlement({
        compensationRule: sureshCompensationRule,
        studentTier: 'ALL',
        collectedAmount: new Decimal(5000),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
      expect(res.staffPoolAmount.toNumber()).toBe(1166);
    }

    // 5 TWO
    for (let i = 0; i < 5; i++) {
      const res = calculateStaffSettlement({
        compensationRule: sureshCompensationRule,
        studentTier: 'TWO_SUBJECTS',
        collectedAmount: new Decimal(3600),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
      expect(res.staffPoolAmount.toNumber()).toBe(1260);
    }

    // 8 SINGLE
    for (let i = 0; i < 8; i++) {
      const res = calculateStaffSettlement({
        compensationRule: sureshCompensationRule,
        studentTier: 'SINGLE',
        collectedAmount: new Decimal(1800),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
      expect(res.staffPoolAmount.toNumber()).toBe(1260);
    }

    // (10 * 1166) + (5 * 1260) + (8 * 1260) = 11,660 + 6,300 + 10,080 = 28,040
    expect(totalEntitlement.toNumber()).toBe(28040);
  });

  // T2. collectedAmount = 0 -> staffPoolAmount still = 1166 (no cap).
  it('T2: entitlement is not capped at collectedAmount when collectedAmount = 0', () => {
    const res = calculateStaffSettlement({
      compensationRule: sureshCompensationRule,
      studentTier: 'ALL',
      collectedAmount: new Decimal(0),
    });

    expect(res.staffPoolAmount.toNumber()).toBe(1166);
    expect(res.academyShareAmount.toNumber()).toBe(0);
    expect(res.realizedAmount.toNumber()).toBe(0);
  });

  // T3. Missing singleSubject config -> throws MISSING_TIER_CONFIG:SINGLE.
  it('T3: throws MISSING_TIER_CONFIG:SINGLE if singleSubject tier config is omitted', () => {
    const incompleteRule = {
      mode: 'STUDENT_TIER_BASED',
      config: {
        allSubjects: { type: 'FIXED_AMOUNT', value: 1166 },
        twoSubjects: { type: 'FIXED_AMOUNT', value: 1260 },
      },
    };

    expect(() => {
      calculateStaffSettlement({
        compensationRule: incompleteRule,
        studentTier: 'SINGLE',
        collectedAmount: new Decimal(1800),
      });
    }).toThrow(ValidationError);

    expect(() => {
      calculateStaffSettlement({
        compensationRule: incompleteRule,
        studentTier: 'SINGLE',
        collectedAmount: new Decimal(1800),
      });
    }).toThrow('MISSING_TIER_CONFIG:SINGLE');
  });

  // T4. CUSTOM tier without customFallbackTier -> throws.
  it('T4: throws error when studentTier is CUSTOM without customFallbackTier', () => {
    expect(() => {
      calculateStaffSettlement({
        compensationRule: sureshCompensationRule,
        studentTier: 'CUSTOM',
        collectedAmount: new Decimal(2000),
      });
    }).toThrow(ValidationError);

    expect(() => {
      calculateStaffSettlement({
        compensationRule: sureshCompensationRule,
        studentTier: 'CUSTOM',
        collectedAmount: new Decimal(2000),
      });
    }).toThrow('CUSTOM_TIER_NOT_SUPPORTED_WITHOUT_FALLBACK');

    // With explicit customFallbackTier
    const ruleWithFallback = {
      mode: 'STUDENT_TIER_BASED',
      config: {
        ...sureshCompensationRule.config,
        customFallbackTier: 'SINGLE' as const,
      },
    };

    const res = calculateStaffSettlement({
      compensationRule: ruleWithFallback,
      studentTier: 'CUSTOM',
      collectedAmount: new Decimal(2000),
    });
    expect(res.staffPoolAmount.toNumber()).toBe(1260);
    expect(res.tierUsed).toBe('SINGLE');
  });

  // T5. Decimal precision: value 1166.335 rounds to 1166.34 (HALF_UP).
  it('T5: rounds 1166.335 to 1166.34 using HALF_UP precision', () => {
    const fractionalRule = {
      mode: 'STUDENT_TIER_BASED',
      config: {
        allSubjects: { type: 'FIXED_AMOUNT', value: 1166.335 },
      },
    };

    const res = calculateStaffSettlement({
      compensationRule: fractionalRule,
      studentTier: 'ALL',
      collectedAmount: new Decimal(5000),
    });

    expect(res.staffPoolAmount.toString()).toBe('1166.34');
  });

  // T6 (AT-1): One eligible student creates one subject-specific entitlement of ₹500
  it('T6 (AT-1): 1 eligible student with PER_STUDENT_FIXED creates exact entitlement of ₹500', () => {
    const fixedRule = {
      mode: 'PER_STUDENT_FIXED' as const,
      config: {
        perStudentAmount: 500,
        subjectId: 'sub-physics-101',
      },
    };

    const res = calculateStaffSettlement({
      compensationRule: fixedRule,
      studentTier: 'SINGLE',
      collectedAmount: new Decimal(0),
      studentFee: new Decimal(2000),
    });

    expect(res.staffPoolAmount.toNumber()).toBe(500);
    expect(res.realizedAmount.toNumber()).toBe(0);
    expect(res.ruleApplied).toBe('PER_STUDENT_FIXED_500');
  });

  // T7 (AT-2): 10 eligible students at ₹500 create ₹5,000 entitlement
  it('T7 (AT-2): 10 eligible students at ₹500 create ₹5,000 total entitlement', () => {
    const fixedRule = {
      mode: 'PER_STUDENT_FIXED' as const,
      config: {
        perStudentAmount: 500,
        subjectId: 'sub-physics-101',
      },
    };

    let totalEntitlement = new Decimal(0);
    for (let i = 0; i < 10; i++) {
      const res = calculateStaffSettlement({
        compensationRule: fixedRule,
        studentTier: 'ALL',
        collectedAmount: new Decimal(0),
        studentFee: new Decimal(2000),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
    }

    expect(totalEntitlement.toNumber()).toBe(5000);
  });

  // T8 (AT-3): Partial fee payment produces proportional realization
  it('T8 (AT-3): partial fee payment of ₹1,000 on ₹2,000 fee produces proportional realization of ₹250', () => {
    const fixedRule = {
      mode: 'PER_STUDENT_FIXED' as const,
      config: {
        perStudentAmount: 500,
        subjectId: 'sub-physics-101',
      },
    };

    const res = calculateStaffSettlement({
      compensationRule: fixedRule,
      studentTier: 'SINGLE',
      collectedAmount: new Decimal(1000), // 50% paid
      studentFee: new Decimal(2000),
    });

    expect(res.staffPoolAmount.toNumber()).toBe(500); // Entitlement intact
    expect(res.realizedAmount.toNumber()).toBe(250); // 50% of 500
  });

  // T9 (AT-4): Exact penny-reconciliation for bundle package allocations
  it('T9: allocatePackageFeeToSubjects deterministically reconciles to netPackageFee with zero rounding drift', () => {
    const { allocatePackageFeeToSubjects } = require('./staff-settlement.helper');

    // ₹5,000 package split across 3 equal catalog subjects of ₹1,800 each
    const result = allocatePackageFeeToSubjects({
      netPackageFee: 5000,
      subjects: [
        { subjectId: 'sub-phy', catalogFee: 1800 },
        { subjectId: 'sub-chem', catalogFee: 1800 },
        { subjectId: 'sub-math', catalogFee: 1800 },
      ],
    });

    expect(result.allocations.length).toBe(3);
    const sum = result.allocations.reduce(
      (acc: any, cur: any) => acc.add(cur.allocatedFee),
      new Decimal(0),
    );

    expect(sum.toNumber()).toBe(5000);
    expect(result.allocations[0].allocatedFee.toNumber()).toBe(1666.67);
    expect(result.allocations[1].allocatedFee.toNumber()).toBe(1666.67);
    expect(result.allocations[2].allocatedFee.toNumber()).toBe(1666.66); // Remainder absorbs 1 cent
  });

  // T10 (AT-TierMirroring): Class 12 Fee Rules mirroring with 1000/700/500 rates
  it('T10 (AT-TierMirroring): Class 12 Fee Rules mirroring yields ₹17,500 for (10 ALL + 5 TWO + 8 SINGLE)', () => {
    const class12FeeRule: CompensationRule = {
      mode: 'STUDENT_TIER_BASED',
      config: {
        allSubjects: { type: 'FIXED_AMOUNT', value: 1000 },
        twoSubjects: { type: 'FIXED_AMOUNT', value: 700 },
        singleSubject: { type: 'FIXED_AMOUNT', value: 500 },
      },
    };

    let totalEntitlement = new Decimal(0);

    // 10 ALL-Subject students @ ₹1,000
    for (let i = 0; i < 10; i++) {
      const res = calculateStaffSettlement({
        compensationRule: class12FeeRule,
        studentTier: 'ALL',
        studentFee: new Decimal(5000),
        collectedAmount: new Decimal(5000),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
      expect(res.staffPoolAmount.toNumber()).toBe(1000);
      expect(res.academyShareAmount.toNumber()).toBe(4000);
    }

    // 5 TWO-Subject students @ ₹700
    for (let i = 0; i < 5; i++) {
      const res = calculateStaffSettlement({
        compensationRule: class12FeeRule,
        studentTier: 'TWO_SUBJECTS',
        studentFee: new Decimal(3500),
        collectedAmount: new Decimal(3500),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
      expect(res.staffPoolAmount.toNumber()).toBe(700);
      expect(res.academyShareAmount.toNumber()).toBe(2800);
    }

    // 8 SINGLE-Subject students @ ₹500
    for (let i = 0; i < 8; i++) {
      const res = calculateStaffSettlement({
        compensationRule: class12FeeRule,
        studentTier: 'SINGLE',
        studentFee: new Decimal(1800),
        collectedAmount: new Decimal(1800),
      });
      totalEntitlement = totalEntitlement.add(res.staffPoolAmount);
      expect(res.staffPoolAmount.toNumber()).toBe(500);
      expect(res.academyShareAmount.toNumber()).toBe(1300);
    }

    // (10 * 1000) + (5 * 700) + (8 * 500) = 10,000 + 3,500 + 4,000 = 17,500
    expect(totalEntitlement.toNumber()).toBe(17500);
  });

  // T11 (AT-TierAcademyMargin): Verifies academy retained margin per tier
  it('T11 (AT-TierAcademyMargin): Verifies academy retained margins on mirrored fee rules', () => {
    const class12FeeRule: CompensationRule = {
      mode: 'STUDENT_TIER_BASED',
      config: {
        allSubjects: { type: 'FIXED_AMOUNT', value: 1000 },
        twoSubjects: { type: 'FIXED_AMOUNT', value: 700 },
        singleSubject: { type: 'FIXED_AMOUNT', value: 500 },
      },
    };

    const allRes = calculateStaffSettlement({
      compensationRule: class12FeeRule,
      studentTier: 'ALL',
      studentFee: new Decimal(5000),
      collectedAmount: new Decimal(5000),
    });
    expect(allRes.academyShareAmount.toNumber()).toBe(4000); // 80% margin

    const twoRes = calculateStaffSettlement({
      compensationRule: class12FeeRule,
      studentTier: 'TWO_SUBJECTS',
      studentFee: new Decimal(3500),
      collectedAmount: new Decimal(3500),
    });
    expect(twoRes.academyShareAmount.toNumber()).toBe(2800); // 80% margin

    const singleRes = calculateStaffSettlement({
      compensationRule: class12FeeRule,
      studentTier: 'SINGLE',
      studentFee: new Decimal(1800),
      collectedAmount: new Decimal(1800),
    });
    expect(singleRes.academyShareAmount.toNumber()).toBe(1300); // ~72.2% margin
  });
});

