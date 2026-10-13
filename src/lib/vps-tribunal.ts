/**
 * VPS Budget Tribunal — public entry point.
 *
 * Deterministic heuristic; deliberately not a live-price index or a claim of
 * actuarial precision. It estimates a plausible monthly price for a requested
 * VPS configuration, then gives the budget a tongue-in-cheek verdict. The UI
 * should expose the breakdown and describe the assumptions.
 *
 * This file is only a re-export barrel. The implementation lives in
 * `./vps-tribunal/`, one concern per file:
 *
 * - `constants/`      — every editable value: rate card, CPU/memory/location/port
 *                      catalogues, baseline input. No logic, edit these to
 *                      recalibrate the model.
 * - `types.ts`        — the shared type vocabulary.
 * - `normalize.ts`    — clamp and de-duplicate runtime/URL input.
 * - `pricing.ts`      — traffic tiers, per-component estimate, location picking.
 * - `trades.ts`       — single-change requirement trades and billing levers.
 * - `budget-plan.ts`  — sequential path toward the budget target.
 * - `traffic.ts`      — what the advertised allowance actually buys.
 * - `risks.ts`        — impossible configurations and compatibility caveats.
 * - `verdict.ts`      — verdict classification and assembly.
 * - `query.ts`        — canonical query-string serialization.
 * - `presentation.ts` — verdict copy, forum summary, share URLs.
 * - `format.ts`       — currency and step rounding.
 *
 * Import from here (`../lib/vps-tribunal`); import from a specific module only
 * when you need one piece of the model on its own.
 */

export * from './vps-tribunal/types';

export * from './vps-tribunal/constants/rates';
export * from './vps-tribunal/constants/defaults';
export * from './vps-tribunal/constants/cpu-classes';
export * from './vps-tribunal/constants/memory-generations';
export * from './vps-tribunal/constants/locations';
export * from './vps-tribunal/constants/port-speeds';

export * from './vps-tribunal/format';
export * from './vps-tribunal/normalize';
export * from './vps-tribunal/pricing';
export * from './vps-tribunal/trades';
export * from './vps-tribunal/budget-plan';
export * from './vps-tribunal/traffic';
export * from './vps-tribunal/risks';
export * from './vps-tribunal/verdict';
export * from './vps-tribunal/query';
export * from './vps-tribunal/presentation';
