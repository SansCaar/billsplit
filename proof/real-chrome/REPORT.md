# Real Chrome parser test — Walmart account in Chrome Profile 2

Run on 2026-11-20 against the real signed-in Walmart account, using the **same parsing code the extension ships** (`apps/extension/src/walmartPage.ts`), injected via AppleScript. Read-only: no cart, checkout, return, or tip actions. Order numbers are shortened to their last 4 digits; no names, addresses, or card digits are recorded.

## 1. Every order in the account (50 orders)

**50/50** parsed with items + tax + fees equal to Walmart’s charged total to the cent, and no warnings.

| Order | Placed | Fulfillments | Lines | $0 lines (unavailable/canceled/returned) | Substituted | Fees | Tax | Walmart total | Diff |
|---|---|---|---|---|---|---|---|---|---|
| …8433 | 2026-09-27 | delivery | 22 | 5 | 0 | — | $4.83 | $96.36 | 0¢ |
| …9075 | 2026-09-28 | shipping+delivery | 16 | 1 | 0 | — | $6.41 | $112.64 | 0¢ |
| …1554 | 2026-09-28 | delivery | 12 | 4 | 0 | — | $2.18 | $40.43 | 0¢ |
| …9110 | 2026-09-30 | delivery+delivery | 10 | 0 | 0 | — | $2.80 | $58.14 | 0¢ |
| …3324 | 2026-09-30 | delivery | 9 | 1 | 0 | — | $3.21 | $67.50 | 0¢ |
| …5544 | 2026-10-01 | delivery | 9 | 1 | 1 | — | $2.10 | $50.53 | 0¢ |
| …0612 | 2026-10-02 | shipping+delivery | 14 | 1 | 0 | — | $3.72 | $68.52 | 0¢ |
| …2365 | 2026-10-05 | delivery | 6 | 1 | 0 | — | $1.60 | $34.94 | 0¢ |
| …7855 | 2026-10-07 | delivery | 7 | 1 | 0 | — | $1.68 | $35.29 | 0¢ |
| …5732 | 2026-10-07 | shipping+delivery+delivery | 21 | 3 | 0 | — | $4.15 | $79.76 | 0¢ |
| …0545 | 2026-10-09 | delivery | 11 | 1 | 0 | — | $4.34 | $83.70 | 0¢ |
| …8903 | 2026-10-09 | shipping | 1 | 0 | 0 | — | $0.50 | $10.49 | 0¢ |
| …0369 | 2026-10-11 | delivery | 19 | 3 | 0 | — | $3.38 | $70.91 | 0¢ |
| …8025 | 2026-10-11 | delivery | 9 | 1 | 0 | — | $1.83 | $40.22 | 0¢ |
| …3659 | 2026-10-12 | delivery | 7 | 0 | 0 | — | $3.08 | $62.36 | 0¢ |
| …8310 | 2026-10-12 | delivery | 15 | 1 | 1 | — | $2.78 | $57.57 | 0¢ |
| …3474 | 2026-10-13 | delivery | 16 | 1 | 0 | — | $3.52 | $73.50 | 0¢ |
| …7969 | 2026-10-14 | delivery | 2 | 0 | 0 | — | $1.93 | $40.46 | 0¢ |
| …5859 | 2026-10-16 | delivery | 12 | 12 | 0 | — | $0.00 | $0.00 | 0¢ |
| …0797 | 2026-10-19 | delivery | 20 | 3 | 0 | — | $5.49 | $107.44 | 0¢ |
| …2671 | 2026-10-19 | delivery | 11 | 11 | 0 | — | $0.00 | $0.00 | 0¢ |
| …1054 | 2026-10-19 | delivery | 1 | 1 | 0 | — | $0.00 | $0.00 | 0¢ |
| …3635 | 2026-10-19 | delivery | 12 | 12 | 0 | — | $0.00 | $0.00 | 0¢ |
| …8415 | 2026-10-20 | delivery | 21 | 2 | 0 | — | $5.38 | $108.90 | 0¢ |
| …1220 | 2026-10-22 | delivery | 15 | 0 | 0 | — | $5.06 | $95.99 | 0¢ |
| …5252 | 2026-10-23 | delivery | 9 | 0 | 0 | — | $2.91 | $61.07 | 0¢ |
| …1689 | 2026-10-24 | delivery | 9 | 2 | 1 | — | $1.65 | $34.72 | 0¢ |
| …3005 | 2026-10-27 | delivery | 13 | 1 | 0 | — | $2.12 | $44.42 | 0¢ |
| …5170 | 2026-10-27 | delivery | 12 | 3 | 0 | — | $1.36 | $28.46 | 0¢ |
| …9816 | 2026-10-30 | delivery | 8 | 2 | 0 | — | $2.06 | $41.69 | 0¢ |
| …8882 | 2026-10-30 | delivery | 15 | 1 | 0 | 3 hours or less $5.00 | $7.12 | $136.15 | 0¢ |
| …7898 | 2026-10-30 | delivery | 14 | 0 | 1 | — | $5.82 | $104.07 | 0¢ |
| …7826 | 2026-10-31 | delivery | 10 | 0 | 1 | — | $2.86 | $52.56 | 0¢ |
| …9248 | 2026-11-01 | delivery | 26 | 2 | 1 | — | $6.06 | $123.63 | 0¢ |
| …5615 | 2026-11-03 | shipping+delivery | 15 | 2 | 0 | — | $3.93 | $62.67 | 0¢ |
| …7651 | 2026-11-04 | delivery | 20 | 20 | 0 | — | $0.00 | $0.00 | 0¢ |
| …8172 | 2026-11-04 | delivery | 23 | 1 | 0 | Driver tip $10.30 | $5.20 | $118.77 | 0¢ |
| …8203 | 2026-11-05 | delivery | 10 | 0 | 0 | — | $2.11 | $37.97 | 0¢ |
| …5532 | 2026-11-06 | delivery | 16 | 1 | 1 | — | $5.71 | $107.53 | 0¢ |
| …8444 | 2026-11-09 | delivery | 18 | 2 | 0 | — | $3.32 | $69.68 | 0¢ |
| …8705 | 2026-11-10 | delivery | 9 | 9 | 0 | — | $0.00 | $0.00 | 0¢ |
| …9612 | 2026-11-10 | delivery | 20 | 0 | 0 | — | $5.89 | $123.63 | 0¢ |
| …8265 | 2026-11-11 | delivery | 15 | 3 | 0 | — | $3.15 | $62.84 | 0¢ |
| …6036 | 2026-11-11 | shipping+delivery | 9 | 1 | 0 | — | $2.55 | $46.80 | 0¢ |
| …8031 | 2026-11-11 | delivery | 20 | 2 | 0 | — | $7.14 | $137.30 | 0¢ |
| …5988 | 2026-11-15 | delivery | 22 | 1 | 0 | — | $4.32 | $84.43 | 0¢ |
| …7184 | 2026-11-18 | delivery+delivery | 23 | 3 | 0 | — | $5.12 | $97.21 | 0¢ |
| …9055 | 2026-11-19 | delivery | 6 | 0 | 0 | — | $2.69 | $56.47 | 0¢ |
| …6729 | 2026-11-19 | delivery | 23 | 1 | 0 | — | $5.19 | $106.96 | 0¢ |
| …9359 | 2026-11-20 | delivery | 15 | 0 | 1 | — | $2.53 | $53.22 | 0¢ |

## 2. Expanding every dropdown on real order pages

The extension clicks every collapsed section toggle on the page (never cart/return/cancel/tip buttons), then cross-checks the item names visible on the page against what it parsed.

| Order | Toggles expanded | Collapsed sections left | Item tiles on page | Lines parsed | Cross-check warnings |
|---|---|---|---|---|---|
| …9359 | 3 | 0 | 15 | 15 | 0 |
| …7184 | 6 | 0 | 23 | 23 | 0 |
| …9248 | 4 | 0 | 26 | 26 | 0 |
| …9075 | 7 | 0 | 16 | 16 | 0 |
| …8882 | 4 | 0 | 15 | 15 | 0 |
| …8172 | 4 | 0 | 23 | 23 | 0 |
| …0797 | 4 | 0 | 20 | 20 | 0 |
| …2671 | 3 | 0 | 11 | 11 | 0 |
