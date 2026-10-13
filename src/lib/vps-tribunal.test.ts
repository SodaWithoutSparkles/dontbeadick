import { describe, expect, test } from 'bun:test';
import {
  CPU_CLASSES,
  DEFAULT_INPUT,
  LOCATIONS,
  MEMORY_GENERATIONS,
  CPU_CLASS_IDS,
  LOCATION_GROUPS,
  LOCATION_IDS,
  MEMORY_IDS,
  PORT_IDS,
  PORT_SPEEDS,
  RATES,
  buildShareText,
  buildShareUrl,
  classifyVerdict,
  fromQuery,
  isCpuClass,
  isLocation,
  isPortSpeed,
  judge,
  money,
  monthlyBudget,
  normalizeInput,
  parseShareQuery,
  priceFor,
  roundTo,
  toQuery,
  verdictCopy,
  type LocationId,
  type PriceBreakdown,
  type TribunalInput,
} from './vps-tribunal';

/** Build an input from the documented baseline, overriding only what a test cares about. */
const input = (overrides: Partial<TribunalInput> = {}): TribunalInput => ({ ...DEFAULT_INPUT, ...overrides });

const parts = (b: PriceBreakdown): number =>
  b.platform + b.cpu + b.ram + b.nvme + b.ssd + b.hdd + b.port + b.transfer + b.unmetered + b.ipv4;

const trade = (verdict: ReturnType<typeof judge>, id: string) =>
  verdict.trades.find((candidate) => candidate.id === id);

const riskText = (verdict: ReturnType<typeof judge>) => verdict.risks.join(' ');

const share = (overrides: Partial<TribunalInput> = {}): string => {
  const value = input(overrides);
  return buildShareText(value, judge(value));
};

describe('money', () => {
  test('keeps two decimals under $100', () => {
    expect(money(8.475)).toBe('$8.48');
    expect(money(8.4)).toBe('$8.40');
    expect(money(0)).toBe('$0.00');
  });

  test('drops decimals from $100 up', () => {
    expect(money(99.999)).toBe('$100');
    expect(money(100)).toBe('$100');
    expect(money(1234.5)).toBe('$1235');
  });

  test('never renders a broken number', () => {
    expect(money(Number.NaN)).toBe('n/a');
    expect(money(Number.POSITIVE_INFINITY)).toBe('n/a');
  });
});

describe('baseline and calibration', () => {
  test('the default configuration is the advertised baseline, not a guess', () => {
    // 1 vCPU modern server, 1 GB DDR4, 20 GB NVMe, 1 Gbps, 1 TB outbound, IPv4, anywhere.
    expect(priceFor(DEFAULT_INPUT).total).toBeCloseTo(2.304, 3);
    expect(priceFor(DEFAULT_INPUT).beforeLocation).toBeCloseTo(2.56, 3);
  });

  test('the baseline breakdown charges every component once and sums to the total', () => {
    const quote = priceFor(DEFAULT_INPUT);
    expect(parts(quote)).toBeCloseTo(quote.total, 6);
    expect(quote.location).toBeNull();
    expect(quote.locationMultiplier).toBe(RATES.anywhereMultiplier);
    expect(quote.billingFactor).toBe(1);
  });

  test('the Jun 2025 Singapore anchor reproduces its advertised price', () => {
    // 2 EPYC Milan vCPU, 4 GB RAM, 30 GB NVMe, 1 Gbps, 1 TB, Singapore, $5.10/month.
    const quote = priceFor(input({
      vcpu: 2,
      cpuClass: 'modern_server',
      ramGb: 4,
      nvmeGb: 30,
      portSpeed: '1g',
      transferTb: 1,
    }), 'singapore');
    expect(quote.total).toBeCloseTo(5.064, 3);
    expect(Math.abs(quote.total - 5.10) / 5.10).toBeLessThan(0.05);
  });

  test('the May 2026 Netherlands anchor stays inside a plausible band', () => {
    // 4 EPYC Milan vCPU, 8 GB DDR4, 50 GB NVMe, shared 10 Gbps, unmetered, NL, EUR 10.69/month.
    const quote = priceFor(input({
      vcpu: 4,
      cpuClass: 'modern_server',
      ramGb: 8,
      nvmeGb: 50,
      portSpeed: '10g',
      transferMode: 'unmetered',
      transferTb: 0,
    }), 'amsterdam');
    expect(quote.total).toBeCloseTo(8.73, 2);
    expect(quote.total).toBeLessThan(10.69);
    expect(quote.total).toBeGreaterThan(6.5);
  });

  test('promotional anchors are priced above the normal estimate, never above it', () => {
    // Sep 2025: Ryzen 9000, 1 GB, 15 GB NVMe, 10 Gbps, Singapore, $3/month.
    const ryzen = priceFor(input({
      cpuClass: 'latest',
      ramGeneration: 'ddr5',
      nvmeGb: 15,
      portSpeed: '10g',
    }), 'singapore').total;
    expect(ryzen).toBeCloseTo(3.78, 2);
    expect(ryzen).toBeGreaterThan(3);

    // Sep 2025: 4 vCPU, 6 GB, 100 GB SSD, 10 Gbps, 25 TB, Singapore, $40/year.
    const yearly = priceFor(input({
      vcpu: 4,
      ramGb: 6,
      nvmeGb: 0,
      ssdGb: 100,
      portSpeed: '10g',
      transferTb: 25,
    }), 'singapore').total;
    expect(yearly).toBeCloseTo(8.418, 3);
    expect(yearly).toBeGreaterThan(40 / 12);
  });
});

