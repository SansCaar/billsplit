import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadFixture, orderPageHtml, withRefund } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXT = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const SHOTS = path.resolve(import.meta.dirname, "../proof/e2e");
fs.mkdirSync(SHOTS, { recursive: true });
let n = 0;
const shot = async (p: Page, name: string) => p.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true, animations: "disabled" });

const run = Date.now().toString(36);
const sanskar = { name: "Sanskar", email: `sanskar+${run}@example.com` };
const ayush = { name: "Ayush", email: `ayush+${run}@example.com` };

async function devSignIn(page: Page, u: { name: string; email: string }) {
  await page.goto(`${APP}/signin?dev=1`);
  await page.fill('input[name="name"]', u.name);
  await page.fill('input[name="email"]', u.email);
  await page.click("text=Dev sign in");
  await page.waitForURL(`${APP}/`);
}

let ctx: BrowserContext;
let walmartOrder = loadFixture("substituted-49-items");
const ORDER_URL = `https://www.walmart.com/orders/${walmartOrder.id}`;

test.beforeAll(async () => {
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-e2e-")), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: { width: 1280, height: 860 },
  });
  // Serve walmart.com order pages from the anonymized real-order fixture; block everything else on walmart.com.
  await ctx.route("https://www.walmart.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === `/orders/${walmartOrder.id}`) return route.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(walmartOrder) });
    return route.fulfill({ status: 404, body: "not found" });
  });
});
test.afterAll(async () => ctx?.close());

