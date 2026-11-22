// Chrome Web Store listing images: four 1280x800 screenshots, the 440x280 small promo tile and the
// 1400x560 marquee, written to docs/store. Skipped in normal test runs.
//
//   pnpm dev                                   # local app on :3000
//   pnpm --filter extension build:local
//   cd e2e && STORE=1 npx playwright test store-shots
//
// Uses the anonymized Walmart fixture served on a fake walmart.com, so no real order data is shown.
import { test, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadFixture, orderPageHtml } from "./fake-walmart";

test.skip(!process.env.STORE, "set STORE=1 to render the Chrome Web Store images");

const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXT = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const OUT = path.resolve(import.meta.dirname, "../docs/store");
const RAW = { width: 1280, height: 760 }; // UI captured at this size, then framed under a caption
const order = loadFixture("substituted-49-items");
const ORDER_URL = `https://www.walmart.com/orders/${order.id}`;
const run = Date.now().toString(36);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BRAND = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;`;
const MARK = (size: number) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.3}px;background:#f3f7f0;color:#245b47;box-shadow:0 8px 20px -8px rgba(0,0,0,.45);display:grid;place-items:center;font-weight:800;font-size:${size * 0.56}px;transform:rotate(-4deg);flex:none">b</div>`;

/** Writes a PNG of `html` rendered at exactly w x h. */
async function render(page: Page, file: string, w: number, h: number, html: string) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;${BRAND}">${html}</body></html>`);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: w, height: h } });
  console.log("wrote", file);
}

/** A 1280x800 Store screenshot: caption band on top, the real UI below in a browser-ish frame. */
async function framed(page: Page, file: string, shot: Buffer, title: string, sub: string) {
  const img = `data:image/png;base64,${shot.toString("base64")}`;
  await render(page, file, 1280, 800, `
    <div style="height:800px;background:radial-gradient(120% 120% at 0% 0%,#2e6b54,#245b47 45%,#12372b);display:flex;flex-direction:column;align-items:center">
      <div style="display:flex;align-items:center;gap:18px;padding:30px 0 22px;color:#fff">
        ${MARK(46)}
        <div><div style="font-size:30px;font-weight:800;letter-spacing:-.02em">${title}</div>
        <div style="font-size:18px;color:#c4d9c9;margin-top:4px">${sub}</div></div>
      </div>
      <div style="width:1120px;border-radius:14px 14px 0 0;overflow:hidden;box-shadow:0 30px 60px -20px rgba(0,0,0,.55);background:#fff;flex:1">
        <div style="height:30px;background:#eef1ee;display:flex;align-items:center;gap:7px;padding-left:14px">
          <i style="width:11px;height:11px;border-radius:50%;background:#f26d5f"></i><i style="width:11px;height:11px;border-radius:50%;background:#f5bd4f"></i><i style="width:11px;height:11px;border-radius:50%;background:#61c454"></i>
        </div>
        <img src="${img}" style="display:block;width:1120px">
      </div>
    </div>`);
}

let ctx: BrowserContext;
test.beforeAll(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-store-")), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: RAW,
  });
  await ctx.route("https://www.walmart.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === `/orders/${order.id}`) return route.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(order) });
    return route.fulfill({ status: 404, body: "not found" });
  });
});
test.afterAll(async () => { await ctx?.close(); });