describe('rate card', () => {
  test('storage rates are ordered NVMe > SSD > HDD', () => {
    expect(RATES.storageGb.nvme).toBeGreaterThan(RATES.storageGb.ssd);
    expect(RATES.storageGb.ssd).toBeGreaterThan(RATES.storageGb.hdd);
  });

  test('port speed cost rises with speed', () => {
    const costs = Object.values(PORT_SPEEDS).map((port) => port.usdPerMonth);
    expect(costs).toEqual([...costs].sort((a, b) => a - b));
    expect(costs.every((cost, i) => i === 0 || costs[i - 1] < cost)).toBe(true);
  });

  test('unmetered premium rises with port speed', () => {
    const premiums = Object.values(PORT_SPEEDS).map((port) => port.unmeteredPremium);
    expect(premiums.every((premium, i) => i === 0 || premiums[i - 1] < premium)).toBe(true);
  });

  test('CPU classes rise in price and performance in the same order', () => {
    const byOrder = Object.values(CPU_CLASSES).sort((a, b) => a.order - b.order);
    expect(byOrder.map((cpu) => cpu.usdPerVcpu)).toEqual([...byOrder.map((cpu) => cpu.usdPerVcpu)].sort((a, b) => a - b));
    expect(byOrder.map((cpu) => cpu.performanceIndex)).toEqual([...byOrder.map((cpu) => cpu.performanceIndex)].sort((a, b) => a - b));
  });

  test('memory generations rise in price in the same order', () => {
    expect(MEMORY_GENERATIONS.ddr3.usdPerGb).toBeLessThan(MEMORY_GENERATIONS.ddr4.usdPerGb);
    expect(MEMORY_GENERATIONS.ddr4.usdPerGb).toBeLessThan(MEMORY_GENERATIONS.ddr5.usdPerGb);
  });

  test('every CPU class, memory generation, location and port has display copy', () => {
    for (const cpu of Object.values(CPU_CLASSES)) {
      expect(cpu.label.length).toBeGreaterThan(0);
      expect(cpu.examples.length).toBeGreaterThan(0);
      expect(cpu.description.length).toBeGreaterThan(0);
    }
    for (const location of Object.values(LOCATIONS)) {
      expect(location.label.length).toBeGreaterThan(0);
      expect(location.note.length).toBeGreaterThan(0);
      expect(location.multiplier).toBeGreaterThan(0);
    }
    for (const port of Object.values(PORT_SPEEDS)) expect(port.mbps).toBeGreaterThan(0);
  });

  test('every location belongs to a declared group', () => {
    expect(LOCATION_GROUPS).toEqual(['North America', 'Europe', 'Asia']);
    for (const id of LOCATION_IDS) expect(LOCATION_GROUPS).toContain(LOCATIONS[id].group);
    for (const group of LOCATION_GROUPS) {
      expect(LOCATION_IDS.filter((id) => LOCATIONS[id].group === group).length).toBeGreaterThan(0);
    }
  });

  test('the id lists cover the rate card exactly once each', () => {
    expect(new Set(CPU_CLASS_IDS).size).toBe(CPU_CLASS_IDS.length);
    expect(new Set(MEMORY_IDS).size).toBe(MEMORY_IDS.length);
    expect(new Set(LOCATION_IDS).size).toBe(LOCATION_IDS.length);
    expect(new Set(PORT_IDS).size).toBe(PORT_IDS.length);
    expect([...CPU_CLASS_IDS].sort()).toEqual(Object.keys(CPU_CLASSES).sort());
    expect([...MEMORY_IDS].sort()).toEqual(Object.keys(MEMORY_GENERATIONS).sort());
    expect([...LOCATION_IDS].sort()).toEqual(Object.keys(LOCATIONS).sort());
    expect([...PORT_IDS].sort()).toEqual(Object.keys(PORT_SPEEDS).sort());
  });

  test('every id is accepted by normalizeInput', () => {
    for (const id of CPU_CLASS_IDS) {
      expect(normalizeInput(input({ cpuClass: id })).cpuClass).toBe(id);
    }
    for (const id of MEMORY_IDS) {
      expect(normalizeInput(input({ ramGeneration: id })).ramGeneration).toBe(id);
    }
    for (const id of LOCATION_IDS) {
      expect(normalizeInput(input({ locations: [id] })).locations).toEqual([id]);
    }
    for (const id of PORT_IDS) {
      expect(normalizeInput(input({ portSpeed: id })).portSpeed).toBe(id);
    }
  });

  test('every location is at least the unconstrained "anywhere" estimate', () => {
    const anywhere = priceFor(input(), null).total;
    for (const id of Object.keys(LOCATIONS) as LocationId[]) {
      expect(priceFor(input(), id).total).toBeGreaterThan(anywhere);
    }
  });

  test('a pricier location costs more for the same configuration', () => {
    const cheap = priceFor(input(), 'dallas').total;
    const pricey = priceFor(input(), 'singapore').total;
    expect(pricey).toBeGreaterThan(cheap);
  });

  test('price scales linearly with vCPU, RAM and storage', () => {
    const one = priceFor(input()).total;
    expect(priceFor(input({ vcpu: 2 })).total).toBeCloseTo(one + priceFor(input({ vcpu: 1 })).cpu, 6);
    expect(priceFor(input({ ramGb: 4 })).total).toBeCloseTo(one + priceFor(input({ ramGb: 1 })).ram * 3, 6);
    expect(priceFor(input({ nvmeGb: 100 })).total).toBeCloseTo(one + priceFor(input({ nvmeGb: 20 })).nvme * 4, 6);
  });

  test('asking for more of anything never lowers the estimate', () => {
    const base = priceFor(DEFAULT_INPUT).total;
    expect(priceFor(input({ vcpu: 2 })).total).toBeGreaterThanOrEqual(base);
    expect(priceFor(input({ ramGb: 2 })).total).toBeGreaterThanOrEqual(base);
    expect(priceFor(input({ nvmeGb: 40 })).total).toBeGreaterThanOrEqual(base);
    expect(priceFor(input({ portSpeed: '10g' })).total).toBeGreaterThanOrEqual(base);
    expect(priceFor(input({ transferTb: 50 })).total).toBeGreaterThanOrEqual(base);
  });

  test('NVMe costs more than SSD, SSD more than HDD, and no storage costs least', () => {
    const withStorage = (overrides: Partial<TribunalInput>) => priceFor(input({ nvmeGb: 0, ssdGb: 0, hddGb: 0, ...overrides }), 'amsterdam').total;
    const none = withStorage({});
    const hdd = withStorage({ hddGb: 100 });
    const ssd = withStorage({ ssdGb: 100 });
    const nvme = withStorage({ nvmeGb: 100 });
    expect(nvme).toBeGreaterThan(ssd);
    expect(ssd).toBeGreaterThan(hdd);
    expect(hdd).toBeGreaterThan(none);
  });

  test('the platform base is always charged', () => {
    const bare = priceFor(input({ vcpu: 0.25, cpuClass: 'legacy', ramGb: 0.25, ramGeneration: 'ddr3', nvmeGb: 0, portSpeed: '100m', transferTb: 0, publicIpv4: false }));
    expect(bare.platform).toBeCloseTo(RATES.platformBase * RATES.anywhereMultiplier, 6);
  });

  test('a public IPv4 costs the flat IPv4 rate', () => {
    const withIpv4 = priceFor(input({ publicIpv4: true }));
    const withoutIpv4 = priceFor(input({ publicIpv4: false }));
    expect(withIpv4.ipv4).toBeCloseTo(RATES.publicIpv4 * withIpv4.locationMultiplier, 6);
    expect(withoutIpv4.ipv4).toBe(0);
    expect(withIpv4.total).toBeCloseTo(withoutIpv4.total + withIpv4.ipv4, 6);
  });
});

