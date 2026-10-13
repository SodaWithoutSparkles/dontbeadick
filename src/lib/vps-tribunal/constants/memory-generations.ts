/** Memory generation catalogue. `usdPerGb` drives the estimate. */

import type { MemoryGeneration, MemoryGenerationInfo } from '../types';

export const MEMORY_GENERATIONS: Record<MemoryGeneration, MemoryGenerationInfo> = {
  ddr3: { label: 'DDR3', usdPerGb: 0.25 },
  ddr4: { label: 'DDR4', usdPerGb: 0.37 },
  ddr5: { label: 'DDR5', usdPerGb: 0.44 },
};

/** See `CPU_CLASS_IDS`; derived so the picker and validation cannot diverge. */
export const MEMORY_IDS = Object.keys(MEMORY_GENERATIONS) as MemoryGeneration[];
