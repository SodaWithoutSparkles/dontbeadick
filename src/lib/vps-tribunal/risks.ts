/**
 * Hard conflicts and soft caveats.
 *
 * `impossibleReasons` are contradictions the model refuses to price: no sensible
 * offer satisfies them. `compatibilityRisks` are things to verify before buying.
 */

import { PORT_SPEEDS } from './constants/port-speeds';
import { RATES } from './constants/rates';
import { money } from './format';
import type { LocationId, TribunalInput } from './types';

/** Locations whose multipliers come from a small sample of APAC offers. */
const APAC_LOW_SAMPLE_LOCATIONS: LocationId[] = ['hong_kong', 'tokyo', 'osaka', 'singapore', 'seoul'];

/** Ports at or above this speed are shared, so they get a budget sanity check. */
const HIGH_PORT_MBPS = 25_000;

/** Ports at or above this speed are almost always advertised, not dedicated. */
const SHARED_PORT_MBPS = 10_000;

/** Traffic beyond this is outside the model's reliable calibration range. */
const CALIBRATION_LIMIT_TB = 100;

/** Contradictions that make the requested configuration unbuildable as asked. */
export function impossibleReasons(input: TribunalInput, budgetPerMonth: number): string[] {
  const reasons: string[] = [];

  if (input.ramGeneration === 'ddr5' && (input.cpuClass === 'legacy' || input.cpuClass === 'older_server')) {
    reasons.push('DDR5 is incompatible with the selected legacy / first-generation server CPU tier. Choose a newer CPU tier or DDR3/DDR4 memory.');
  }
  if (input.ramGeneration === 'ddr3' && ['modern_server', 'latest'].includes(input.cpuClass)) {
    reasons.push('DDR3 is incompatible with the selected modern / high-clock CPU tier as defined by this model. Check the exact CPU family or select DDR4/DDR5.');
  }
  if (input.nvmeGb + input.ssdGb + input.hddGb === 0) {
    reasons.push('No storage is specified. A usable VPS needs boot storage, even if the provider bundles it rather than listing it separately.');
  }
  if (PORT_SPEEDS[input.portSpeed].mbps >= HIGH_PORT_MBPS && budgetPerMonth < RATES.highPortMinimumMonthlyBudget) {
    reasons.push(`A ${PORT_SPEEDS[input.portSpeed].label} port with a budget below ${money(RATES.highPortMinimumMonthlyBudget)}/month is an incompatible expectation in this heuristic. Shared-port one-off promos are possible, but should not be assumed.`);
  }

  return reasons;
}

export function compatibilityRisks(input: TribunalInput, effectiveEgressTb: number | null): string[] {
  const risks: string[] = [
    'CPU tier is based on the advertised host CPU family, not a performance guarantee. CPU sharing, fair-use caps and the exact model can matter more than the tier.',
  ];
  if (input.cpuClass === 'high_clock' && input.ramGeneration === 'ddr3') {
    risks.push('DDR3 is unusual for the high-clock CPU tier, but that tier spans several desktop/server families. Check the exact CPU model before treating this as impossible.');
  }
  if (input.cpuClass === 'latest' && input.ramGeneration === 'ddr4') {
    risks.push('The newest CPU tier combines several platform families; many Ryzen 7000/9000 platforms require DDR5, while some Intel systems differ. Check the exact CPU model.');
  }
  if (!input.publicIpv4) {
    risks.push('No public IPv4 is included. Add one if you need direct inbound IPv4; IPv6-only, NAT and tunnels involve different trade-offs.');
  }
  if (input.transferMode === 'unmetered') {
    risks.push('“Unmetered” is not a promise of unlimited sustained throughput. Check acceptable-use terms, fair-use thresholds and how heavily the port is shared.');
  } else if (effectiveEgressTb !== null && effectiveEgressTb > CALIBRATION_LIMIT_TB) {
    risks.push('The effective outbound allowance is above 100 TB/month, outside the model’s reliable calibration range. Dedicated bandwidth, overage terms and fair-use limits can dominate.');
  }
  if (PORT_SPEEDS[input.portSpeed].mbps >= SHARED_PORT_MBPS) {
    risks.push(`${PORT_SPEEDS[input.portSpeed].label} is usually an advertised/shared link rate, not guaranteed sustained throughput for the VPS. Check traffic limits and fair-use terms.`);
  }
  if (input.locations.length > 1) {
    risks.push('Multiple locations are treated as acceptable alternatives; the estimate uses the cheapest selected city and shows the range. It does not price a multi-location deployment.');
  }
  if (input.locations.some((id) => APAC_LOW_SAMPLE_LOCATIONS.includes(id))) {
    risks.push('APAC location multipliers are rough priors based on a small sample of low-end offers, not a current catalogue. Promotions can reverse the ranking.');
  }
  return risks;
}