describe('billing period', () => {
  test('an annual budget is compared as a monthly equivalent', () => {
    const annual = judge(input({ budget: 60, billing: 'annual' }));
    expect(annual.budget).toBeCloseTo(5, 6);
    expect(annual.enteredBudget).toBe(60);
    expect(annual.billing).toBe('annual');
    expect(monthlyBudget(input({ budget: 60, billing: 'annual' }))).toBeCloseTo(5, 6);
    expect(monthlyBudget(input({ budget: 60, billing: 'monthly' }))).toBeCloseTo(60, 6);
  });

  test('annual billing discounts the modelled price and reports the invoice', () => {
    const monthly = judge(input({ budget: 5, billing: 'monthly' }));
    const annual = judge(input({ budget: 60, billing: 'annual' }));
    expect(annual.fair).toBeCloseTo(monthly.fair * RATES.annualFactor, 6);
    expect(annual.fairForPeriod).toBeCloseTo(annual.fair * 12, 6);
    expect(monthly.fairForPeriod).toBeCloseTo(monthly.fair, 6);
    expect(priceFor(input({ billing: 'annual' })).billingFactor).toBe(RATES.annualFactor);
  });

  test('the annual nudge is only offered when budgeting monthly', () => {
    expect(judge(input({ billing: 'monthly' })).levers.map((lever) => lever.id)).toEqual(['annual']);
    expect(judge(input({ billing: 'annual' })).levers).toEqual([]);
    const lever = judge(input({ billing: 'monthly' })).levers[0];
    expect(lever.kind).toBe('payment');
    expect(lever.saves).toBeCloseTo(judge(input()).fair * (1 - RATES.annualFactor), 2);
    expect(judge(input()).trades.map((candidate) => candidate.id)).not.toContain('annual');
  });

  test('annual billing warns against double-counting the discount', () => {
    expect(riskText(judge(input({ billing: 'annual' })))).toContain('do not apply another annual discount');
    expect(riskText(judge(input({ billing: 'monthly' })))).not.toContain('do not apply another annual discount');
  });

  test('the same monthly budget in either period lands in the same band', () => {
    expect(judge(input({ budget: 2.4, billing: 'monthly' })).id)
      .toBe(judge(input({ budget: 28.8, billing: 'annual' })).id);
  });
});

describe('traffic', () => {
  const fee = (transferTb: number, transferMode: 'egress' | 'total' = 'egress') =>
    priceFor(input({ transferTb, transferMode }), 'amsterdam').transfer;

  test('the included allowance is free', () => {
    expect(fee(0)).toBe(0);
    expect(fee(1)).toBe(0);
    expect(fee(RATES.includedEgressTb)).toBe(0);
    expect(fee(RATES.includedEgressTb + 0.1)).toBeGreaterThan(0);
  });

  test('traffic cost never decreases as the allowance grows', () => {
    const fees = [1, 2, 3, 5, 8, 10, 20, 30, 50, 100, 150].map((tb) => fee(tb));
    expect(fees.every((value, i) => i === 0 || fees[i - 1] <= value)).toBe(true);
  });

  test('tiers interpolate, so a small step above a boundary costs only a little', () => {
    // No step function: 2.1 TB must not jump straight to the 5 TB tier price.
    expect(fee(2.1)).toBeLessThan(fee(3));
    expect(fee(3)).toBeLessThan(fee(5));
    expect(fee(5)).toBeLessThan(fee(8));
  });

  test('a combined in+out allowance is worth about half the same egress allowance', () => {
    expect(fee(8, 'total')).toBeCloseTo(fee(4), 6);
    expect(fee(8, 'total')).toBeLessThan(fee(8, 'egress'));
    expect(fee(3.9, 'total')).toBe(0);
    expect(fee(4.2, 'total')).toBeGreaterThan(0);
  });

  test('traffic above the last tier is billed per TB', () => {
    const lastTier = RATES.trafficTiers[RATES.trafficTiers.length - 1];
    const overflow = lastTier.upToEffectiveEgressTb + 50;
    expect(fee(overflow)).toBeCloseTo(
      lastTier.monthlyFee + 50 * RATES.above100TbFeePerTb,
      6,
    );
  });

  test('unmetered traffic is charged as a premium, not as a quota', () => {
    const quote = priceFor(input({ transferMode: 'unmetered', transferTb: 0, portSpeed: '10g' }));
    expect(quote.transfer).toBe(0);
    expect(quote.unmetered).toBeCloseTo(PORT_SPEEDS['10g'].unmeteredPremium * quote.locationMultiplier, 6);
    expect(quote.total).toBeGreaterThan(priceFor(input({ transferMode: 'egress', transferTb: 1, portSpeed: '10g' })).total);
  });

  test('the traffic assessment reports the effective allowance, not the advertised one', () => {
    expect(judge(input({ transferMode: 'total', transferTb: 202 })).traffic.effectiveEgressTb).toBe(101);
    expect(judge(input({ transferMode: 'egress', transferTb: 25 })).traffic.effectiveEgressTb).toBe(25);
    expect(judge(input({ transferMode: 'unmetered' })).traffic.effectiveEgressTb).toBeNull();
    expect(judge(input({ transferMode: 'egress', transferTb: 0 })).traffic.estimatedPlanDollarsPerTb).toBeNull();
  });

  test('a cheap full-quota plan is called out without moving the verdict', () => {
    const verdict = judge(input({ transferMode: 'egress', transferTb: 25 }));
    expect(verdict.traffic.estimatedPlanDollarsPerTb).not.toBeNull();
    expect(verdict.traffic.note).toContain("not the host's marginal bandwidth cost");
    expect(riskText(verdict)).toContain('not the host');
    // The note is advisory: the band comes from the price alone.
    const bare = judge(input({ transferMode: 'egress', transferTb: 1 }));
    expect(verdict.id).toBe(bare.id);
  });
});

