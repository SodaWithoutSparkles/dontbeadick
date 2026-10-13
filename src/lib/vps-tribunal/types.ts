/**
 * Types for the VPS Budget Tribunal model.
 *
 * This module holds types only. Every rate, catalogue entry and default value
 * lives in `./constants`, so the numbers can be edited without touching logic.
 */

export type CpuClassId =
  | 'legacy'
  | 'older_server'
  | 'modern_server'
  | 'high_clock'
  | 'latest';

export type MemoryGeneration = 'ddr3' | 'ddr4' | 'ddr5';
export type LocationId =
  | 'los_angeles'
  | 'new_york'
  | 'chicago'
  | 'dallas'
  | 'ashburn'
  | 'amsterdam'
  | 'frankfurt'
  | 'paris'
  | 'london'
  | 'hong_kong'
  | 'tokyo'
  | 'osaka'
  | 'singapore'
  | 'seoul';

/** Broad region, used to group the location picker in the UI. */
export type LocationGroup = 'North America' | 'Europe' | 'Asia';

export type PortSpeedId =
  | '100m'
  | '250m'
  | '500m'
  | '1g'
  | '2_5g'
  | '5g'
  | '10g'
  | '25g'
  | '40g'
  | '100g';

/**
 * `monthly`: the budget is a month-to-month amount.
 * `annual`: the budget is a yearly amount, and the modelled price carries the
 * annual-prepayment discount.
 */
export type BillingPeriod = 'monthly' | 'annual';

/**
 * `egress`: only outbound traffic consumes the allowance.
 * `total`: inbound + outbound consume the allowance.
 * `unmetered`: no advertised monthly traffic quota; fair-use policy may apply.
 */
export type TransferMode = 'egress' | 'total' | 'unmetered';
export type StorageType = 'nvme' | 'ssd' | 'hdd';

/** `impossible` outranks the budget bands: the spec cannot be built as asked. */
export type VerdictId = 'impossible' | 'unicorn' | 'let' | 'reasonable' | 'roomy';

export type TradeId =
  | 'ipv4'
  | 'vcpu'
  | 'cpu_class'
  | 'ram'
  | 'storage_nvme'
  | 'storage_ssd'
  | 'storage_hdd'
  | 'port'
  | 'traffic'
  | 'unmetered'
  | 'location';

export interface CpuClass {
  label: string;
  examples: string;
  description: string;
  /** Heuristic monthly value per advertised vCPU, before location/billing adjustments. */
  usdPerVcpu: number;
  /** Relative performance cue for explanation only, not a benchmark promise. */
  performanceIndex: number;
  order: number;
}

export interface MemoryGenerationInfo {
  label: string;
  usdPerGb: number;
}

export interface LocationInfo {
  label: string;
  /** Soft multiplier relative to a broad US/EU budget-hosting baseline. */
  multiplier: number;
  note: string;
  /** Broad region, used to group the location picker. */
  group: LocationGroup;
}

export interface PortSpeedInfo {
  label: string;
  mbps: number;
  /** Incremental monthly estimate for this advertised port speed. */
  usdPerMonth: number;
  /** Added estimate for a no-quota plan at this port speed. */
  unmeteredPremium: number;
  order: number;
}

/** One step of the interpolated monthly traffic allowance schedule. */
export interface TrafficTier {
  /** Upper bound of this tier, in effective (outbound-only) TB per month. */
  upToEffectiveEgressTb: number;
  monthlyFee: number;
}

export interface TribunalInput {
  /** Maximum budget in the selected billing period; annual is normalized to monthly. */
  budget: number;
  billing: BillingPeriod;
  /** Advertised vCPU count. Supports fractional amounts such as 0.5. */
  vcpu: number;
  cpuClass: CpuClassId;
  /** GiB, as commonly marketed. 0.5 represents 512 MB. */
  ramGb: number;
  ramGeneration: MemoryGeneration;
  /** Storage capacities in GB. These are capacity amounts, not drive counts. */
  nvmeGb: number;
  ssdGb: number;
  hddGb: number;
  portSpeed: PortSpeedId;
  transferMode: TransferMode;
  /** Monthly quota in decimal TB; ignored when transferMode is `unmetered`. */
  transferTb: number;
  /** Locations are acceptable alternatives. Empty means location-agnostic / anywhere. */
  locations: LocationId[];
  publicIpv4: boolean;
}

export interface PriceBreakdown {
  location: LocationId | null;
  platform: number;
  cpu: number;
  ram: number;
  nvme: number;
  ssd: number;
  hdd: number;
  port: number;
  transfer: number;
  unmetered: number;
  ipv4: number;
  locationMultiplier: number;
  billingFactor: number;
  /** Sum before location and billing adjustments. */
  beforeLocation: number;
  /** Monthly price before the annual-prepayment discount, after location adjustment. */
  monthlyBaseTotal: number;
  /** Effective monthly equivalent after location and billing adjustments. */
  total: number;
  /** Amount billed for the chosen period: one month or twelve months. */
  periodTotal: number;
}

export interface LocationEstimate {
  id: LocationId | 'anywhere';
  label: string;
  fair: number;
}

export interface Trade {
  id: TradeId | 'annual';
  label: string;
  /** Monthly saving. Independent for `trades`, sequential for plan actions. */
  saves: number;
  detail: string;
  /** requirement = change a requested specification; payment = billing-term hint */
  kind: 'requirement' | 'payment';
  warn?: string;
}

/** A sequential path toward `targetRatio`, re-priced after every step. */
export interface BudgetPlan {
  targetRatio: number;
  /** Estimated monthly price after applying the suggested changes. */
  projectedFair: number;
  reachesTarget: boolean;
  actions: Trade[];
}

export interface TrafficAssessment {
  /** Effective outbound equivalent; null for unmetered plans. */
  effectiveEgressTb: number | null;
  /** Whole estimated monthly plan cost divided by the effective quota. Not a margin. */
  estimatedPlanDollarsPerTb: number | null;
  note?: string;
}

export interface Verdict {
  id: VerdictId;
  /** Budget as entered, before monthly normalization. */
  enteredBudget: number;
  billing: BillingPeriod;
  /** Normalized monthly budget. */
  budget: number;
  /** budget / estimated fair price; < 1 means budget is below the estimate. */
  ratio: number;
  /** Effective monthly equivalent at the cheapest acceptable location. */
  fair: number;
  /** Effective amount billed over the selected period. */
  fairForPeriod: number;
  /** Heuristic aggressive-deal floor, not a promise that no cheaper deal exists. */
  floor: number;
  breakdown: PriceBreakdown;
  /** Price range across the specifically selected location alternatives. */
  locationRange: { min: number; max: number };
  locationEstimates: LocationEstimate[];
  trades: Trade[];
  /** Billing-term hints, currently only the annual-prepayment nudge. */
  levers: Trade[];
  budgetPlan: BudgetPlan;
  impossibleReasons: string[];
  risks: string[];
  traffic: TrafficAssessment;
}

/** Verdict headline copy, before it is merged with the numbers. */
export interface VerdictCopy {
  title: string;
  summary: string;
  body: string[];
}
