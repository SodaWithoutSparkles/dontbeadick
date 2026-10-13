/**
 * Traffic assessment: what the advertised allowance actually buys you.
 * Whole-plan price divided by quota — not a bandwidth margin, and it never
 * feeds the verdict bands.
 */

import { money } from './format';
import type { TrafficAssessment, TribunalInput } from './types';

/** Below this whole-plan $/TB the plan looks cheap enough to call out. */
const WORTH_NOTING_DOLLARS_PER_TB = 1;

export function assessTraffic(input: TribunalInput, fair: number): TrafficAssessment {
  const effectiveEgressTb = input.transferMode === 'unmetered'
    ? null
    : (input.transferMode === 'total' ? input.transferTb * 0.5 : input.transferTb);
  const estimatedPlanDollarsPerTb = effectiveEgressTb !== null && effectiveEgressTb > 0
    ? fair / effectiveEgressTb
    : null;

  return {
    effectiveEgressTb,
    estimatedPlanDollarsPerTb,
    ...(estimatedPlanDollarsPerTb !== null && estimatedPlanDollarsPerTb < WORTH_NOTING_DOLLARS_PER_TB
      ? {
        note: `If you consume the entire effective allowance, the estimated whole-plan cost is ${money(estimatedPlanDollarsPerTb)}/TB. This is price divided by quota, not the host's marginal bandwidth cost; providers often assume the quota will go unused.`,
      }
      : {}),
  };
}