describe('location selection', () => {
  test('no selected location means a single "anywhere" estimate', () => {
    const verdict = judge(input({ locations: [] }));
    expect(verdict.locationEstimates).toEqual([{ id: 'anywhere', label: 'Anywhere', fair: verdict.fair }]);
    expect(verdict.locationRange).toEqual({ min: verdict.fair, max: verdict.fair });
    expect(verdict.breakdown.location).toBeNull();
  });

  test('selected locations are alternatives priced cheapest first', () => {
    const verdict = judge(input({ locations: ['tokyo', 'dallas', 'paris'] }));
    expect(verdict.locationEstimates.map((estimate) => estimate.id)).toEqual(['dallas', 'paris', 'tokyo']);
    expect(verdict.locationEstimates.map((estimate) => estimate.label)).toEqual(['Dallas, US', 'Paris, France', 'Tokyo, Japan']);
  });

  test('the verdict prices the cheapest selected location and reports the range', () => {
    const verdict = judge(input({ locations: ['tokyo', 'dallas', 'paris'] }));
    expect(verdict.breakdown.location).toBe('dallas');
    expect(verdict.fair).toBeCloseTo(verdict.locationRange.min, 6);
    expect(verdict.locationRange.min).toBeLessThan(verdict.locationRange.max);
    expect(verdict.locationRange.max).toBeCloseTo(priceFor(input(), 'tokyo').total, 6);
  });

  test('duplicate and unknown locations are dropped before pricing', () => {
    expect(judge(input({ locations: ['tokyo', 'tokyo', 'not-a-place' as LocationId] })).locationEstimates)
      .toEqual(judge(input({ locations: ['tokyo'] })).locationEstimates);
  });
});

describe('verdict bands', () => {
  const fair = priceFor(DEFAULT_INPUT).total;
  const down = (value: number) => Math.floor(value * 100) / 100;
  const up = (value: number) => Math.ceil(value * 100) / 100;

  test('a budget far below the estimate is a unicorn hunt', () => {
    expect(judge(input({ budget: fair * 0.1 })).id).toBe('unicorn');
    expect(classifyVerdict(0.1)).toBe('unicorn');
  });

  test('a budget just under the estimate is reasonable, and well over it is roomy', () => {
    expect(judge(input({ budget: fair })).id).toBe('reasonable');
    expect(judge(input({ budget: fair * 4 })).id).toBe('roomy');
  });

  test('band edges use the configured ratios', () => {
    expect(judge(input({ budget: down(fair * RATES.unicornRatio) })).id).toBe('unicorn');
    expect(judge(input({ budget: up(fair * RATES.unicornRatio) })).id).toBe('let');

    expect(judge(input({ budget: down(fair * RATES.letRatio) })).id).toBe('let');
    expect(judge(input({ budget: up(fair * RATES.letRatio) })).id).toBe('reasonable');

    expect(judge(input({ budget: down(fair * RATES.roomyRatio) })).id).toBe('reasonable');
    expect(judge(input({ budget: up(fair * RATES.roomyRatio) })).id).toBe('roomy');
  });

  test('every band is reachable and each ratio maps to exactly one band', () => {
    const seen = new Set<ReturnType<typeof judge>['id']>();
    for (let budget = 0.1; budget <= 20; budget = Math.round((budget + 0.05) * 100) / 100) {
      const verdict = judge(input({ budget }));
      const ratio = verdict.budget / verdict.fair;
      const expected = ratio < RATES.unicornRatio ? 'unicorn'
        : ratio < RATES.letRatio ? 'let'
        : ratio <= RATES.roomyRatio ? 'reasonable'
        : 'roomy';
      expect(verdict.id).toBe(expected as ReturnType<typeof judge>['id']);
      seen.add(verdict.id);
    }
    expect([...seen].sort()).toEqual(['let', 'reasonable', 'roomy', 'unicorn']);
  });

  test('ratio and floor follow the fair price', () => {
    for (const budget of [0.5, 1, 2.5, 5, 25]) {
      const verdict = judge(input({ budget }));
      expect(verdict.fair).toBeCloseTo(priceFor(input({ budget })).total, 6);
      expect(verdict.ratio).toBeCloseTo(verdict.budget / verdict.fair, 6);
      expect(verdict.floor).toBeCloseTo(verdict.fair * RATES.unicornRatio, 6);
    }
  });

  test('every verdict carries copy and a breakdown that adds up', () => {
    for (const budget of [0.5, 1, 2.5, 5, 25]) {
      const verdict = judge(input({ budget }));
      const copy = verdictCopy(verdict);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.summary.length).toBeGreaterThan(0);
      expect(copy.body.length).toBeGreaterThan(0);
      expect(copy.body.join(' ')).toContain(money(verdict.fair));
      expect(parts(verdict.breakdown)).toBeCloseTo(verdict.breakdown.total, 6);
      expect(verdict.breakdown.total).toBeCloseTo(verdict.fair, 6);
    }
  });

  test('the same band always gets the same copy', () => {
    expect(verdictCopy(judge(input({ budget: 0.2 }))).title).toBe('The unicorn hunt');
    expect(verdictCopy(judge(input({ budget: 1 }))).title).toBe('LowEndTalk territory');
    expect(verdictCopy(judge(input({ budget: 2.5 }))).title).toBe('Reasonable expectations');
    expect(verdictCopy(judge(input({ budget: 40 }))).title).toBe('Room to breathe');
  });
});

describe('impossible configurations', () => {
  test('hard platform contradictions outrank the budget bands', () => {
    const ddr5Legacy = judge(input({ cpuClass: 'legacy', ramGeneration: 'ddr5' }));
    expect(ddr5Legacy.id).toBe('impossible');
    expect(ddr5Legacy.impossibleReasons.join(' ')).toContain('DDR5 is incompatible');

    expect(judge(input({ cpuClass: 'older_server', ramGeneration: 'ddr5' })).id).toBe('impossible');
    expect(judge(input({ cpuClass: 'modern_server', ramGeneration: 'ddr3' })).id).toBe('impossible');
    expect(judge(input({ cpuClass: 'latest', ramGeneration: 'ddr3' })).id).toBe('impossible');
  });

  test('a VM with no boot storage is impossible, not merely risky', () => {
    const noDisk = judge(input({ nvmeGb: 0, ssdGb: 0, hddGb: 0 }));
    expect(noDisk.id).toBe('impossible');
    expect(noDisk.impossibleReasons.join(' ')).toContain('No storage is specified');
    expect(judge(input({ nvmeGb: 20 })).id).not.toBe('impossible');
  });

  test('a huge port on a tiny budget is impossible in this heuristic', () => {
    expect(judge(input({ budget: 0.5, portSpeed: '100g' })).id).toBe('impossible');
    expect(judge(input({ budget: 0.5, portSpeed: '25g' })).id).toBe('impossible');
    expect(judge(input({ budget: 5, portSpeed: '25g' })).id).not.toBe('impossible');
    expect(judge(input({ budget: 0.5, portSpeed: '10g' })).id).not.toBe('impossible');
  });

  test('the annual equivalent budget clears the high-port threshold', () => {
    // $6/year is only $0.50/month, so a 25G port is still rejected.
    expect(judge(input({ budget: 6, billing: 'annual', portSpeed: '25g' })).id).toBe('impossible');
    expect(judge(input({ budget: 60, billing: 'annual', portSpeed: '25g' })).id).not.toBe('impossible');
  });

  test('the impossible verdict explains itself and is priced anyway', () => {
    const verdict = judge(input({ cpuClass: 'legacy', ramGeneration: 'ddr5', budget: 40 }));
    const copy = verdictCopy(verdict);
    expect(copy.title).toBe('That spec does not add up');
    expect(copy.body.join(' ')).toContain('DDR5 is incompatible');
    expect(copy.body.join(' ')).toContain('a price comparison cannot make incompatible hardware');
    expect(Number.isFinite(verdict.fair)).toBe(true);
  });

  test('the default configuration is never impossible', () => {
    expect(judge(DEFAULT_INPUT).impossibleReasons).toEqual([]);
  });
});

