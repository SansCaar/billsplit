# 🧾 Bill Split

**Split shared costs with the people you live with, and split Walmart orders item by item so everyone pays for exactly what they used.**

Open the app at **[bsplit.vercel.app](https://bsplit.vercel.app)**.

![Bill Split demo: create a group, add an expense, split a Walmart order item by item, settle up](docs/demo/billsplit-demo.gif)

▶️ [Watch the full demo video (1.5 min, with captions)](docs/demo/billsplit-demo.mp4)

---

## What it does

- **Groups for your household.** Create a group, add your roommates by name, and share one invite link. Each person joins and picks their name.
- **Everyday expenses in seconds.** Rent, internet, pizza. Split **equally**, **by parts** (for example, 2 shares for one person, 1 for another), or **by exact amounts**.
- **Walmart orders, one item at a time.** With the Chrome extension, open any order on walmart.com and click **🧾 Split this order**. Bill Split shows each item as a card and you tap who shared it. Tax and fees split themselves.
- **Always know who owes whom.** Balances update as soon as anything changes. **Settle up** suggests the fewest payments needed to get everyone to $0.
- **Every change on record.** If someone edits an expense, the **Activity** feed shows who changed what, when, and how it affected each person's share.

---

## Getting started

### 1. Sign in

Go to **[bsplit.vercel.app](https://bsplit.vercel.app)** and choose **Continue with Google**. There's no password to set up. It works on your phone and on your computer.

### 2. Create your group

On **Your groups**, give the group a name (like *Apartment 4B*) and type your housemates' names, separated by commas. They don't need accounts yet: you can start adding expenses for them right away.

### 3. Invite everyone

Open the group's **Settings** tab and copy the **invite link**. Send it however you like (text, WhatsApp, email). When a housemate opens it, they sign in, choose **"I'm …"** to claim the name you added, and they're in, with their balance already up to date.

> Anyone in the group can share the invite link. Only the person who created the group can turn it off.

---

## Everyday use

### Add an expense

In your group, click **Add expense**:

1. Enter the **amount** and **what it was for**.
2. Choose **who paid** (you by default) and the date.
3. Under **Split between**, pick who shares it and how:
   - **Equally:** everyone ticked pays the same.
   - **By parts:** use **+ / −** to give someone more shares (say, someone who has the bigger room).
   - **By amount:** type exactly what each person owes.
4. Click **Add**.

If an amount doesn't divide evenly, the leftover cent or two shows on the expense as *rounding left over* and isn't added to anyone's share, so nobody silently pays extra.

### Check balances

The **Balances** tab shows what you're owed (or what you owe) and where everyone in the group stands.

### Settle up

When someone pays you back (Venmo, Zelle, cash, anything outside the app):

- Open **Settle up** and tap **Mark paid** next to their name if they paid the full amount.
- Tap **Other amount** if they paid part of it.
- Tap **Something else?** to record any other payment between any two people.

Made a mistake? Each recorded payment has an **Undo**.

### See what changed

The **Activity** tab lists every change in the group: new expenses, edits, payments, re-processed orders. Each entry shows who made the change and how it moved each person's balance.

---

## Splitting Walmart orders

This is what Bill Split is built for. A 40-item grocery order becomes a fair split in about a minute.

### Install the Chrome extension (one time)

You need **Google Chrome** on a Mac.

▶️ [Watch the install guide video](docs/demo/install-guide.mp4)

1. Open **Terminal** and paste:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | zsh
   ```

   This downloads the latest extension into a folder called **Bill Split Extension** in your home folder.

   > While the repository is private, use this version instead. It needs the [GitHub CLI](https://cli.github.com) signed in with access to the repo:
   > ```sh
   > curl -fsSL -H "Authorization: Bearer $(gh auth token)" https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | zsh
   > ```

2. In Chrome, go to **`chrome://extensions`**.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the **Bill Split Extension** folder in your home folder.
5. Optional: pin the 🧾 icon from Chrome's puzzle-piece menu.

**Updating:** run the same Terminal command again, then click the ↻ (reload) button on the Bill Split card in `chrome://extensions`.

### Split an order

1. Go to **[walmart.com/orders](https://www.walmart.com/orders)** and open an order.
2. Click the green **🧾 Split this order** button at the bottom right of the page.
   The first time, Bill Split asks you to sign in. Do that, then return to the order tab.
3. Pick the **group** at the top. Bill Split reads the whole order, opening every collapsed section for you, and checks that it adds up to Walmart's total **to the cent**.
4. Each item appears as a card. **Tap who shares it**, then **Next**:
   - **Everyone:** everyone in the group shares the item.
   - **Same as last:** reuses the people from the previous item.
   - **By parts / By amount:** for items that aren't shared evenly.
   - **Skip:** come back to an item later.
5. On the **Review** screen:
   - Choose **who paid** for the order.
   - Choose how **tax** is split. *Proportional* (the default) means people who bought more pay more tax. *Equal* splits it evenly.
   - Choose how **fees** (delivery, tip, bag fee) are split: *Equal* (the default) or *Proportional*.
   - Check each person's total, then click **Send to group**.

The order shows up in the group as one expense, listing every item and who shares it.

#### Keyboard shortcuts

On a computer, you can go through a big order without touching the mouse:

| Key | Does |
| --- | --- |
| `1`, `2`, `3` … | Add or remove that person (in the order they're listed) |
| `Enter` | Next item |

### What Bill Split handles for you

- **Substitutions** are labeled and keep the name of the item you ordered.
- **Out-of-stock, canceled and returned items** count as $0, so nobody pays for them.
- **Weight-adjusted items** (produce, meat) use the price you were actually charged.
- **Refunds:** when Walmart refunds an item, the refunded tax comes off the tax too.
- **Orders with several deliveries** (shipped plus delivered from store) and their separate fees are all read.

### When an order changes later

If Walmart refunds something after you've split the order, open the order again and click **Split this order**. Bill Split recognizes the order, **shows what changed**, and keeps every assignment you already made. Click **Update in group**. The expense is updated instead of duplicated, and the change appears in Activity.

### Fixing an assignment

Anyone in the group can correct a split. Open the expense, click **Fix assignments** (or **Edit expense** for a regular expense), tap the item to change it, and save. Everyone sees the change in **Activity**, including whose share went up or down.

---

## FAQ

**Do my housemates need the extension?**
No. Only the person splitting a Walmart order needs it. Everyone else just uses the website, on any phone or computer.

**Does it work on my phone?**
The website does: add expenses, check balances and settle up from your phone. Splitting Walmart orders needs Chrome on a computer.

**Does Bill Split move money?**
No. It keeps track of who owes whom. You pay each other however you normally do, then record it under **Settle up**.

**What does the extension have access to?**
It only runs on walmart.com, and only reads an order when you click **Split this order**. It sends the order to your Bill Split group. It doesn't change anything on Walmart.

**Someone left the group. What happens to their balance?**
A member can be removed (or can leave) from **Settings** once their balance is $0. Settle up first.

**I see "rounding left over" on an expense.**
When an amount doesn't divide evenly, the extra cent or two stays visible on the expense instead of being quietly added to someone's share.

---

## For developers

Setup, architecture, deployment, tests and how the demo video is recorded: **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.
