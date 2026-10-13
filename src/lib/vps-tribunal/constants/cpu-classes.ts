/**
 * CPU class catalogue.
 *
 * `usdPerVcpu` drives the estimate; `performanceIndex` is explanation copy
 * only. `order` defines the ladder used for "accept an older CPU" trades.
 */

import type { CpuClass, CpuClassId } from '../types';

export const CPU_CLASSES: Record<CpuClassId, CpuClass> = {
  legacy: {
    label: 'Legacy / low-clock server CPU',
    examples: 'Older Xeon E5 v1/v2, older Opteron, similarly dated parts',
    description: 'Lowest expected single-thread performance; useful for light services.',
    usdPerVcpu: 0.18,
    performanceIndex: 0.55,
    order: 0,
  },
  older_server: {
    label: 'Older server generation',
    examples: 'First-generation EPYC 7001 (Naples), Xeon E5 v3/v4, similar-era servers',
    description: 'Can provide solid multi-core throughput, but is a long way behind recent high-clock CPUs per vCPU.',
    usdPerVcpu: 0.29,
    performanceIndex: 0.75,
    order: 1,
  },
  modern_server: {
    label: 'Modern server CPU',
    examples: 'EPYC 7002/7003 (Rome/Milan), newer Xeon Scalable generations',
    description: 'A common balanced baseline for budget virtualization.',
    usdPerVcpu: 0.43,
    performanceIndex: 1.0,
    order: 2,
  },
  high_clock: {
    label: 'High-clock desktop/server CPU',
    examples: 'Ryzen 3000/5000, or a similarly fast high-clock Core CPU',
    description: 'Often stronger single-thread performance; advertised vCPUs are still usually shared.',
    usdPerVcpu: 0.56,
    performanceIndex: 1.3,
    order: 3,
  },
  latest: {
    label: 'Recent high-end CPU',
    examples: 'Ryzen 7000/9000, EPYC 9004/9005, recent high-end Core i7/i9',
    description: 'High expected per-vCPU performance, but actual time depends heavily on host contention and limits.',
    usdPerVcpu: 0.68,
    performanceIndex: 1.6,
    order: 4,
  },
};

/**
 * Stable id list for UI pickers. Deriving this keeps the option list and the
 * validation used by `normalizeInput` from ever drifting apart.
 */
export const CPU_CLASS_IDS = Object.keys(CPU_CLASSES) as CpuClassId[];

export function isCpuClass(id: string): id is CpuClassId {
  return Object.hasOwn(CPU_CLASSES, id);
}