test("process a Walmart order through the extension, fix it as another member, then re-process", async () => {
  // 1) Sanskar signs in and creates the household with placeholder members.
  const app = await ctx.newPage();
  await devSignIn(app, sanskar);
  await app.fill('input[placeholder="Apartment 4B"]', `Apartment ${run}`);
  await app.fill('input[placeholder="Ayush, Nishant"]', "Ayush, Nishant");
  await app.click("text=Create group");
  await app.waitForURL(/\/g\//);
  const groupUrl = app.url().split("?")[0];
  await expect(app.getByTestId("group-name")).toHaveText(`Apartment ${run}`);
  await app.goto(`${groupUrl}?tab=members`);
  await expect(app.getByTestId("invite-link")).toContainText("/join/");
  const invite = (await app.getByTestId("invite-link").innerText()).trim();
  await shot(app, "group-created");

  // 2) On the Walmart order page, the extension adds a button; clicking it reads + parses the order.
  const walmart = await ctx.newPage();
  await walmart.goto(ORDER_URL);
  const btn = walmart.locator("#billsplit-process-btn");
  await expect(btn).toBeVisible({ timeout: 15000 });
  await expect(walmart.locator('[data-testid="productName"]').first()).toBeHidden(); // sections start collapsed
  await shot(walmart, "walmart-order-page-with-button");
  const [proc] = await Promise.all([ctx.waitForEvent("page"), btn.click()]);
  // The extension expanded every collapsed section on the page before cross-checking.
  await expect(walmart.locator('[data-testid="productName"]').first()).toBeVisible();
  expect(await walmart.locator('main button[aria-expanded="false"]').count()).toBe(0);
  await shot(walmart, "walmart-sections-expanded-by-extension");

  // 3) Processing tab: one item card at a time.
  await proc.waitForLoadState();
  await expect(proc.getByTestId("order-meta")).toContainText(`Walmart #${walmartOrder.id}`);
  await expect(proc.getByTestId("order-meta")).toContainText("$53.22");
  await expect(proc.getByTestId("order-meta")).toContainText("•••• 4242");
  await expect(proc.getByTestId("warnings")).toHaveCount(0);
  await expect(proc.getByTestId("item-card")).toBeVisible();
  await expect(proc.getByTestId("next")).toBeDisabled(); // nobody assigned yet
  await shot(proc, "processing-first-card");

  const cards = 15;
  // Card 1: tap Sanskar and Ayush (equal split by default).
  await proc.getByTestId("member-Sanskar").click();
  await proc.getByTestId("member-Ayush").click();
  await expect(proc.locator(".bs-share-row")).toHaveCount(2);
  await shot(proc, "card-assigned-two-people");
  await proc.getByTestId("next").click();
  // Card 2: "All" button.
  await proc.getByTestId("all").click();
  await expect(proc.locator(".bs-share-row")).toHaveCount(3);
  await proc.getByTestId("next").click();
  // Card 3: "Same as last" (everyone), then switch to By parts and give Nishant 2 parts.
  await proc.getByTestId("same-as-last").click();
  await proc.getByRole("radio", { name: "By parts" }).click();
  await proc.getByLabel("more parts for Nishant").click();
  await shot(proc, "card-by-parts");
  await proc.getByTestId("next").click();
  // Card 4: By amount — exceeding the price blocks Next.
  await proc.getByTestId("member-Nishant").click();
  await proc.getByTestId("member-Sanskar").click();
  await proc.getByRole("radio", { name: "By amount" }).click();
  await proc.getByLabel("amount for Nishant").fill("999");
  await expect(proc.locator(".bs-error")).toBeVisible();
  await expect(proc.getByTestId("next")).toBeDisabled();
  await proc.getByRole("radio", { name: "Equally" }).click();
  await proc.getByTestId("next").click();
  // Remaining cards via keyboard: 1..3 toggle members, Enter = next.
  for (let i = 4; i < cards; i++) {
    await proc.keyboard.press(String((i % 3) + 1));
    await proc.keyboard.press("Enter");
  }
  // Review screen
  await expect(proc.getByTestId("review")).toBeVisible();
  await expect(proc.getByTestId("review")).toContainText("All assigned");
  await expect(proc.getByTestId("submit")).toBeEnabled();
  await proc.getByTestId("payer").selectOption({ label: "Ayush" });
  await expect(proc.getByTestId("tax-rule")).toHaveValue("proportional");
  const totals = await proc.getByTestId("member-totals").innerText();
  await shot(proc, "review-screen");
  await proc.getByTestId("submit").click();
  await expect(proc.getByTestId("done")).toBeVisible();
  await shot(proc, "sent-to-group");

  // 4) The expense is in the web app with correct totals.
  await app.goto(`${groupUrl}?tab=expenses`);
  await expect(app.getByTestId("expenses")).toContainText("Walmart order");
  await expect(app.getByTestId("expenses")).toContainText(`#…${walmartOrder.id.slice(-4)}`);
  await expect(app.getByTestId("expenses")).toContainText("Ayush paid");
  await shot(app, "group-with-walmart-expense");
  await app.getByText("Walmart order").first().click();
  await app.waitForURL(/\/e\//);
  const expenseUrl = app.url();
  const shares = await app.getByTestId("shares").innerText();
  for (const who of ["Sanskar", "Ayush", "Nishant"]) expect(totals).toContain(who);
  const money = (s: string) => [...s.matchAll(/\$(\d+\.\d\d)/g)].map((m) => Math.round(parseFloat(m[1]!) * 100));
  const shareSum = money(shares).reduce((a, b) => a + b, 0);
  expect(shareSum).toBeLessThanOrEqual(5322);
  expect(shareSum).toBeGreaterThanOrEqual(5322 - 10); // only rounding leftovers are unassigned
  await expect(app.getByTestId("items")).toContainText("Fresh Honeycrisp Apple");
  await expect(app.getByTestId("items")).toContainText("substituted");
  await shot(app, "expense-detail");

  // 5) Ayush joins with the invite link (claiming his placeholder) and fixes an item from his own session.
  const ayushCtx = await chromium.launch({ channel: "chromium" }).then((b) => b.newContext({ viewport: { width: 420, height: 900 } }));
  const phone = await ayushCtx.newPage();
  await devSignIn(phone, ayush);
  await phone.goto(invite);
  await expect(phone.getByTestId("join")).toBeDisabled(); // nothing preselected
  await phone.getByTestId("claim-Ayush").click();
  await phone.getByTestId("join").click();
  await phone.waitForURL(/\/g\//);
  await phone.goto(phone.url().split("?")[0] + "?tab=balances");
  await expect(phone.getByTestId("balances")).toContainText("Ayush");
  await expect(phone.getByTestId("balances").locator(".bal-card.me")).toContainText("Ayush");
  await shot(phone, "ayush-joined-on-phone");
  await phone.goto(expenseUrl);
  await phone.getByTestId("edit").click();
  await expect(phone.getByTestId("review")).toBeVisible(); // fixing opens on the review list
  await phone.locator(".bs-table tr").first().click(); // jump straight to item 1
  await phone.getByTestId("member-Sanskar").click(); // remove Sanskar from item 1 → only Ayush
  await shot(phone, "ayush-fixing-assignment");
  await phone.getByTestId("back-to-review").click(); // one tap back to Review after a jump
  await expect(phone.getByTestId("review")).toBeVisible();
  await phone.getByTestId("submit").click();
  await expect(phone.getByTestId("activity")).toContainText("You changed who shares items in");
  await expect(phone.getByTestId("activity")).toContainText("Fresh Honeycrisp Apple");
  await expect(phone.locator(".impact").first()).toContainText("You");
  await shot(phone, "activity-after-ayush-edit");

  // 6) Walmart refunds an item later; re-processing shows the changes and keeps assignments.
  walmartOrder = withRefund(walmartOrder, "Great Value Penne Pasta, 16 oz");
  await walmart.goto(ORDER_URL);
  await expect(btn).toBeVisible();
  const [proc2] = await Promise.all([ctx.waitForEvent("page"), walmart.locator("#billsplit-process-btn").click()]);
  await proc2.waitForLoadState();
  await expect(proc2.getByTestId("already-processed")).toBeVisible();
  await expect(proc2.getByTestId("already-processed")).toContainText("Great Value Penne Pasta");
  await expect(proc2.getByTestId("already-processed")).toContainText("Tax:");
  await shot(proc2, "reprocess-shows-changes");
  // Assignments are prefilled, including Ayush's fix: the first card already has only Ayush.
  await expect(proc2.locator(".bs-share-row")).toHaveCount(1);
  await expect(proc2.locator(".bs-share-row")).toContainText("Ayush");
  for (let i = 0; i < cards - 1; i++) await proc2.keyboard.press("Enter"); // refunded item is $0 → skipped
  await expect(proc2.getByTestId("review")).toContainText("All assigned");
  await expect(proc2.getByTestId("submit")).toHaveText("Update in group");
  await proc2.getByTestId("submit").click();
  await expect(proc2.getByTestId("done")).toContainText("Order updated in");

  await app.goto(`${groupUrl}?tab=expenses`);
  await expect(app.getByTestId("expenses").locator("li")).toHaveCount(1); // never duplicated
  await app.goto(expenseUrl);
  await expect(app.getByTestId("expense-amount")).not.toHaveText("$53.22");
  await expect(app.getByTestId("expense-amount")).toHaveText("$51.79");
  await expect(app.getByTestId("activity")).toContainText("You re-processed Walmart order");
  await expect(app.getByTestId("activity")).toContainText("Ayush changed who shares items in");
  await expect(app.getByTestId("activity")).toContainText("You split Walmart order");
  await expect(app.getByTestId("activity")).toContainText("was refunded");
  await shot(app, "expense-after-reprocess-with-activity");
  await ayushCtx.close();
});
