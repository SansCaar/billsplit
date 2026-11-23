# Bill Split: developer guide

Vocabulary lives in [GLOSSARY.md](../GLOSSARY.md); decisions in [docs/adr](adr). The user guide is the [README](../README.md).

```
packages/core        split math, balances, order diff, Walmart parser (pure TS, unit-tested)
packages/assign-ui   the one-item-at-a-time assignment screen (shared by extension + web)
apps/web             Next.js app: groups, invites, expenses, settlements, activity (MongoDB)
apps/extension       Chrome extension (MV3): "Split this order" on walmart.com order pages
e2e                  Playwright: extension + web app end to end
tools                fixture anonymizer, demo-video script
proof                test screenshots. Real order data stays in proof/raw, which is git-ignored
```

## Run locally

```sh
pnpm install
pnpm dev                 # web app on http://localhost:3000 + a local MongoDB in apps/web/.data
pnpm build:ext           # builds apps/extension/dist, pointed at the hosted app
pnpm --filter extension build:local   # same, pointed at http://localhost:3000
pnpm --filter extension build:dev     # hosted app, plus access to localhost and *.vercel.app previews
```

Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist`.
Open any order at walmart.com/orders → click **🧾 Split this order**.

Notifications: put VAPID keys in `apps/web/.env.local` (git-ignored) to send real pushes locally. Generate them with
`node --input-type=module -e 'import {generateVAPIDKeys} from "web-push"; console.log(generateVAPIDKeys())'` from `apps/web`,
and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT=https://bsplit.vercel.app`. Without them the app
works normally and simply sends nothing. Push works on `http://localhost` without HTTPS.

Sign-in: locally there is a dev sign-in (name + email) at `/signin?dev=1`. For Google, set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
(redirect URI `http://localhost:3000/api/auth/callback/google`). Set `MONGODB_URI` to use a real MongoDB.

## Extension releases

Users install the extension from the Chrome Web Store; the listing URL is `EXTENSION_STORE_URL` in
`apps/web/lib/extension.ts`, used by the landing page and `/extension` (the README links to `/extension`).

Publish a new version:

1. Bump `version` in `apps/extension/public/manifest.json` and merge.
2. `git tag -m "Bill Split extension <version>" ext-v<version> && git push origin ext-v<version>`.
   The GitHub Action builds the extension and attaches `billsplit-extension-<version>.zip` to a release.
3. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), open Bill Split → **Package** →
   **Upload new package**, pick that zip and submit for review. Listing text and images: `docs/store/LISTING.md`.

## Deploy (Vercel)

Hosted at https://bsplit.vercel.app, with the older https://billsplit-indol.vercel.app still working (Vercel project `billsplit`, root directory `apps/web`, MongoDB Atlas).

Env vars (production + preview): `MONGODB_URI`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`AUTH_TRUST_HOST=true`, plus `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` for notifications
(keep the same keys forever: changing them silently breaks every device that turned notifications on). Leave `DEV_LOGIN` unset so only Google sign-in exists. The Google OAuth client needs the
redirect URIs `https://bsplit.vercel.app/api/auth/callback/google` and `https://billsplit-indol.vercel.app/api/auth/callback/google`.

### Pull request previews

Every pull request gets its own preview deploy. Vercel comments the link on the PR and updates it on each push, and
the **CI** check runs typecheck + unit tests. Test there, then merge; merging to `main` deploys production.

- Previews use a separate database (`MONGODB_DB=billsplit-preview`, preview env only), so testing never touches real data.
- Google sign-in works on preview URLs through `AUTH_REDIRECT_PROXY_URL=https://bsplit.vercel.app/api/auth`
  (production + preview): Google only ever sees the production callback, which bounces the sign-in back to the preview.
  This needs the same `AUTH_SECRET` in production and preview.
- Preview links sit behind Vercel login (Deployment Protection), so only accounts on the Vercel team can open them.

