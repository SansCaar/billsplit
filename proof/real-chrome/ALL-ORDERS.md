# All orders through the real extension — Appartment B (6 members)

Run 2026-11-20 in the real Chrome (Profile 2 Walmart account + installed extension + Google sign-in). For each order the script opened the real order page, clicked **🧾 Split this order**, assigned every item in the Processing tab with a rotating pattern (2 people · All · Same as last · 1 person · 2 people · 1 person · 3 people), rotated the payer, and sent it. Read-only on walmart.com. Order numbers shortened to last 4 digits.

## Verified in the database afterwards

- **51 expenses for 51 distinct orders** (50 by script + 1 processed by hand earlier) — no duplicates
- **567 items assigned**, $3,232.70 total; every expense amount equals Walmart’s charged total
- For every expense: member shares + leftover cents = total; recomputing from stored data gives the same shares
- What the Review screen showed = what the server saved (shares, leftover, payer) for all 50
- Item list identical to a direct parse for all 50 (4 orders only listed items in a different order — harmless, items match by key)
- Group balances sum to exactly $0.00; 51 “processed” activity entries; 51 snapshots
- Leftover cents (given to nobody, ADR 0002): 681¢ total across 51 orders

| # | Order | Placed | Total | Items | Payer | Members’ sum | Leftover | Sent |
|---|---|---|---|---|---|---|---|---|
| 1 | …7855 | 10/7/2026 | $35.29 | 6 | Hello | $35.21 | 8¢ | done |
| 1 | …3659 | 10/12/2026 | $62.36 | 7 | Hello | $62.20 | 16¢ | done |
| 2 | …9075 | 9/28/2026 | $112.64 | 15 | Housemate A | $112.47 | 17¢ | done |
| 3 | …0797 | 10/19/2026 | $107.44 | 17 | Housemate B | $107.21 | 23¢ | done |
| 4 | …7969 | 10/14/2026 | $40.46 | 2 | Housemate C | $40.38 | 8¢ | done |
| 5 | …1689 | 10/24/2026 | $34.72 | 7 | Housemate D | $34.65 | 7¢ | done |
| 6 | …2671 | 10/19/2026 | $0.00 | 0 | Sanskar Lamsal | $0.00 | 0¢ | done |
| 7 | …8705 | 11/10/2026 | $0.00 | 0 | Hello | $0.00 | 0¢ | done |
| 8 | …9110 | 9/30/2026 | $58.14 | 10 | Housemate A | $58.04 | 10¢ | done |
| 9 | …3324 | 9/30/2026 | $67.50 | 8 | Housemate B | $67.37 | 13¢ | done |
| 10 | …0612 | 10/2/2026 | $68.52 | 13 | Housemate C | $68.38 | 14¢ | done |
| 11 | …2365 | 10/5/2026 | $34.94 | 5 | Housemate D | $34.87 | 7¢ | done |
| 12 | …8433 | 9/27/2026 | $96.36 | 17 | Sanskar Lamsal | $96.19 | 17¢ | done |
| 13 | …5252 | 10/23/2026 | $61.07 | 9 | Hello | $60.95 | 12¢ | done |
| 14 | …5732 | 10/7/2026 | $79.76 | 18 | Housemate A | $79.51 | 25¢ | done |
| 15 | …8415 | 10/20/2026 | $108.90 | 19 | Housemate B | $108.71 | 19¢ | done |
| 16 | …5615 | 11/3/2026 | $62.67 | 13 | Housemate C | $62.53 | 14¢ | done |
| 17 | …0369 | 10/11/2026 | $70.91 | 16 | Housemate D | $70.68 | 23¢ | done |
| 18 | …5544 | 10/1/2026 | $50.53 | 8 | Sanskar Lamsal | $50.41 | 12¢ | done |
| 19 | …9248 | 11/1/2026 | $123.63 | 24 | Hello | $123.30 | 33¢ | done |
| 20 | …7826 | 10/31/2026 | $52.56 | 10 | Housemate A | $52.45 | 11¢ | done |
| 21 | …5859 | 10/16/2026 | $0.00 | 0 | Housemate B | $0.00 | 0¢ | done |
| 22 | …1054 | 10/19/2026 | $0.00 | 0 | Housemate C | $0.00 | 0¢ | done |
| 23 | …7898 | 10/30/2026 | $104.07 | 14 | Housemate D | $104.02 | 5¢ | done |
| 24 | …8310 | 10/12/2026 | $57.57 | 14 | Sanskar Lamsal | $57.40 | 17¢ | done |
| 25 | …8025 | 10/11/2026 | $40.22 | 8 | Hello | $40.12 | 10¢ | done |
| 26 | …8203 | 11/5/2026 | $37.97 | 10 | Housemate A | $37.80 | 17¢ | done |
| 27 | …9816 | 10/30/2026 | $41.69 | 6 | Housemate B | $41.60 | 9¢ | done |
| 28 | …5170 | 10/27/2026 | $28.46 | 9 | Housemate C | $28.35 | 11¢ | done |
| 29 | …8903 | 10/9/2026 | $10.49 | 1 | Housemate D | $10.48 | 1¢ | done |
| 30 | …3635 | 10/19/2026 | $0.00 | 0 | Sanskar Lamsal | $0.00 | 0¢ | done |
| 31 | …6036 | 11/11/2026 | $46.80 | 8 | Hello | $46.73 | 7¢ | done |
| 32 | …1220 | 10/22/2026 | $95.99 | 15 | Housemate A | $95.84 | 15¢ | done |
| 33 | …0545 | 10/9/2026 | $83.70 | 10 | Housemate B | $83.57 | 13¢ | done |
| 34 | …9359 | 11/20/2026 | $53.22 | 15 | Housemate C | $53.07 | 15¢ | done |
| 35 | …3005 | 10/27/2026 | $44.42 | 12 | Housemate D | $44.22 | 20¢ | done |
| 36 | …3474 | 10/13/2026 | $73.50 | 15 | Sanskar Lamsal | $73.35 | 15¢ | done |
| 37 | …8265 | 11/11/2026 | $62.84 | 12 | Hello | $62.67 | 17¢ | done |
| 38 | …9612 | 11/10/2026 | $123.63 | 20 | Housemate A | $123.36 | 27¢ | done |
| 39 | …5532 | 11/6/2026 | $107.53 | 15 | Housemate B | $107.28 | 25¢ | done |
| 40 | …8444 | 11/9/2026 | $69.68 | 16 | Housemate C | $69.50 | 18¢ | done |
| 41 | …9055 | 11/19/2026 | $56.47 | 6 | Housemate D | $56.41 | 6¢ | done |
| 42 | …1554 | 9/28/2026 | $40.43 | 8 | Sanskar Lamsal | $40.35 | 8¢ | done |
| 43 | …8172 | 11/4/2026 | $118.77 | 22 | Hello | $118.51 | 26¢ | done |
| 44 | …7184 | 11/18/2026 | $97.21 | 20 | Housemate A | $96.98 | 23¢ | done |
| 45 | …8882 | 10/30/2026 | $136.15 | 14 | Housemate B | $136.02 | 13¢ | done |
| 47 | …7651 | 11/4/2026 | $0.00 | 0 | Housemate D | $0.00 | 0¢ | done |
| 48 | …8031 | 11/11/2026 | $137.30 | 18 | Sanskar Lamsal | $137.03 | 27¢ | done |
| 49 | …5988 | 11/15/2026 | $84.43 | 21 | Hello | $84.17 | 26¢ | done |
| 50 | …6729 | 11/19/2026 | $106.96 | 22 | Housemate A | $106.80 | 16¢ | done |
