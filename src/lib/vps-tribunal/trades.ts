/**
 * Requirement trades and billing levers.
 *
 * `candidateChanges` is the single list of single-spec compromises; it is
 * re-priced independently for `tradeList` and sequentially for the budget plan,
 * so the two can never suggest different steps.
 */

import { CPU_CLASSES } from './constants/cpu-classes';
import { PORT_SPEEDS } from './constants/port-speeds';
import { RATES } from './constants/rates';
import { roundTo } from './format';
import { normalizeInput } from './normalize';
import { bestPrice } from './pricing';
import type {
  CpuClass, CpuClassId, PortSpeedId, PortSpeedInfo, StorageType, Trade, TradeId, TribunalInput,
} from './types';

/** A one-spec change and the copy that explains it, before it is priced. */
export interface Candidate {
  input: TribunalInput;
  trade: Omit<Trade, 'saves'>;
}

/** Port speed the `port` trade falls back to when the current one is faster. */
const PORT_TRADE_TARGET: PortSpeedId = '1g';

/** Every single-spec compromise available for this input, in suggestion order. */
export function candidateChanges(input: TribunalInput): Candidate[] {
  const out: Candidate[] = [];
  const add = (candidate: TribunalInput, trade: Omit<Trade, 'saves'>): void => {
    out.push({ input: normalizeInput(candidate), trade });
  };

  if (input.publicIpv4) {
    add({ ...input, publicIpv4: false }, {
      id: 'ipv4',
      label: 'Drop the public IPv4 address',
      detail: 'IPv6-only access, NAT or a tunnel may work if you do not need direct inbound IPv4.',
      kind: 'requirement',
    });
  }

  if (input.vcpu > 0.5) {
    const nextVcpu = Math.max(0.5, roundTo(input.vcpu * 0.5, 0.25));
    add({ ...input, vcpu: nextVcpu }, {
      id: 'vcpu',
      label: `Reduce vCPU count to ${nextVcpu}`,
      detail: 'This reduces parallel capacity; performance still depends on CPU generation and host scheduling.',
      kind: 'requirement',
      warn: 'Do not cut vCPU count if the workload needs the parallelism.',
    });
  }

  const lowerCpuClass = (Object.entries(CPU_CLASSES) as [CpuClassId, CpuClass][])
    .filter(([, meta]) => meta.order < CPU_CLASSES[input.cpuClass].order)
    .sort((a, b) => b[1].order - a[1].order)[0]?.[0];
  if (lowerCpuClass) {
    add({ ...input, cpuClass: lowerCpuClass }, {
      id: 'cpu_class',
      label: `Accept ${CPU_CLASSES[lowerCpuClass].label.toLowerCase()}`,
      detail: 'The older CPU family lowers the estimate, but actual impact depends on the exact model and CPU limits.',
      kind: 'requirement',
    });
  }

  if (input.ramGb > 0.5) {
    const reducedRam = Math.max(0.5, roundTo(input.ramGb * 0.5, 0.25));
    add({ ...input, ramGb: reducedRam }, {
      id: 'ram',
      label: `Reduce RAM to ${reducedRam} GB`,
      detail: 'Useful for very small services; databases and caches may suffer from memory pressure.',
      kind: 'requirement',
    });
  }

  const storageOptions: { id: StorageType; gb: number; label: string }[] = [
    { id: 'nvme', gb: input.nvmeGb, label: 'NVMe' },
    { id: 'ssd', gb: input.ssdGb, label: 'SSD' },
    { id: 'hdd', gb: input.hddGb, label: 'HDD' },
  ];
  for (const item of storageOptions) {
    if (item.gb < 8) continue;
    const nextSize = Math.max(0, Math.floor((item.gb * 0.5) / 5) * 5);
    if (nextSize >= item.gb) continue;
    const candidate: TribunalInput = { ...input };
    if (item.id === 'nvme') candidate.nvmeGb = nextSize;
    if (item.id === 'ssd') candidate.ssdGb = nextSize;
    if (item.id === 'hdd') candidate.hddGb = nextSize;
    add(candidate, {
      id: `storage_${item.id}` as TradeId,
      label: `Reduce ${item.label} storage to ${nextSize} GB`,
      detail: 'Storage capacity can be cheaper to compromise on than CPU or location, if your data fits.',
      kind: 'requirement',
    });
  }

  const currentPortOrder = PORT_SPEEDS[input.portSpeed].order;
  const targetPortOrder = currentPortOrder > PORT_SPEEDS[PORT_TRADE_TARGET].order
    ? PORT_SPEEDS[PORT_TRADE_TARGET].order
    : currentPortOrder - 1;
  const lowerPort = (Object.entries(PORT_SPEEDS) as [PortSpeedId, PortSpeedInfo][])
    .find(([, meta]) => meta.order === targetPortOrder)?.[0];
  if (lowerPort) {
    add({ ...input, portSpeed: lowerPort }, {
      id: 'port',
      label: `Accept a ${PORT_SPEEDS[lowerPort].label} port`,
      detail: 'Port speed is a peak link rate, not guaranteed sustained throughput. A lower port may be adequate for light services.',
      kind: 'requirement',
    });
  }

  if (input.transferMode === 'unmetered') {
    add({ ...input, transferMode: 'egress', transferTb: 25 }, {
      id: 'unmetered',
      label: 'Accept a 25 TB outbound allowance',
      detail: 'This may be cheaper than unmetered traffic, especially on high-speed ports; check what happens at the cap.',
      kind: 'requirement',
    });
  } else if (input.transferTb > 3) {
    const reducedTraffic = Math.max(1, roundTo(input.transferTb * 0.5, 0.5));
    add({ ...input, transferTb: reducedTraffic }, {
      id: 'traffic',
      label: `Reduce monthly traffic to ${reducedTraffic} TB`,
      detail: input.transferMode === 'total'
        ? 'Both inbound and outbound traffic count toward this allowance.'
        : 'This reduces the outbound-only allowance.',
      kind: 'requirement',
    });
  }

  if (input.locations.length > 0) {
    add({ ...input, locations: [] }, {
      id: 'location',
      label: 'Allow any location',
      detail: 'A generic market multiplier is cheaper in this model; actual route, latency and IP geolocation still need checking.',
      kind: 'requirement',
    });
  }

  return out;
}

