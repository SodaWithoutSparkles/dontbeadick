/**
 * Presentation: verdict copy, the paste-ready forum summary, and share URLs.
 *
 * Kept out of the pricing model on purpose — the model decides numbers, this
 * decides how they read. The site origin lives here so nothing in the model
 * depends on the deployment.
 */

import { CPU_CLASSES } from './constants/cpu-classes';
import { LOCATIONS } from './constants/locations';
import { MEMORY_GENERATIONS } from './constants/memory-generations';
import { PORT_SPEEDS } from './constants/port-speeds';
import { money } from './format';
import { normalizeInput } from './normalize';
import { fromQuery, toQuery } from './query';
import type { TribunalInput, Trade, Verdict, VerdictCopy, VerdictId } from './types';

/** Public origin baked into shared links. */
export const SITE_ORIGIN = 'https://dontbeadick.lol';

/** Route that reads and writes the tribunal query string. */
const SHARE_PATH = '/vps-budget';

export function verdictCopy(verdict: Verdict): VerdictCopy {
  const { budget, fair, floor, ratio } = verdict;
  const percent = Math.round(ratio * 100);

  const copy: Record<VerdictId, VerdictCopy> = {
    impossible: {
      title: 'That spec does not add up',
      summary: 'At least one requirement conflicts with the selected platform or budget.',
      body: [
        ...verdict.impossibleReasons,
        'Fix the compatibility issue first; a price comparison cannot make incompatible hardware or an unusable configuration work.',
      ],
    },
    unicorn: {
      title: 'The unicorn hunt',
      summary: 'The budget is below even the model’s aggressive-deal estimate.',
      body: [
        `Your budget is ${money(budget)}/month equivalent against a rough normal price of ${money(fair)}/month. The model’s aggressive-deal floor is about ${money(floor)}/month.`,
        'This is not proof that no such offer exists. It means you probably need a promotion, an unusual provider, or at least one meaningful compromise.',
        'Check whether CPU generation, storage, traffic allowance and location are all genuinely mandatory.',
      ],
    },
    let: {
      title: 'LowEndTalk territory',
      summary: 'Plausible if you hunt promotions and read the fine print.',
      body: [
        `Your budget is about ${percent}% of the model’s ${money(fair)}/month estimate. That is below the normalized estimate, but believable territory for low-end offers and promotions.`,
        'Compare annual totals and renewal prices, and verify CPU fair-use policy, disk performance, traffic counting and provider history.',
        'The model prices advertised specifications. It does not know whether two offers deliver comparable real-world performance.',
      ],
    },
    reasonable: {
      title: 'Reasonable expectations',
      summary: 'Your budget roughly matches the modeled price.',
      body: [
        `Your budget of ${money(budget)}/month equivalent is in the same neighbourhood as the ${money(fair)}/month estimate.`,
        'Check renewal pricing, CPU limits, backup policy, bandwidth definitions and whether IPv4 is included.',
        'Treat this as a starting estimate, not a promise that a provider has this exact configuration in stock.',
      ],
    },
    roomy: {
      title: 'Room to breathe',
      summary: 'Your budget exceeds the model’s estimate; there may be room to improve quality or loosen the target.',
      body: [
        `Your budget is about ${percent}% of the ${money(fair)}/month estimate. You may be able to afford a better CPU tier, more memory, a stronger network allowance, or a provider with a better track record.`,
        'A higher budget does not automatically make an offer better. Compare benchmark evidence, fair-use limits, backups, support and renewal terms.',
      ],
    },
  };

  return copy[verdict.id];
}

export function buildShareUrl(rawInput: unknown): string {
  return `${SITE_ORIGIN}${SHARE_PATH}${toQuery(rawInput)}`;
}

/** Parse a shared URL into normalized input; useful for testing URL round-trips. */
export function parseShareQuery(search: string): TribunalInput {
  return fromQuery(search);
}

/** Plain text ready to paste into a forum, ending with a replayable link. */
export function buildShareText(rawInput: unknown, verdict: Verdict): string {
  const input = normalizeInput(rawInput);
  const copy = verdictCopy(verdict);
  const periodLabel = input.billing === 'annual' ? 'year' : 'month';
  const transferText = input.transferMode === 'unmetered'
    ? 'unmetered (check fair use)'
    : `${input.transferTb} TB/month (${input.transferMode === 'egress' ? 'outbound only' : 'in + out'})`;
  const locations = input.locations.length
    ? input.locations.map((id) => LOCATIONS[id].label).join(', ')
    : 'anywhere';
  const locationSummary = verdict.locationEstimates.length > 1
    ? `Selected-location estimate range: ${money(verdict.locationRange.min)}/mo to ${money(verdict.locationRange.max)}/mo.`
    : `Location estimate: ${verdict.locationEstimates[0].label}.`;
  const planText = verdict.budgetPlan.actions.length
    ? [
      `Changes to approach the ${Math.round(verdict.budgetPlan.targetRatio * 100)}% budget target:`,
      ...verdict.budgetPlan.actions.map((trade: Trade, index: number) => `${index + 1}. ${trade.label} (-${money(trade.saves)}/mo)`),
      ...(verdict.budgetPlan.reachesTarget ? [] : ['The model could not reach the target with the available trade-offs.']),
    ].join('\n')
    : 'No trade-off sequence needed to approach the budget target.';
  const conflictText = verdict.impossibleReasons.length
    ? `Compatibility issues:\n${verdict.impossibleReasons.map((reason) => `- ${reason}`).join('\n')}`
    : '';

  return [
    `VPS Budget Tribunal — ${copy.title}`,
    `Budget: ${money(input.budget)}/${periodLabel} (${money(verdict.budget)}/mo equivalent) | estimated fair price: ~${money(verdict.fair)}/mo equivalent (${money(verdict.fairForPeriod)}/${periodLabel}) | aggressive-deal floor: ~${money(verdict.floor)}/mo`,
    `CPU: ${input.vcpu} vCPU, ${CPU_CLASSES[input.cpuClass].label}`,
    `RAM: ${input.ramGb} GB ${MEMORY_GENERATIONS[input.ramGeneration].label}`,
    `Storage: ${input.nvmeGb} GB NVMe + ${input.ssdGb} GB SSD + ${input.hddGb} GB HDD`,
    `Network: ${PORT_SPEEDS[input.portSpeed].label}, ${transferText}, public IPv4: ${input.publicIpv4 ? 'yes' : 'no'}`,
    `Acceptable locations: ${locations}`,
    locationSummary,
    verdict.traffic.note ?? '',
    conflictText,
    planText,
    buildShareUrl(input),
  ].filter(Boolean).join('\n');
}