Deploy from the repo root: `npx vercel deploy --prod` (`.vercelignore` keeps proof data and node_modules out).
The extension's default address is set at build time (`APP_URL`); it can still be changed in its Processing tab.
The Store build may only reach walmart.com and bsplit.vercel.app, so to point it at a preview deployment load a
`build:dev` build (or `APP_URL=https://<preview>.vercel.app pnpm --filter extension build`).

## Demo video

`docs/demo/billsplit-demo.mp4` (and the `.gif` in the README) is recorded by Playwright against the local app, using the
anonymized Walmart fixture on a fake walmart.com, so no real order data appears. To re-record after UI changes:

```sh
pnpm dev                                         # in one terminal
pnpm --filter extension build:local
cd e2e && DEMO=1 npx playwright test demo-video  # records each tab into .demo-clips
../tools/make-demo-video.sh                      # stitches docs/demo/billsplit-demo.mp4 + .gif (needs ffmpeg)
```

Captions are drawn on the page by the spec (`say(...)` calls in `e2e/demo-video.spec.ts`), so edit the text there.

## Test fixtures from real orders

`packages/core/test/fixtures/walmart` holds anonymized Walmart orders: only parser-relevant fields, fake order numbers,
no names, addresses or card details. To add one, save the order's `__NEXT_DATA__` JSON into `proof/raw` (git-ignored),
map it to a fixture name in `proof/raw/fixture-map.json`, and run `node tools/make-fixtures.mjs` from the repo root.
Never commit anything from `proof/raw`.

## Issues and labels

People file issues from the landing page's footer, which opens the forms in `.github/ISSUE_TEMPLATE`. Labels are defined in
`.github/labels.yml`; the **Sync labels** workflow applies that file whenever it changes on `main`.

| Group | Labels |
|---|---|
| Type | `bug`, `enhancement`, `question`, `documentation`, `accessibility` |
| Area | `area: website`, `area: extension`, `area: walmart orders`, `area: sign-in`, `area: installer` |
| Status (one at a time) | `status: needs triage` → `status: confirmed` → `status: in progress`; `status: blocked` |
| Priority (one at a time) | `priority: high`, `priority: medium`, `priority: low` |

Automation (`.github/workflows/issue-triage.yml`, `pr-labels.yml`):
- New issues get `status: needs triage`, and the form's "Where?" answer becomes an `area:` label.
- Adding a status or priority label removes the previous one in that group.
- `duplicate`, `invalid` or `wontfix` closes the issue as not planned; closing clears "needs triage" and "in progress".
- Pull requests get `area:` labels from the files they change (`.github/labeler.yml`).

Triage: set a priority, then swap `status: needs triage` for `status: confirmed` (or close it).

## Tests

```sh
pnpm -r test                         # core (37) + assign-ui (4) + web services and notifications (24)
cd e2e && npx playwright test        # extension end-to-end (needs `pnpm dev` and `build:local`)
cd e2e && npx playwright test push-notifications   # real Web Push through Google Chrome (needs VAPID keys + Chrome)
```

## How notifications work

Every Activity records its Involved Members (see GLOSSARY.md). After the response is sent (`after()` in `lib/db.ts`),
`lib/notify.ts` picks who to tell from each person's Notification Level, leaving out whoever made the change, and
`lib/push.ts` sends a Web Push message to each of their devices. `public/sw.js` shows it and opens the related page when
tapped. Nudges are Notifications only, never Activities ([ADR 0003](adr/0003-nudges-are-not-activities.md)); the preset
lines live in `lib/nudgeLines.ts` (append only: sent Nudges refer to lines by index).

## How Walmart orders are read

The content script fetches a fresh copy of the order page (Walmart is a single-page app, so in-page state can be stale),
reads Walmart's own order JSON from `__NEXT_DATA__`, then expands every collapsed section on the page and cross-checks
the visible item names against what it parsed. Unavailable, canceled and returned items count as $0; a refund's tax
portion is taken off the tax; substitutions keep the original item's name. Every parse is checked against Walmart's
charged total to the cent.
