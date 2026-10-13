/**
 * Pricing: monthly USD estimate for one configuration, in one city or
 * location-agnostic. Figures are heuristic, not provider costs or live quotes.
 */

import { CPU_CLASSES } from './constants/cpu-classes';
import { isLocation, LOCATIONS } from './constants/locations';
import { MEMORY_GENERATIONS } from './constants/memory-generations';
import { PORT_SPEEDS } from './constants/port-speeds';
import { RATES } from './constants/rates';
import { normalizeInput } from './normalize';
import type { LocationEstimate, LocationId, PriceBreakdown, TribunalInput } from './types';

/**
 * Convert a traffic allowance into a gently tiered monthly estimate. Fees are
 * interpolated between tiers, so adjacent quotas never create a price cliff.
 */
export function trafficFee(effectiveEgressTb: number): number {
  if (effectiveEgressTb <= RATES.includedEgressTb) return 0;

  const tiers = RATES.trafficTiers;
  const lastTier = tiers[tiers.length - 1];
  if (effectiveEgressTb > lastTier.upToEffectiveEgressTb) {
    return lastTier.monthlyFee + (effectiveEgressTb - lastTier.upToEffectiveEgressTb) * RATES.above100TbFeePerTb;
  }

  let lower: { upToEffectiveEgressTb: number; monthlyFee: number } = tiers[0];
  for (const upper of tiers.slice(1)) {
    if (effectiveEgressTb <= upper.upToEffectiveEgressTb) {
      const span = upper.upToEffectiveEgressTb - lower.upToEffectiveEgressTb;
      const position = (effectiveEgressTb - lower.upToEffectiveEgressTb) / span;
      return lower.monthlyFee + (upper.monthlyFee - lower.monthlyFee) * position;
    }
    lower = upper;
  }
  return lastTier.monthlyFee;
}

/** The budget normalized to a monthly equivalent, so periods compare like for like. */
export function monthlyBudget(input: TribunalInput): number {
  const clean = normalizeInput(input);
  return clean.billing === 'annual' ? clean.budget / 12 : clean.budget;
}

/**
 * Estimate the configuration in one city. Pass null for no city restriction.
 * The figures are heuristic monthly USD, not provider costs or live quotes.
 */
export function priceFor(input: TribunalInput, location: LocationId | null = null): PriceBreakdown {
  const clean = normalizeInput(input);
  const safeLocation = location !== null && isLocation(location) ? location : null;
  const locationMultiplier = safeLocation ? LOCATIONS[safeLocation].multiplier : RATES.anywhereMultiplier;
  const billingFactor = clean.billing === 'annual' ? RATES.annualFactor : 1;

  const platform = RATES.platformBase;
  const cpu = clean.vcpu * CPU_CLASSES[clean.cpuClass].usdPerVcpu;
  const ram = clean.ramGb * MEMORY_GENERATIONS[clean.ramGeneration].usdPerGb;
  const nvme = clean.nvmeGb * RATES.storageGb.nvme;
  const ssd = clean.ssdGb * RATES.storageGb.ssd;
  const hdd = clean.hddGb * RATES.storageGb.hdd;
  const port = PORT_SPEEDS[clean.portSpeed].usdPerMonth;
  const ipv4 = clean.publicIpv4 ? RATES.publicIpv4 : 0;

  let transfer = 0;
  let unmetered = 0;
  if (clean.transferMode === 'unmetered') {
    unmetered = PORT_SPEEDS[clean.portSpeed].unmeteredPremium;
  } else {
    // A total (in + out) allowance is treated as approximately half as useful
    // as the same-sized egress-only allowance. This is a visible heuristic.
    const effectiveEgressTb = clean.transferMode === 'total' ? clean.transferTb * 0.5 : clean.transferTb;
    transfer = trafficFee(effectiveEgressTb);
  }

  const beforeLocation = platform + cpu + ram + nvme + ssd + hdd + port + transfer + unmetered + ipv4;
  const monthlyBaseTotal = beforeLocation * locationMultiplier;
  const total = monthlyBaseTotal * billingFactor;
  const scale = locationMultiplier * billingFactor;
  const months = clean.billing === 'annual' ? 12 : 1;

  return {
    location: safeLocation,
    platform: platform * scale,
    cpu: cpu * scale,
    ram: ram * scale,
    nvme: nvme * scale,
    ssd: ssd * scale,
    hdd: hdd * scale,
    port: port * scale,
    transfer: transfer * scale,
    unmetered: unmetered * scale,
    ipv4: ipv4 * scale,
    locationMultiplier,
    billingFactor,
    beforeLocation,
    monthlyBaseTotal,
    total,
    periodTotal: total * months,
  };
}

export interface BestPrice {
  fair: number;
  breakdown: PriceBreakdown;
  estimates: LocationEstimate[];
  min: number;
  max: number;
}

/**
 * Price the request across its acceptable locations. Selected locations are
 * alternatives, so the cheapest one wins and the spread becomes the range.
 * An empty list means location-agnostic pricing.
 */
export function bestPrice(input: TribunalInput): BestPrice {
  const clean = normalizeInput(input);
  if (clean.locations.length === 0) {
    const breakdown = priceFor(clean, null);
    return {
      fair: breakdown.total,
      breakdown,
      estimates: [{ id: 'anywhere', label: 'Anywhere', fair: breakdown.total }],
      min: breakdown.total,
      max: breakdown.total,
    };
  }

  const estimates: LocationEstimate[] = clean.locations.map((id) => {
    const quote = priceFor(clean, id);
    return { id, label: LOCATIONS[id].label, fair: quote.total };
  }).sort((a, b) => a.fair - b.fair || a.id.localeCompare(b.id));

  const cheapestLocation = estimates[0].id;
  if (cheapestLocation === 'anywhere') return {
    fair: estimates[0].fair,
    breakdown: priceFor(clean, null),
    estimates,
    min: estimates[0].fair,
    max: estimates[estimates.length - 1].fair,
  };

  const breakdown = priceFor(clean, cheapestLocation);
  return {
    fair: breakdown.total,
    breakdown,
    estimates,
    min: estimates[0].fair,
    max: estimates[estimates.length - 1].fair,
  };
}