describe('trades and levers', () => {
  test('dropping the public IPv4 is offered and priced correctly', () => {
    const verdict = judge(input({ budget: 1 }));
    const dropIpv4 = trade(verdict, 'ipv4');
    expect(dropIpv4?.label).toBe('Drop the public IPv4 address');
    expect(dropIpv4?.kind).toBe('requirement');
    expect(dropIpv4?.saves).toBeCloseTo(
      priceFor(input({ publicIpv4: true })).total - priceFor(input({ publicIpv4: false })).total,
      1,
    );
    expect(dropIpv4?.saves).toBeGreaterThan(0);
  });

  test('there is no IPv4 trade when there is no IPv4 to drop', () => {
    expect(trade(judge(input({ budget: 1, publicIpv4: false })), 'ipv4')).toBeUndefined();
  });

  test('trades are requirement changes, sorted by saving, and all meaningful', () => {
    const verdict = judge(input({ budget: 1, vcpu: 4, ramGb: 8, nvmeGb: 100, transferTb: 100, portSpeed: '10g', locations: ['tokyo'] }));
    expect(verdict.trades.length).toBeGreaterThan(1);
    for (const candidate of verdict.trades) {
      expect(candidate.kind).toBe('requirement');
      expect(candidate.saves).toBeGreaterThanOrEqual(RATES.minTradeSavingUsd);
      expect(candidate.label.length).toBeGreaterThan(0);
      expect(candidate.detail.length).toBeGreaterThan(0);
    }
    expect(verdict.trades.map((candidate) => candidate.saves))
      .toEqual([...verdict.trades].map((candidate) => candidate.saves).sort((a, b) => b - a));
    expect(verdict.trades[0].id).toBe('location');
  });

  test('vCPU, RAM and storage trades halve the resource', () => {
    expect(trade(judge(input({ budget: 1, vcpu: 4 })), 'vcpu')?.label).toBe('Reduce vCPU count to 2');
    expect(trade(judge(input({ budget: 1, ramGb: 8 })), 'ram')?.label).toBe('Reduce RAM to 4 GB');
    expect(trade(judge(input({ budget: 1, nvmeGb: 100 })), 'storage_nvme')?.label).toBe('Reduce NVMe storage to 50 GB');
    expect(trade(judge(input({ budget: 1, hddGb: 1000 })), 'storage_hdd')?.label).toBe('Reduce HDD storage to 500 GB');
  });

  test('vCPU is never traded below half a core, and small storage is left alone', () => {
    expect(trade(judge(input({ budget: 1, vcpu: 0.5 })), 'vcpu')).toBeUndefined();
    expect(trade(judge(input({ budget: 1, nvmeGb: 5 })), 'storage_nvme')).toBeUndefined();
  });

  test('the port trade drops straight to 1 Gbps from anything faster', () => {
    expect(trade(judge(input({ budget: 1, portSpeed: '25g' })), 'port')?.label).toBe('Accept a 1 Gbps port');
    expect(trade(judge(input({ budget: 1, portSpeed: '5g' })), 'port')?.label).toBe('Accept a 1 Gbps port');
    // Below 1 Gbps it steps down one speed instead.
    expect(trade(judge(input({ budget: 1, portSpeed: '500m' })), 'port')?.label).toBe('Accept a 250 Mbps port');
    // ...but a step that saves $0.03 is noise, and the slowest port has none.
    expect(trade(judge(input({ budget: 1, portSpeed: '250m' })), 'port')).toBeUndefined();
    expect(trade(judge(input({ budget: 1, portSpeed: '100m' })), 'port')).toBeUndefined();
  });

  test('traffic is only traded down when the allowance is worth trading', () => {
    expect(trade(judge(input({ budget: 1, transferTb: 100 })), 'traffic')?.label).toBe('Reduce monthly traffic to 50 TB');
    expect(trade(judge(input({ budget: 1, transferTb: 25 })), 'traffic')?.label).toBe('Reduce monthly traffic to 12.5 TB');
    // Small allowances are gated out; the rest are gated by the noise floor.
    expect(trade(judge(input({ budget: 1, transferTb: 3 })), 'traffic')).toBeUndefined();
    expect(trade(judge(input({ budget: 1, transferTb: 0.5 })), 'traffic')).toBeUndefined();
  });

  test('a combined in+out allowance warns that both directions count', () => {
    const combined = trade(judge(input({ budget: 1, transferMode: 'total', transferTb: 100 })), 'traffic');
    expect(combined?.detail).toContain('inbound and outbound');
  });

  test('unmetered traffic is traded for a 25 TB outbound allowance', () => {
    const verdict = judge(input({ budget: 1, transferMode: 'unmetered', portSpeed: '10g' }));
    expect(trade(verdict, 'unmetered')?.label).toBe('Accept a 25 TB outbound allowance');
    expect(trade(judge(input({ budget: 1, transferMode: 'egress' })), 'unmetered')).toBeUndefined();
  });

  test('unrestricted location is offered only when a location was restricted', () => {
    const relaxed = trade(judge(input({ budget: 1, locations: ['tokyo'] })), 'location');
    expect(relaxed?.label).toBe('Allow any location');
    expect(relaxed?.saves).toBeCloseTo(priceFor(input(), 'tokyo').total - priceFor(input()).total, 2);
    expect(trade(judge(input({ budget: 1 })), 'location')).toBeUndefined();
  });

  test('a vCPU cut carries a warning about parallelism', () => {
    expect(trade(judge(input({ budget: 1, vcpu: 4 })), 'vcpu')?.warn).toBeTruthy();
  });

  test('savings below the noise floor are dropped', () => {
    const minimal = input({
      budget: 1,
      vcpu: 0.25,
      cpuClass: 'legacy',
      ramGb: 0.25,
      ramGeneration: 'ddr3',
      nvmeGb: 0,
      portSpeed: '100m',
      transferTb: 0,
      publicIpv4: false,
    });
    const verdict = judge(minimal);
    expect(verdict.fair * (1 - RATES.annualFactor)).toBeLessThan(RATES.minLeverSavingUsd);
    expect(verdict.levers).toEqual([]);
    expect(verdict.trades).toEqual([]);
  });
});