test("store images", async () => {
  test.setTimeout(5 * 60_000);
  const shots: Record<string, Buffer> = {};
  const app = await ctx.newPage();

  // A group with a few everyday expenses so balances look lived-in
  await app.goto(`${APP}/signin?dev=1`);
  await app.fill('input[name="name"]', "Jordan");
  await app.fill('input[name="email"]', `jordan+${run}@example.com`);
  await app.getByText("Dev sign in").click();
  await app.waitForURL(`${APP}/`);
  await app.fill('input[placeholder="Apartment 4B"]', "Apartment 4B");
  await app.fill('input[placeholder="Ayush, Nishant"]', "Sam, Priya");
  await app.getByText("Create group").click();
  await app.waitForURL(/\/g\//);
  const groupUrl = app.url().split("?")[0];
  for (const [amount, title] of [["86.42", "Electricity — November"], ["60", "Internet"]]) {
    await app.goto(`${groupUrl}/new`);
    await app.fill("#amount", amount);
    await app.fill('input[name="title"]', title);
    await app.getByTestId("save-expense").click();
    await app.waitForURL((u) => !u.pathname.endsWith("/new"));
  }

  // The Walmart order page (the fake one is too bare to show)
  const walmart = await ctx.newPage();
  await walmart.goto(ORDER_URL);
  const btn = walmart.locator("#billsplit-process-btn");
  await expect(btn).toBeVisible({ timeout: 15000 });

  // 1-2. Assigning items, then the review
  const procP = ctx.waitForEvent("page");
  await btn.click();
  const proc = await procP;
  await proc.setViewportSize(RAW);
  await proc.waitForLoadState();
  await expect(proc.getByTestId("item-card")).toBeVisible();
  await proc.getByTestId("member-Jordan").click();
  await proc.getByTestId("member-Sam").click();
  await proc.getByTestId("next").click();
  await proc.getByTestId("all").click();
  await proc.getByTestId("next").click();
  await proc.getByTestId("member-Priya").click();
  await pause(500);
  shots.assign = await proc.screenshot();
  await proc.getByTestId("next").click();
  for (let i = 3; !(await proc.getByTestId("review").isVisible()); i++) {
    await proc.keyboard.press(String((i % 3) + 1));
    await proc.keyboard.press("Enter");
    await pause(120);
  }
  await proc.getByTestId("payer").selectOption({ label: "Sam" });
  await pause(500);
  shots.review = await proc.screenshot();
  await proc.getByTestId("submit").click();
  await expect(proc.getByTestId("done")).toBeVisible();

  // 3-4. The web app: the order as an expense, and balances
  await app.bringToFront();
  await app.goto(`${groupUrl}?tab=expenses`);
  await app.getByText("Walmart order").first().click();
  await app.waitForURL(/\/e\//);
  await pause(800);
  shots.expense = await app.screenshot();
  await app.goto(`${groupUrl}?tab=balances`);
  await pause(800);
  shots.balances = await app.screenshot();

  const out = await ctx.newPage();
  await framed(out, "screenshot-1-assign.png", shots.assign!, "Click “Split this order” on Walmart, then tap who had each item", "One card per item. Split equally, by parts or by amount");
  await framed(out, "screenshot-2-review.png", shots.review!, "Tax and fees split fairly", "Totals match the Walmart order to the cent");
  await framed(out, "screenshot-3-expense.png", shots.expense!, "Every item, on record", "The whole group sees who shares what, and every change");
  await framed(out, "screenshot-4-balances.png", shots.balances!, "Balances update by themselves", "Settle up with the fewest payments");

  const tile = (w: number, h: number, mark: number, title: number, sub: number) => `
    <div style="width:${w}px;height:${h}px;background:radial-gradient(120% 120% at 0% 0%,#2e6b54,#245b47 45%,#12372b);display:flex;align-items:center;justify-content:center;gap:${mark * 0.45}px;color:#fff">
      ${MARK(mark)}
      <div><div style="font-size:${title}px;font-weight:800;letter-spacing:-.03em;line-height:1.05">Bill Split</div>
      <div style="font-size:${sub}px;color:#c4d9c9;margin-top:${sub * 0.4}px;line-height:1.3">Split Walmart orders<br>item by item</div></div>
    </div>`;
  await render(out, "promo-small-440x280.png", 440, 280, tile(440, 280, 84, 44, 21));
  await render(out, "promo-marquee-1400x560.png", 1400, 560, tile(1400, 560, 170, 96, 40));
});
