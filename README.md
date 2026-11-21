# Bill Split (v0)

Split shared household costs, with itemized Walmart orders processed straight from walmart.com.
Vocabulary lives in [GLOSSARY.md](GLOSSARY.md); decisions in [docs/adr](docs/adr).

```
packages/core        split math, balances, order diff, Walmart parser (pure TS, unit-tested)
packages/assign-ui   the one-item-at-a-time assignment screen (shared by extension + web)
apps/web             Next.js app: groups, invites, expenses, settlements, activity (MongoDB)
apps/extension       Chrome extension (MV3): "Split this order" on walmart.com order pages
e2e                  Playwright: extension + web app end to end
tools                real-Chrome harness (AppleScript) + fixture anonymizer
proof                test evidence (screenshots, reports). proof/raw is git-ignored (real order data)
```

## Run locally

```sh
pnpm install
pnpm dev                 # web app on http://localhost:3000 + a local MongoDB in apps/web/.data
pnpm build:ext           # builds apps/extension/dist
```

Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist`.
Open any order at walmart.com/orders → click **🧾 Split this order**.

Sign-in: locally there is a dev sign-in (name + email). For Google, set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
(redirect URI `http://localhost:3000/api/auth/callback/google`). Set `MONGODB_URI` to use a real MongoDB.

## Deploy (Vercel)

Set `MONGODB_URI`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and leave `DEV_LOGIN` unset.
In the extension's Processing tab, change "Bill Split address" to the Vercel URL.

## Tests

```sh
pnpm -r test                         # core (37) + web services (11)
cd e2e && npx playwright test        # extension end-to-end (needs `pnpm dev` running)
```

## How Walmart orders are read

The content script fetches a fresh copy of the order page (Walmart is a single-page app, so in-page state can be stale),
reads Walmart's own order JSON from `__NEXT_DATA__`, then expands every collapsed section on the page and cross-checks
the visible item names against what it parsed. Unavailable, canceled and returned items count as $0; a refund's tax
portion is taken off the tax; substitutions keep the original item's name. Every parse is checked against Walmart's
charged total to the cent.
