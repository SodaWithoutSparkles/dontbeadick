/**
 * Where to look after the verdict.
 *
 * Referral links go in `referral` and nowhere else. Nothing in
 * `src/lib/tribunal.ts` reads this file, so no offer can change a verdict.
 * Keep a `source` and a `checked` date next to every entry — that is what
 * makes the list worth trusting instead of a link farm.
 */
export interface Listing {
  name: string;
  /** Direct offer URL. */
  url: string;
  /** Affiliate/referral URL, or null for a plain link. */
  referral: string | null;
  /** Monthly price in USD when it was last checked. */
  price: number | null;
  /** Where the numbers came from, e.g. "provider pricing page" or an LET thread. */
  source: string;
  /** ISO date the entry was last verified. */
  checked: string;
  note?: string;
}

export const LISTINGS: Listing[] = [];

export const DISCLOSURE =
  'Some links below are referral links. They cost you nothing extra and they change no verdict.';
