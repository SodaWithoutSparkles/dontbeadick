/**
 * The tribunal itself: reject impossible specs, classify a budget against the
 * estimated fair price, and assemble every section the UI renders.
 */

import { RATES } from './constants/rates';
import { buildBudgetPlan } from './budget-plan';
import { normalizeInput } from './normalize';
import { bestPrice, monthlyBudget } from './pricing';
import { compatibilityRisks, impossibleReasons } from './risks';
import { assessTraffic } from './traffic';
import { annualLever, tradeList } from './trades';
import type { Trade, TribunalInput, Verdict, VerdictId } from './types';

/** Budget-to-price ratio bands, from the rate card. */
export function classifyVerdict(ratio: number): VerdictId {
  if (ratio < RATES.unicornRatio) return 'unicorn';
  if (ratio < RATES.letRatio) return 'let';
  if (ratio <= RATES.roomyRatio) return 'reasonable';
  return 'roomy';
}

export function judge(rawInput: unknown): Verdict {
  const input = normalizeInput(rawInput);
  const quote = bestPrice(input);
  const fair = quote.fair;
  const budget = monthlyBudget(input);
  const ratio = fair > 0 ? budget / fair : 0;
  const floor = fair * RATES.unicornRatio;
  const conflicts = impossibleReasons(input, budget);

  const id: VerdictId = conflicts.length > 0 ? 'impossible' : classifyVerdict(ratio);

  const traffic = assessTraffic(input, fair);
  const risks = compatibilityRisks(input, traffic.effectiveEgressTb);
  if (traffic.note) risks.push(traffic.note);
  if (input.billing === 'annual') {
    risks.push('Annual billing already includes the modelled annual-prepayment adjustment. Compare the full invoice and renewal price; do not apply another annual discount.');
  }

  const lever = annualLever(input, fair);
  const levers: Trade[] = lever ? [lever] : [];

  return {
    id,
    enteredBudget: input.budget,
    billing: input.billing,
    budget,
    ratio,
    fair,
    fairForPeriod: quote.breakdown.periodTotal,
    floor,
    breakdown: quote.breakdown,
    locationRange: { min: quote.min, max: quote.max },
    locationEstimates: quote.estimates,
    trades: tradeList(input, fair),
    levers,
    budgetPlan: buildBudgetPlan(input, budget, fair),
    impossibleReasons: conflicts,
    risks,
    traffic,
  };
}
