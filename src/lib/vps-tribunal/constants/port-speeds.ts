/**
 * Port speed catalogue.
 *
 * `usdPerMonth` is the extra monthly cost of access to the advertised peak
 * link rate; `unmeteredPremium` is the added estimate for a no-quota plan at
 * that speed. `order` defines the ladder used for port-down trades.
 */

import type { PortSpeedId, PortSpeedInfo } from '../types';

export const PORT_SPEEDS: Record<PortSpeedId, PortSpeedInfo> = {
  '100m': { label: '100 Mbps', mbps: 100, usdPerMonth: 0.00, unmeteredPremium: 0.15, order: 0 },
  '250m': { label: '250 Mbps', mbps: 250, usdPerMonth: 0.03, unmeteredPremium: 0.18, order: 1 },
  '500m': { label: '500 Mbps', mbps: 500, usdPerMonth: 0.08, unmeteredPremium: 0.25, order: 2 },
  '1g': { label: '1 Gbps', mbps: 1000, usdPerMonth: 0.12, unmeteredPremium: 0.40, order: 3 },
  '2_5g': { label: '2.5 Gbps', mbps: 2500, usdPerMonth: 0.20, unmeteredPremium: 0.65, order: 4 },
  '5g': { label: '5 Gbps', mbps: 5000, usdPerMonth: 0.30, unmeteredPremium: 0.95, order: 5 },
  '10g': { label: '10 Gbps', mbps: 10000, usdPerMonth: 0.45, unmeteredPremium: 1.60, order: 6 },
  '25g': { label: '25 Gbps', mbps: 25000, usdPerMonth: 0.85, unmeteredPremium: 3.50, order: 7 },
  '40g': { label: '40 Gbps', mbps: 40000, usdPerMonth: 1.30, unmeteredPremium: 5.00, order: 8 },
  '100g': { label: '100 Gbps', mbps: 100000, usdPerMonth: 2.20, unmeteredPremium: 7.50, order: 9 },
};

/** See `CPU_CLASS_IDS`; derived so the picker and validation cannot diverge. */
export const PORT_IDS = Object.keys(PORT_SPEEDS) as PortSpeedId[];

export function isPortSpeed(id: string): id is PortSpeedId {
  return Object.hasOwn(PORT_SPEEDS, id);
}
