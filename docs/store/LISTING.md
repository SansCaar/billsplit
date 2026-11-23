# Chrome Web Store submission

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) for the extension.
Live listing: https://chromewebstore.google.com/detail/bill-split-%E2%80%94-walmart-orde/peofoamjcchmjmpilpnnhoolcccabjhk
Images in this folder are rendered from anonymized fixture data by `e2e/store-shots.spec.ts` (`STORE=1`).

## Package

Upload the release zip as-is: [billsplit-extension-0.1.5.zip](https://github.com/SansCaar/billsplit/releases/download/ext-v0.1.5/billsplit-extension-0.1.5.zip).
Name and summary come from its manifest:

- **Name:** Bill Split — Walmart orders
- **Summary:** Split a Walmart order item by item with your group.

## Store listing tab

**Description**

```
Split a Walmart order fairly, item by item, in about a minute.

Bill Split adds a "Split this order" button to your walmart.com order pages. Click it, and every item in the order shows up one card at a time. Tap who had each item and move on. Shared things go to everyone in one tap, and uneven splits work by parts or by exact amount. Number keys and Enter make it even faster.

Tax is split in proportion to what each person had and delivery fees equally (you can change either), and the totals match the Walmart order to the cent. Substitutions, weight-adjusted items, refunds and unavailable items are all handled.

When you're done, the order lands in your Bill Split group as one expense, with every item and who shares it. Everyone in the group sees the same balances, and anyone can fix an assignment later. Every change is recorded in the group's activity.

Bill Split is also a full shared-expense app for households, trips and teams:
• Add everyday expenses (rent, internet, pizza) and split equally, by parts or by amount
• See who owes whom at a glance
• Settle up with the fewest payments
• Invite housemates with a link. They don't need the extension, just the website

How to use it:
1. Sign in at https://bsplit.vercel.app with Google and create a group.
2. Open any order at walmart.com/orders and click "Split this order".
3. Pick the group, assign the items, and send.

Free and open source: https://github.com/SansCaar/billsplit
Bill Split isn't affiliated with Walmart.
```

- **Category:** Shopping (or Productivity → Tools if Shopping isn't offered)
- **Language:** English (United States)
- **Store icon (128×128):** `apps/extension/public/icon128.png`
- **Screenshots (1280×800):** `screenshot-1-assign.png`, `screenshot-2-review.png`, `screenshot-3-expense.png`, `screenshot-4-balances.png`
- **Small promo tile (440×280):** `promo-small-440x280.png`
- **Marquee promo tile (1400×560, optional):** `promo-marquee-1400x560.png`
- **Official URL:** leave empty, or the site once its domain is verified in Search Console
- **Homepage URL:** https://bsplit.vercel.app
- **Support URL:** https://github.com/SansCaar/billsplit/issues

## Privacy tab

**Single purpose**

```
Split a Walmart order item by item among the members of a Bill Split group: the extension reads the order page the user opens and sends its items and totals to the user's Bill Split group.
```

**Permission justifications**

| Field | Text |
|---|---|
| `storage` | `Keeps the order the user just opened on this computer until it is assigned, and remembers the last Bill Split group the user picked.` |
| `tabs` | `When the user clicks the toolbar button, the extension reads the current tab's URL to check whether it is a Walmart order page (and opens walmart.com/orders if not). It also opens the splitting page next to the order, and opens and later closes the Bill Split sign-in tab.` |
| Host permission | `walmart.com: adds the "Split this order" button to order pages and reads the order the user is viewing. bsplit.vercel.app: sends the order to the user's Bill Split group and loads the user's groups.` |
| Remote code | **No, I am not using remote code.** |

**Data usage.** Tick these two:

- **Financial and payment information**: order totals, item prices, and the card brand and last 4 digits shown on the order
- **Website content**: the items, names and pictures on the Walmart order page

Leave the rest unticked. Then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://bsplit.vercel.app/privacy

## Distribution tab

- **Payments:** free
- **Visibility:** Public (or Unlisted for a soft launch)
- **Regions:** all regions, or just the United States since it's walmart.com only

## Test instructions tab

Reviewers need a Walmart order to try the button. Suggested text:

```
The extension only acts on walmart.com order details pages (walmart.com/orders/<number>), which need a Walmart account with a past order. To see the full flow without one, watch the demo video: https://github.com/SansCaar/billsplit/blob/main/docs/demo/billsplit-demo.mp4
The web app (https://bsplit.vercel.app) works with any Google account: sign in, create a group, then click "Split this order" on an order page.
```
