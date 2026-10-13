# dontbeadick

dontbeadick.lol — a small collection of practical and satirical tools.

Astro 5 + Tailwind CSS 4 (via the Vite plugin, no config file).

```sh
bun install
bun run dev      # http://localhost:4321
bun run build    # static output in dist/
bun run preview
bun test         # scoring rules
```

## Layout

- `src/layouts/Layout.astro` — html shell, meta tags
- `src/pages/` — one file per route
- `src/components/` — UI pieces
- `src/lib/vps-tribunal.ts` — re-export barrel for the VPS calculator
- `src/lib/vps-tribunal/` — the calculator core, one concern per file
  - `constants/` — every editable value: rate card, CPU/memory/location/port catalogues, baseline input
  - `types.ts`, `normalize.ts`, `pricing.ts`, `trades.ts`, `budget-plan.ts`, `traffic.ts`, `risks.ts`, `verdict.ts`, `query.ts`, `presentation.ts`, `format.ts`
- `src/data/listings.ts` — provider links, including your referral links
- `src/styles/global.css` — Tailwind entry (`@import 'tailwindcss'`)
- `public/` — static assets

Recalibrate the model by editing `src/lib/vps-tribunal/constants/`; no logic
lives there. The verdict has five bands: `impossible` (a hard conflict, such as
DDR5 on a legacy CPU) outranks the four budget bands. `judge()` returns numbers
only; copy, the forum summary and share URLs live in `presentation.ts`.

Budgets are entered for the selected billing period and always compared as a
monthly equivalent. Annual billing applies `RATES.annualFactor` to the modelled
price, and `verdict.levers` carries the annual-prepayment nudge when the user is
budgeting monthly.

## Referral links

Add entries to `LISTINGS` in `src/data/listings.ts` (`referral` field). Nothing
in `src/lib/vps-tribunal/` reads that file, so no offer can ever change a verdict.
Keep `source` and `checked` on every entry. The section only renders when the
list is non-empty.