/** Price one candidate against the current fair price, or drop it if it is noise. */
export function measuredTrade(baseFair: number, candidate: Candidate): Trade | null {
  const candidateFair = bestPrice(candidate.input).fair;
  const saves = roundTo(baseFair - candidateFair, 0.01);
  if (!Number.isFinite(saves) || saves < RATES.minTradeSavingUsd) return null;
  return { ...candidate.trade, saves };
}

/** Independent single-change savings, biggest first. */
export function tradeList(input: TribunalInput, fair: number): Trade[] {
  return candidateChanges(input)
    .map((candidate) => measuredTrade(fair, candidate))
    .filter((trade): trade is Trade => trade !== null)
    .sort((a, b) => b.saves - a.saves || a.id.localeCompare(b.id));
}

/**
 * Annual prepayment is already priced into an annual budget, so this nudge is
 * only offered when the user is budgeting month to month.
 */
export function annualLever(input: TribunalInput, fair: number): Trade | null {
  if (input.billing === 'annual') return null;
  const saves = roundTo(fair * (1 - RATES.annualFactor), 0.01);
  if (saves < RATES.minLeverSavingUsd) return null;
  return {
    id: 'annual',
    label: 'Pay annually instead of monthly',
    detail: 'The model assumes roughly 17% off for annual billing. Compare the full invoice and renewal price before committing.',
    saves,
    kind: 'payment',
  };
}
