/**
 * Input normalization: clamp untrusted URL/form data to a canonical input.
 * Total by design — it accepts `unknown`, so partial, wrong-typed and hostile
 * input all collapse to the baseline instead of throwing or leaking values.
 */

import { DEFAULT_INPUT, TRANSFER_MODES, BILLING_PERIODS } from './constants/defaults';
import { CPU_CLASSES, isCpuClass } from './constants/cpu-classes';
import { isLocation } from './constants/locations';
import { MEMORY_GENERATIONS } from './constants/memory-generations';
import { isPortSpeed } from './constants/port-speeds';
import { roundTo } from './format';
import type { LocationId, MemoryGeneration, TribunalInput, TransferMode } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Clamp runtime/URL input to sensible ranges before calculating a quote. */
export function normalizeInput(input: unknown): TribunalInput {
  const raw = isRecord(input) ? input : {};
  const cpuClass = typeof raw.cpuClass === 'string' && isCpuClass(raw.cpuClass) ? raw.cpuClass : DEFAULT_INPUT.cpuClass;
  const ramGeneration = typeof raw.ramGeneration === 'string' && Object.hasOwn(MEMORY_GENERATIONS, raw.ramGeneration)
    ? raw.ramGeneration as MemoryGeneration : DEFAULT_INPUT.ramGeneration;
  const portSpeed = typeof raw.portSpeed === 'string' && isPortSpeed(raw.portSpeed) ? raw.portSpeed : DEFAULT_INPUT.portSpeed;
  const transferMode = typeof raw.transferMode === 'string' && TRANSFER_MODES.includes(raw.transferMode as TransferMode)
    ? raw.transferMode as TransferMode : DEFAULT_INPUT.transferMode;
  const billing = typeof raw.billing === 'string' && BILLING_PERIODS.includes(raw.billing as (typeof BILLING_PERIODS)[number])
    ? raw.billing as (typeof BILLING_PERIODS)[number] : DEFAULT_INPUT.billing;
  // Sorted so a shared link is canonical regardless of checkbox order.
  const locations = Array.isArray(raw.locations)
    ? [...new Set(raw.locations.filter((id): id is LocationId => typeof id === 'string' && isLocation(id)))].sort()
    : [];

  return {
    budget: roundTo(finiteNumber(raw.budget, DEFAULT_INPUT.budget, 0.01, 1_000_000), 0.01),
    billing,
    vcpu: roundTo(finiteNumber(raw.vcpu, DEFAULT_INPUT.vcpu, 0.25, 512), 0.25),
    cpuClass,
    ramGb: roundTo(finiteNumber(raw.ramGb, DEFAULT_INPUT.ramGb, 0.25, 4096), 0.25),
    ramGeneration,
    nvmeGb: roundTo(finiteNumber(raw.nvmeGb, DEFAULT_INPUT.nvmeGb, 0, 1_000_000), 1),
    ssdGb: roundTo(finiteNumber(raw.ssdGb, DEFAULT_INPUT.ssdGb, 0, 1_000_000), 1),
    hddGb: roundTo(finiteNumber(raw.hddGb, DEFAULT_INPUT.hddGb, 0, 1_000_000), 1),
    portSpeed,
    transferMode,
    transferTb: roundTo(finiteNumber(raw.transferTb, DEFAULT_INPUT.transferTb, 0, 1_000_000), 0.1),
    locations,
    publicIpv4: raw.publicIpv4 !== false,
  };
}
