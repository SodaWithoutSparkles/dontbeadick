/**
 * VPS Budget Tribunal rate card.
 *
 * Deterministic heuristic; deliberately not a live-price index or a claim of
 * actuarial precision. It estimates a plausible normal monthly price for a
 * requested low-end VPS configuration, then gives the budget a tongue-in-cheek
 * verdict. The UI should expose the breakdown and describe the assumptions.
 *
 * Calibration anchors (public LET offer/request discussions, not audited sales):
 * - Sep 2025: 1 vCPU, 1 GB RAM, 15 GB NVMe, 1 TB @ 10 Gbps, IPv4, Singapore,
 *   advertised at $3/month; another Ryzen 9000/1 GB/15 GB NVMe offer was $3/month.
 * - Sep 2025: 4 vCPU, 6 GB RAM, 100 GB SSD, 10 Gbps shared, 25 TB outbound,
 *   Singapore, advertised at $40/year.
 * - Jun 2025: 2 EPYC Milan vCPU, 4 GB RAM, 30 GB NVMe, 1 Gbps, 1 TB, near
 *   Singapore, advertised at $5.10/month with a promotion.
 * - May 2026: 4 EPYC Milan vCPU, 8 GB DDR4, 50 GB NVMe, shared 10 Gbps and
 *   unmetered traffic in the Netherlands, advertised at €10.69/month.
 *
 * These examples are intentionally treated as promo/low-end anchors. The model
 * does not assume that every offer is equivalent in CPU time, support, routing,
 * uptime, or fair-use policy.
 *
 * Per-component rates live in the sibling catalogues: `cpu-classes.ts`
 * (`usdPerVcpu`), `memory-generations.ts` (`usdPerGb`), `locations.ts`
 * (`multiplier`) and `port-speeds.ts` (`usdPerMonth`, `unmeteredPremium`).
 * This file holds the flat rates, the traffic schedule and the verdict bands.
 */

import type { StorageType, TrafficTier } from '../types';

export const RATES = {
  /** Minimum monthly platform / virtualization / administration contribution. */
  platformBase: 0.75,
  storageGb: {
    nvme: 0.012,
    ssd: 0.007,
    hdd: 0.0013,
  } satisfies Record<StorageType, number>,
  publicIpv4: 0.65,
  /** A regular baseline assumes up to this much effective outbound traffic. */
  includedEgressTb: 2,
  /** Flat-ish tier schedule: low-end hosts often bundle bandwidth rather than bill linearly per TB. */
  trafficTiers: [
    { upToEffectiveEgressTb: 2, monthlyFee: 0 },
    { upToEffectiveEgressTb: 5, monthlyFee: 0.10 },
    { upToEffectiveEgressTb: 10, monthlyFee: 0.25 },
    { upToEffectiveEgressTb: 20, monthlyFee: 0.45 },
    { upToEffectiveEgressTb: 30, monthlyFee: 0.60 },
    { upToEffectiveEgressTb: 50, monthlyFee: 0.90 },
    { upToEffectiveEgressTb: 100, monthlyFee: 1.25 },
  ] satisfies readonly TrafficTier[],
  /** Only applies beyond the 100-TB tier; estimates become much less certain here. */
  above100TbFeePerTb: 0.015,
  /** Typical, not guaranteed, discount for annual prepayment. */
  annualFactor: 0.83,
  /** Budget ratio thresholds. These are editorial choices, not statistical confidence bounds. */
  unicornRatio: 0.30,
  letRatio: 0.85,
  roomyRatio: 1.35,
  /** Rough price multiplier for unrestricted location choice. */
  anywhereMultiplier: 0.90,
  /** Editorial hard-conflict threshold for a 25G+ advertised port. */
  highPortMinimumMonthlyBudget: 1,
  /** Below this saving a trade is noise rather than a useful suggestion. */
  minTradeSavingUsd: 0.05,
  /** Advisory hints (the annual nudge) need to be worth reading. */
  minLeverSavingUsd: 0.25,
} as const;
