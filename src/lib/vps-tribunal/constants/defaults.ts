/**
 * Baseline input used by the reset button, by `normalizeInput` fallbacks and by
 * the tests. It is the advertised low-end baseline, not a random guess.
 */

import type { BillingPeriod, TribunalInput, TransferMode } from '../types';

/** Every admissible transfer mode, in picker order. */
export const TRANSFER_MODES: TransferMode[] = ['egress', 'total', 'unmetered'];

/** Every admissible billing period, in picker order. */
export const BILLING_PERIODS: BillingPeriod[] = ['monthly', 'annual'];

export const DEFAULT_INPUT: TribunalInput = {
  budget: 1.75,
  billing: 'monthly',
  vcpu: 1,
  cpuClass: 'modern_server',
  ramGb: 1,
  ramGeneration: 'ddr4',
  nvmeGb: 20,
  ssdGb: 0,
  hddGb: 0,
  portSpeed: '1g',
  transferMode: 'egress',
  transferTb: 1,
  locations: [],
  publicIpv4: true,
};
