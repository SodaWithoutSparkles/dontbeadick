/**
 * Location catalogue.
 *
 * `multiplier` is a soft market multiplier against the "anywhere" baseline,
 * not a bandwidth, latency or IP-quality score. `group` drives the UI grouping.
 */

import type { LocationGroup, LocationId, LocationInfo } from '../types';

export const LOCATIONS: Record<LocationId, LocationInfo> = {
  los_angeles: {
    label: 'Los Angeles, US', multiplier: 1.02, group: 'North America',
    note: 'A large, competitive hosting market; routing and IP quality can matter more than the city itself.',
  },
  new_york: {
    label: 'New York, US', multiplier: 1.05, group: 'North America',
    note: 'A large market with a modest assumed location premium.',
  },
  chicago: {
    label: 'Chicago, US', multiplier: 0.97, group: 'North America',
    note: 'Central US locations can be competitively priced.',
  },
  dallas: {
    label: 'Dallas, US', multiplier: 0.95, group: 'North America',
    note: 'A common budget-hosting market; actual pricing varies by provider and network.',
  },
  ashburn: {
    label: 'Ashburn / Northern Virginia, US', multiplier: 0.97, group: 'North America',
    note: 'A major datacenter market with many competing providers.',
  },
  amsterdam: {
    label: 'Amsterdam, Netherlands', multiplier: 1.00, group: 'Europe',
    note: 'A major European connectivity hub; this is a broad market estimate, not a bandwidth-routing score.',
  },
  frankfurt: {
    label: 'Frankfurt, Germany', multiplier: 1.00, group: 'Europe',
    note: 'A major European datacenter market.',
  },
  paris: {
    label: 'Paris, France', multiplier: 1.04, group: 'Europe',
    note: 'A small assumed premium; provider-specific promotions can erase it.',
  },
  london: {
    label: 'London, UK', multiplier: 1.10, group: 'Europe',
    note: 'Assumed modest premium; taxes, billing currency and renewal terms may also matter.',
  },
  hong_kong: {
    label: 'Hong Kong', multiplier: 1.35, group: 'Asia',
    note: 'A higher-cost market in this rough model; route to mainland China is a separate question.',
  },
  tokyo: {
    label: 'Tokyo, Japan', multiplier: 1.30, group: 'Asia',
    note: 'A higher-cost market in this rough model; domestic routing and IP geolocation may justify paying more.',
  },
  osaka: {
    label: 'Osaka, Japan', multiplier: 1.25, group: 'Asia',
    note: 'Fewer low-end offers may be available than in the largest markets; verify the actual catalogue.',
  },
  singapore: {
    label: 'Singapore', multiplier: 1.20, group: 'Asia',
    note: 'A common APAC budget location, but often pricier than US/EU offers at similar advertised specs.',
  },
  seoul: {
    label: 'Seoul, South Korea', multiplier: 1.20, group: 'Asia',
    note: 'A small sample of low-end offers can make this estimate especially uncertain.',
  },
};

/** See `CPU_CLASS_IDS`; derived so the picker and validation cannot diverge. */
export const LOCATION_IDS = Object.keys(LOCATIONS) as LocationId[];

/** Display order of the location groups. Every group must keep an entry. */
export const LOCATION_GROUPS: LocationGroup[] = ['North America', 'Europe', 'Asia'];

export function isLocation(id: string): id is LocationId {
  return Object.hasOwn(LOCATIONS, id);
}
