/**
 * Canonical query-string serialization, so a shared link replays exactly the
 * configuration it was generated from. Defaults are omitted and locations are
 * sorted, which makes the URL a stable identity for a configuration.
 *
 * Links written by the pre-billing model still parse: every key it emitted is
 * still read, and a missing `bill` means monthly.
 */

import { DEFAULT_INPUT, TRANSFER_MODES } from './constants/defaults';
import { CPU_CLASS_IDS } from './constants/cpu-classes';
import { isLocation, LOCATION_IDS } from './constants/locations';
import { MEMORY_IDS } from './constants/memory-generations';
import { PORT_IDS } from './constants/port-speeds';
import { normalizeInput } from './normalize';
import type { BillingPeriod, LocationId, TribunalInput } from './types';

/** Compact billing token: `m` / `a`. */
const BILLING_TOKENS = { monthly: 'm', annual: 'a' } as const;

export function toQuery(rawInput: unknown): string {
  const input = normalizeInput(rawInput);
  const params = new URLSearchParams();
  const addIf = (key: string, value: string, isDefaultValue: boolean): void => {
    if (!isDefaultValue) params.set(key, value);
  };

  addIf('b', String(input.budget), Object.is(input.budget, DEFAULT_INPUT.budget));
  addIf('bill', BILLING_TOKENS[input.billing], input.billing === DEFAULT_INPUT.billing);
  addIf('v', String(input.vcpu), Object.is(input.vcpu, DEFAULT_INPUT.vcpu));
  addIf('c', input.cpuClass, input.cpuClass === DEFAULT_INPUT.cpuClass);
  addIf('r', String(input.ramGb), Object.is(input.ramGb, DEFAULT_INPUT.ramGb));
  addIf('rg', input.ramGeneration, input.ramGeneration === DEFAULT_INPUT.ramGeneration);
  addIf('nv', String(input.nvmeGb), Object.is(input.nvmeGb, DEFAULT_INPUT.nvmeGb));
  addIf('ss', String(input.ssdGb), Object.is(input.ssdGb, DEFAULT_INPUT.ssdGb));
  addIf('hd', String(input.hddGb), Object.is(input.hddGb, DEFAULT_INPUT.hddGb));
  addIf('port', input.portSpeed, input.portSpeed === DEFAULT_INPUT.portSpeed);
  addIf('tm', input.transferMode, input.transferMode === DEFAULT_INPUT.transferMode);
  addIf('t', String(input.transferTb), Object.is(input.transferTb, DEFAULT_INPUT.transferTb));
  addIf('ip', input.publicIpv4 ? '1' : '0', input.publicIpv4 === DEFAULT_INPUT.publicIpv4);
  for (const location of input.locations) params.append('loc', location);

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fromQuery(search: string | URLSearchParams): TribunalInput {
  const params = typeof search === 'string'
    ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    : search;
  const getNumber = (key: string, fallback: number): number => {
    const value = Number.parseFloat(params.get(key) ?? '');
    return Number.isFinite(value) ? value : fallback;
  };
  const pick = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = params.get(key);
    return value !== null && values.includes(value as T) ? value as T : fallback;
  };

  const billingToken = params.get('bill');
  const billing: BillingPeriod = billingToken === 'a' || billingToken === 'annual' ? 'annual' : 'monthly';

  return normalizeInput({
    budget: getNumber('b', DEFAULT_INPUT.budget),
    billing,
    vcpu: getNumber('v', DEFAULT_INPUT.vcpu),
    cpuClass: pick('c', CPU_CLASS_IDS, DEFAULT_INPUT.cpuClass),
    ramGb: getNumber('r', DEFAULT_INPUT.ramGb),
    ramGeneration: pick('rg', MEMORY_IDS, DEFAULT_INPUT.ramGeneration),
    nvmeGb: getNumber('nv', DEFAULT_INPUT.nvmeGb),
    ssdGb: getNumber('ss', DEFAULT_INPUT.ssdGb),
    hddGb: getNumber('hd', DEFAULT_INPUT.hddGb),
    portSpeed: pick('port', PORT_IDS, DEFAULT_INPUT.portSpeed),
    transferMode: pick('tm', TRANSFER_MODES, DEFAULT_INPUT.transferMode),
    transferTb: getNumber('t', DEFAULT_INPUT.transferTb),
    locations: params.getAll('loc').filter((value): value is LocationId => isLocation(value)),
    publicIpv4: params.get('ip') !== '0',
  });
}