describe('budget plan', () => {
  const overBudget = () => judge(input({
    budget: 1,
    vcpu: 8,
    ramGb: 16,
    nvmeGb: 500,
    transferMode: 'unmetered',
    portSpeed: '10g',
    locations: ['tokyo'],
  }));

  test('an over-budget spec gets a sequential route to the target', () => {
    const verdict = overBudget();
    expect(verdict.id).toBe('unicorn');
    expect(verdict.budgetPlan.actions.length).toBeGreaterThan(0);
    expect(verdict.budgetPlan.targetRatio).toBe(RATES.letRatio);
    expect(verdict.budgetPlan.projectedFair).toBeLessThan(verdict.fair);
    expect(verdict.budgetPlan.reachesTarget).toBe(true);
  });

  test('the plan is a route, not a bag: every step re-prices the remainder', () => {
    const verdict = overBudget();
    expect(verdict.budgetPlan.projectedFair).toBeCloseTo(verdict.fair - verdict.budgetPlan.actions.reduce((sum, action) => sum + action.saves, 0), 1);
    for (const action of verdict.budgetPlan.actions) {
      expect(action.kind).toBe('requirement');
      expect(action.saves).toBeGreaterThanOrEqual(RATES.minTradeSavingUsd);
    }
    // The biggest win is taken first, so savings never increase along the plan.
    const savings = verdict.budgetPlan.actions.map((action) => action.saves);
    expect(savings).toEqual([...savings].sort((a, b) => b - a));
  });

  test('a spec already inside the target needs no plan', () => {
    const verdict = judge(input({ budget: 40 }));
    expect(verdict.id).toBe('roomy');
    expect(verdict.budgetPlan.actions).toEqual([]);
    expect(verdict.budgetPlan.reachesTarget).toBe(true);
  });

  test('an impossible plan reports that it could not reach the target', () => {
    // Nothing left to trade: a bare minimum box the budget still cannot cover.
    const verdict = judge(input({ budget: 0.02, vcpu: 0.25, cpuClass: 'legacy', ramGb: 0.25, ramGeneration: 'ddr3', nvmeGb: 1, portSpeed: '100m', transferTb: 0, publicIpv4: false }));
    expect(verdict.budgetPlan.actions).toEqual([]);
    expect(verdict.budgetPlan.reachesTarget).toBe(false);
  });

  test('the plan is deterministic', () => {
    expect(overBudget().budgetPlan).toEqual(overBudget().budgetPlan);
  });
});

describe('compatibility risks', () => {
  test('the CPU tier caveat is always reported', () => {
    for (const cpuClass of Object.keys(CPU_CLASSES) as (keyof typeof CPU_CLASSES)[]) {
      expect(riskText(judge(input({ cpuClass })))).toContain('CPU tier is based on the advertised host CPU family');
    }
  });

  test('IPv6-only, NAT or tunnel plans are flagged', () => {
    expect(riskText(judge(input({ publicIpv4: false })))).toContain('public IPv4');
    expect(riskText(judge(input({ publicIpv4: true })))).not.toContain('public IPv4. Add one');
  });

  test('the newest CPU tier asks for the exact model because platforms differ', () => {
    expect(riskText(judge(input({ cpuClass: 'latest', ramGeneration: 'ddr4' })))).toContain('Check the exact CPU model');
    expect(riskText(judge(input({ cpuClass: 'latest', ramGeneration: 'ddr5' })))).not.toContain('Check the exact CPU model');
  });

  test('a doubtful DDR3 pairing is a caveat, not a rejection', () => {
    expect(judge(input({ cpuClass: 'high_clock', ramGeneration: 'ddr3' })).id).not.toBe('impossible');
    expect(riskText(judge(input({ cpuClass: 'high_clock', ramGeneration: 'ddr3' })))).toContain('DDR3 is unusual');
  });

  test('unmetered traffic is never sold as unlimited throughput', () => {
    expect(riskText(judge(input({ transferMode: 'unmetered' })))).toContain('not a promise of unlimited sustained throughput');
    expect(riskText(judge(input({ transferMode: 'egress' })))).not.toContain('not a promise of unlimited sustained throughput');
  });

  test('traffic past the calibration range and fast shared ports are flagged', () => {
    expect(riskText(judge(input({ transferTb: 150 })))).toContain('above 100 TB/month');
    expect(riskText(judge(input({ transferTb: 100 })))).not.toContain('above 100 TB/month');
    // The warning follows the effective allowance, so an in+out quota halves it.
    expect(riskText(judge(input({ transferMode: 'total', transferTb: 202 })))).toContain('above 100 TB/month');
    expect(riskText(judge(input({ transferMode: 'total', transferTb: 100 })))).not.toContain('above 100 TB/month');
    expect(riskText(judge(input({ portSpeed: '10g' })))).toContain('advertised/shared link rate');
    expect(riskText(judge(input({ portSpeed: '1g' })))).not.toContain('advertised/shared link rate');
  });

  test('several locations are explained as alternatives, not a deployment', () => {
    expect(riskText(judge(input({ locations: ['paris', 'osaka'] })))).toContain('acceptable alternatives');
    expect(riskText(judge(input({ locations: ['paris'] })))).not.toContain('acceptable alternatives');
    expect(riskText(judge(input({ locations: [] })))).not.toContain('acceptable alternatives');
  });

  test('APAC multipliers are declared as small-sample priors', () => {
    for (const location of ['hong_kong', 'tokyo', 'osaka', 'singapore', 'seoul'] as LocationId[]) {
      expect(riskText(judge(input({ locations: [location] })))).toContain('rough priors');
    }
    expect(riskText(judge(input({ locations: ['amsterdam'] })))).not.toContain('rough priors');
  });

  test('every risk is a non-empty sentence', () => {
    const risks = judge(input({ budget: 1, locations: ['tokyo'], transferMode: 'unmetered' })).risks;
    expect(risks.length).toBeGreaterThan(0);
    for (const risk of risks) {
      expect(risk.trim().length).toBeGreaterThan(20);
      expect(risk.endsWith('.')).toBe(true);
    }
  });
});

