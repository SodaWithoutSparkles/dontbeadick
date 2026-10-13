/**
 * Budget plan: a sequential path from an over-budget spec down to the `letRatio`
 * target. Each step is the largest current saving, re-priced after it is applied,
 * so the plan is a real route rather than a bag of independent ideas.
 */

import { RATES } from './constants/rates';
import { roundTo } from './format';
import { normalizeInput } from './normalize';
import { bestPrice } from './pricing';
import { candidateChanges } from './trades';
import type { BudgetPlan, Trade, TribunalInput } from './types';

/** Hard stop so a pathological input cannot spin the planner. */
const MAX_ACTIONS = 40;

export function buildBudgetPlan(input: TribunalInput, budgetPerMonth: number, initialFair: number): BudgetPlan {
  const actions: Trade[] = [];
  let current = normalizeInput(input);
  let currentFair = initialFair;
  const targetRatio = RATES.letRatio;

  for (let step = 0; step < MAX_ACTIONS && budgetPerMonth / currentFair < targetRatio; step += 1) {
    const candidates = candidateChanges(current)
      .map((candidate) => ({ candidate, fair: bestPrice(candidate.input).fair }))
      .map((item) => ({ ...item, saves: roundTo(currentFair - item.fair, 0.01) }))
      .filter((item) => Number.isFinite(item.saves) && item.saves >= RATES.minTradeSavingUsd)
      .sort((a, b) => b.saves - a.saves || a.candidate.trade.id.localeCompare(b.candidate.trade.id));
    const best = candidates[0];
    if (!best) break;
    actions.push({ ...best.candidate.trade, saves: best.saves });
    current = best.candidate.input;
    currentFair = best.fair;
  }

  return {
    targetRatio,
    projectedFair: currentFair,
    reachesTarget: currentFair > 0 && budgetPerMonth / currentFair >= targetRatio,
    actions,
  };
}