describe('normalizeInput', () => {
  test('unknown enum values fall back to the baseline', () => {
    const junk = {
      budget: 3,
      vcpu: 1,
      cpuClass: 'quantum',
      ramGb: 1,
      ramGeneration: 'lpddr',
      nvmeGb: 0,
      ssdGb: 0,
      hddGb: 0,
      portSpeed: '7g',
      transferMode: 'sideways',
      billing: 'hourly',
      transferTb: 1,
      locations: [],
      publicIpv4: true,
    } as unknown as TribunalInput;
    const clean = normalizeInput(junk);
    expect(clean.cpuClass).toBe(DEFAULT_INPUT.cpuClass);
    expect(clean.ramGeneration).toBe(DEFAULT_INPUT.ramGeneration);
    expect(clean.portSpeed).toBe(DEFAULT_INPUT.portSpeed);
    expect(clean.transferMode).toBe(DEFAULT_INPUT.transferMode);
    expect(clean.billing).toBe(DEFAULT_INPUT.billing);
    // Supplied numbers survive; only unknown enums are replaced.
    expect(clean.budget).toBe(3);
    expect(clean.nvmeGb).toBe(0);
  });

  test('anything that is not an object collapses to the baseline', () => {
    for (const junk of [null, undefined, 42, 'nope', [], true]) {
      expect(normalizeInput(junk)).toEqual(DEFAULT_INPUT);
    }
  });

  test('prototype-chain names are not valid enum values', () => {
    expect(normalizeInput({ ...DEFAULT_INPUT, cpuClass: 'constructor' }).cpuClass).toBe(DEFAULT_INPUT.cpuClass);
    expect(normalizeInput({ ...DEFAULT_INPUT, locations: ['__proto__', 'tokyo', 'tokyo'] }).locations).toEqual(['tokyo']);
    expect(normalizeInput({ ...DEFAULT_INPUT, ramGeneration: 'toString' }).ramGeneration).toBe(DEFAULT_INPUT.ramGeneration);
    const quote = priceFor(DEFAULT_INPUT, 'constructor' as LocationId);
    expect(quote.location).toBeNull();
    expect(Number.isFinite(quote.total)).toBe(true);
  });

  test('numbers are clamped to the supported ranges', () => {
    expect(normalizeInput(input({ budget: -4 })).budget).toBe(0.01);
    expect(normalizeInput(input({ budget: 0 })).budget).toBe(0.01);
    expect(normalizeInput(input({ vcpu: 0.1 })).vcpu).toBe(0.25);
    expect(normalizeInput(input({ vcpu: 1000 })).vcpu).toBe(512);
    expect(normalizeInput(input({ ramGb: 0.1 })).ramGb).toBe(0.25);
    expect(normalizeInput(input({ ramGb: 9999 })).ramGb).toBe(4096);
    expect(normalizeInput(input({ nvmeGb: -5 })).nvmeGb).toBe(0);
    expect(normalizeInput(input({ transferTb: -5 })).transferTb).toBe(0);
  });

  test('numbers are rounded to the advertised step', () => {
    expect(normalizeInput(input({ budget: 5.007 })).budget).toBe(5.01);
    expect(normalizeInput(input({ vcpu: 1.3 })).vcpu).toBe(1.25);
    expect(normalizeInput(input({ ramGb: 3.1 })).ramGb).toBe(3);
    expect(normalizeInput(input({ nvmeGb: 19.6 })).nvmeGb).toBe(20);
    expect(normalizeInput(input({ transferTb: 1.26 })).transferTb).toBe(1.3);
  });

  test('numeric strings are accepted, blank ones are not', () => {
    expect(normalizeInput({ ...DEFAULT_INPUT, budget: '4.5' }).budget).toBe(4.5);
    expect(normalizeInput({ ...DEFAULT_INPUT, budget: '   ' }).budget).toBe(DEFAULT_INPUT.budget);
  });

  test('only an explicit false removes the public IPv4', () => {
    expect(normalizeInput(input({ publicIpv4: false })).publicIpv4).toBe(false);
    expect(normalizeInput(input({ publicIpv4: undefined as unknown as boolean })).publicIpv4).toBe(true);
    expect(normalizeInput(input({ publicIpv4: 0 as unknown as boolean })).publicIpv4).toBe(true);
  });

  test('locations are de-duplicated, filtered, sorted and defaulted', () => {
    expect(normalizeInput(input({ locations: ['tokyo', 'tokyo'] })).locations).toEqual(['tokyo']);
    expect(normalizeInput(input({ locations: ['tokyo', 'nope' as LocationId] })).locations).toEqual(['tokyo']);
    expect(normalizeInput(input({ locations: ['tokyo', 'dallas'] })).locations).toEqual(['dallas', 'tokyo']);
    expect(normalizeInput(input({ locations: 'tokyo' as unknown as LocationId[] })).locations).toEqual([]);
  });

  test('normalising twice changes nothing', () => {
    const messy = input({ budget: 5.007, vcpu: 1.3, locations: ['tokyo', 'tokyo'], nvmeGb: 19.6 });
    expect(normalizeInput(normalizeInput(messy))).toEqual(normalizeInput(messy));
  });
});

describe('rounding', () => {
  test('steps do not serialize binary floating-point noise', () => {
    expect(roundTo(0.3, 0.1)).toBe(0.3);
    expect(roundTo(0.29, 0.01)).toBe(0.29);
    expect(roundTo(0.30000000000000004, 0.1)).toBe(0.3);
  });

  test('an unusable step is a no-op rather than a crash', () => {
    expect(roundTo(1.23, 0)).toBe(1.23);
    expect(roundTo(Number.NaN, 0.1)).toBeNaN();
  });
});

describe('share text', () => {
  test('the share block states the verdict, budget, fair price and floor', () => {
    const text = share({ budget: 1 });
    expect(text).toContain('LowEndTalk territory');
    expect(text).toContain(`Budget: ${money(1)}/month (${money(1)}/mo equivalent)`);
    expect(text).toContain(`estimated fair price: ~${money(judge(input({ budget: 1 })).fair)}/mo equivalent`);
    expect(text).toContain('aggressive-deal floor');
  });

  test('the share block leads with the cheapest route, not a single tip', () => {
    const text = share({ budget: 1, vcpu: 4, ramGb: 8 });
    expect(text).toContain('Changes to approach the 85% budget target:');
    expect(text).toMatch(/\n1\. .+ \(-\$[\d.]+\/mo\)/);
    expect(text).not.toContain('Biggest potential saving');
  });

  test('the share block describes the requested configuration', () => {
    const text = share({ budget: 12, locations: ['tokyo'] });
    expect(text).toContain('1 vCPU, Modern server CPU');
    expect(text).toContain('1 GB DDR4');
    expect(text).toContain('20 GB NVMe + 0 GB SSD + 0 GB HDD');
    expect(text).toContain('1 Gbps, 1 TB/month (outbound only), public IPv4: yes');
    expect(text).toContain('Acceptable locations: Tokyo, Japan');
  });

  test('unmetered and in+out traffic are spelled out in the share block', () => {
    expect(share({ transferMode: 'unmetered' })).toContain('unmetered (check fair use)');
    expect(share({ transferMode: 'total' })).toContain('1 TB/month (in + out)');
  });

  test('an annual budget is labelled per year', () => {
    const text = share({ budget: 60, billing: 'annual' });
    expect(text).toContain(`Budget: ${money(60)}/year`);
    expect(text).toContain('bill=a');
  });

  test('an unrestricted search says so', () => {
    expect(share()).toContain('Acceptable locations: anywhere');
    expect(share()).toContain('Location estimate: Anywhere.');
    expect(share({ locations: ['tokyo', 'dallas'] })).toContain('Selected-location estimate range:');
  });

  test('the share block carries the budget plan and any conflicts', () => {
    const plan = share({ budget: 1, vcpu: 8, ramGb: 16, nvmeGb: 500, locations: ['tokyo'] });
    expect(plan).toContain('Changes to approach the 85% budget target:');
    expect(plan).toMatch(/\n1\. .+ \(-\$[\d.]+\/mo\)/);

    const conflict = share({ cpuClass: 'legacy', ramGeneration: 'ddr5' });
    expect(conflict).toContain('Compatibility issues:');
    expect(conflict).toContain('- DDR5 is incompatible');
    expect(conflict).toContain('That spec does not add up');
  });

  test('the link replays the same verdict', () => {
    const original = judge(input({ budget: 7, locations: ['osaka', 'paris'], transferMode: 'total', transferTb: 12.5 }));
    const url = original.id && buildShareUrl(input({ budget: 7, locations: ['osaka', 'paris'], transferMode: 'total', transferTb: 12.5 }));
    expect(url).toStartWith('https://dontbeadick.lol/vps-budget?');
    const replayed = judge(fromQuery(url.slice(url.indexOf('?'))));
    expect(replayed.id).toBe(original.id);
    expect(replayed.fair).toBeCloseTo(original.fair, 6);
    expect(parseShareQuery(url.slice(url.indexOf('?')))).toEqual(normalizeInput(input({
      budget: 7,
      locations: ['osaka', 'paris'],
      transferMode: 'total',
      transferTb: 12.5,
    })));
  });

  test('a fully default configuration shares a clean URL', () => {
    expect(buildShareUrl(DEFAULT_INPUT)).toBe('https://dontbeadick.lol/vps-budget');
    expect(toQuery(DEFAULT_INPUT)).toBe('');
  });
});

describe('query round-trip', () => {
  test('the baseline survives a round trip', () => {
    expect(fromQuery(toQuery(DEFAULT_INPUT))).toEqual(normalizeInput(DEFAULT_INPUT));
  });

  test('a rich configuration survives a round trip', () => {
    const rich = input({
      budget: 12.5,
      billing: 'annual',
      vcpu: 2.5,
      cpuClass: 'latest',
      ramGb: 1.5,
      ramGeneration: 'ddr5',
      nvmeGb: 30,
      hddGb: 500,
      portSpeed: '2_5g',
      transferMode: 'unmetered',
      transferTb: 0,
      locations: ['tokyo', 'dallas'],
      publicIpv4: false,
    });
    expect(fromQuery(toQuery(rich))).toEqual(normalizeInput(rich));
  });

  test('defaults are omitted and locations are sorted, so a config has one URL', () => {
    const query = toQuery(input({ locations: ['tokyo', 'dallas', 'paris'] }));
    expect(new URLSearchParams(query).getAll('loc')).toEqual(['dallas', 'paris', 'tokyo']);
    expect(query.indexOf('loc=dallas')).toBeLessThan(query.indexOf('loc=tokyo'));
    expect(fromQuery(query).locations).toEqual(['dallas', 'paris', 'tokyo']);
    expect(toQuery(fromQuery(query))).toBe(query);
    expect(query).not.toContain('v=');
    expect(query).not.toContain('bill=');
  });

  test('billing has a compact token and accepts the long form', () => {
    expect(toQuery(input({ billing: 'annual' }))).toContain('bill=a');
    expect(fromQuery('?bill=a').billing).toBe('annual');
    expect(fromQuery('?bill=annual').billing).toBe('annual');
    expect(fromQuery('?bill=m').billing).toBe('monthly');
    expect(fromQuery('').billing).toBe('monthly');
  });

  test('links written by the pre-billing model still replay', () => {
    const legacy = '?b=5&v=1&c=modern_server&r=1&rg=ddr4&nv=20&ss=0&hd=0&port=1g&tm=egress&t=1&ip=1';
    expect(fromQuery(legacy)).toEqual(normalizeInput(input({ budget: 5 })));
    expect(fromQuery(legacy).billing).toBe('monthly');
  });

  test('a full garbage query falls back to the baseline', () => {
    expect(fromQuery('?u=nonsense&b=abc&c=x&rg=y&port=z&tm=q&loc=nope')).toEqual(normalizeInput(DEFAULT_INPUT));
    expect(fromQuery('')).toEqual(normalizeInput(DEFAULT_INPUT));
  });

  test('out-of-range numbers are clamped, not replaced by the default', () => {
    expect(fromQuery('?b=-4').budget).toBe(0.01);
    expect(fromQuery('?v=0&r=0&t=-1').vcpu).toBe(0.25);
    expect(fromQuery('?v=0&r=0&t=-1').transferTb).toBe(0);
  });

  test('only ip=0 turns the IPv4 off', () => {
    expect(fromQuery('?ip=0').publicIpv4).toBe(false);
    expect(fromQuery('?ip=1').publicIpv4).toBe(true);
    expect(fromQuery('').publicIpv4).toBe(true);
    expect(fromQuery('?ip=yes').publicIpv4).toBe(true);
  });
});

describe('type guards', () => {
  test('CPU class ids are recognised', () => {
    for (const id of Object.keys(CPU_CLASSES)) expect(isCpuClass(id)).toBe(true);
    expect(isCpuClass('modern')).toBe(false);
    expect(isCpuClass('constructor')).toBe(false);
  });

  test('location ids are recognised', () => {
    for (const id of Object.keys(LOCATIONS)) expect(isLocation(id)).toBe(true);
    expect(isLocation('mars')).toBe(false);
    expect(isLocation('__proto__')).toBe(false);
  });

  test('port speed ids are recognised', () => {
    for (const id of Object.keys(PORT_SPEEDS)) expect(isPortSpeed(id)).toBe(true);
    expect(isPortSpeed('7g')).toBe(false);
    expect(isPortSpeed('hasOwnProperty')).toBe(false);
  });
});
