// Records the captioned demo video in docs/demo. Skipped in normal test runs.
//
//   pnpm dev                                   # local app on :3000
//   pnpm --filter extension build:local
//   cd e2e && DEMO=1 npx playwright test demo-video
//   ../tools/make-demo-video.sh                # stitches the clips (in .demo-clips) into docs/demo/*.mp4 + *.gif
//
// Uses the anonymized Walmart fixture served on a fake walmart.com, so no real order data is shown.
import { test, expect, chromium, type BrowserContext, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadFixture, orderPageHtml } from "./fake-walmart";

test.skip(!process.env.DEMO, "set DEMO=1 to record the demo video");

const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXT = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const OUT = path.resolve(import.meta.dirname, "../.demo-clips");
const SIZE = { width: 1280, height: 800 };
const order = loadFixture("substituted-49-items");
const ORDER_URL = `https://www.walmart.com/orders/${order.id}`;
const run = Date.now().toString(36);

// ---------- clip bookkeeping: each tab records its own video; we log which tab is on screen when ----------
type Seg = { page: Page; from: number; to?: number };
const born = new Map<Page, number>();
const segs: Seg[] = [];
const track = (p: Page) => { born.set(p, Date.now()); return p; };
function show(p: Page) {
  const now = Date.now();
  const last = segs.at(-1);
  if (last && last.page === p) return;
  if (last) last.to = now;
  segs.push({ page: p, from: now });
}

// ---------- on-screen captions and a visible cursor ----------
const OVERLAY = `
  (() => {
    if (document.getElementById('demo-cap')) return;
    const css = document.createElement('style');
    css.textContent = \`
      #demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:1000px;
        background:rgba(17,24,39,.92);color:#fff;font:600 22px/1.35 -apple-system,system-ui,sans-serif;padding:14px 26px;
        border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center;transition:opacity .25s;pointer-events:none}
      #demo-cap small{display:block;font-weight:500;font-size:16px;opacity:.75;margin-top:4px}
      #demo-cap:empty{opacity:0}
      #demo-cur{position:fixed;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(255,196,0,.55);border:2px solid #f59e0b;z-index:2147483647;pointer-events:none;
        transition:left .55s cubic-bezier(.3,.7,.2,1),top .55s cubic-bezier(.3,.7,.2,1),transform .15s}
      #demo-cur.down{transform:scale(.7)}\`;
    document.documentElement.appendChild(css);
    const cap = document.createElement('div'); cap.id = 'demo-cap'; document.documentElement.appendChild(cap);
    const cur = document.createElement('div'); cur.id = 'demo-cur'; document.documentElement.appendChild(cur);
  })()`;
const overlay = (p: Page) => p.evaluate(OVERLAY);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function say(p: Page, text: string, sub = "", hold = 2600) {
  await overlay(p);
  await p.evaluate(([t, s]) => { document.getElementById("demo-cap")!.innerHTML = t ? `${t}${s ? `<small>${s}</small>` : ""}` : ""; }, [text, sub]);
  await pause(hold);
}
async function tap(l: Locator, hold = 450) {
  const p = l.page();
  await overlay(p);
  await l.scrollIntoViewIfNeeded();
  const b = (await l.boundingBox())!;
  await p.evaluate(([x, y]) => { const c = document.getElementById("demo-cur")!; c.style.left = `${x}px`; c.style.top = `${y}px`; }, [b.x + b.width / 2, b.y + b.height / 2]);
  await pause(600);
  await p.evaluate(() => document.getElementById("demo-cur")!.classList.add("down"));
  await pause(120);
  await l.click();
  await p.evaluate(() => document.getElementById("demo-cur")?.classList.remove("down")).catch(() => {});
  await pause(hold);
}
async function typeIn(l: Locator, text: string) {
  await tap(l, 100);
  await l.pressSequentially(text, { delay: 55 });
  await pause(300);
}
async function card(p: Page, title: string, sub: string, hold = 3200) {
  await p.setContent(`<html><body style="margin:0;overflow:hidden"><div style="position:fixed;inset:0;display:grid;place-items:center;background:linear-gradient(135deg,#0f766e,#134e4a);
    font-family:-apple-system,system-ui,sans-serif;color:#fff;text-align:center"><div><div style="font-size:64px">🧾</div>
    <h1 style="font-size:54px;margin:12px 0 10px">${title}</h1><p style="font-size:24px;opacity:.85;margin:0">${sub}</p></div></div></body></html>`);
  await pause(hold);
}

let ctx: BrowserContext;
test.beforeAll(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-demo-")), {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    viewport: SIZE,
    recordVideo: { dir: OUT, size: SIZE },
  });
  await ctx.route("https://www.walmart.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === `/orders/${order.id}`) return route.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(order) });
    return route.fulfill({ status: 404, body: "not found" });
  });
});

test("record the demo", async () => {
  test.setTimeout(10 * 60_000);
  const app = track(await ctx.newPage()); // a fresh tab: the persistent context's first tab records from before launch settles
  await Promise.all(ctx.pages().filter((p) => p !== app).map((p) => p.close()));
  await card(app, "Bill Split", "Split shared costs — and Walmart orders item by item", 300);
  show(app);
  await pause(3200);

  // 1. Sign in + create a group
  await app.goto(`${APP}/signin?dev=1`);
  await say(app, "Sign in with your Google account", "(this demo uses a local test account)", 1800);
  await typeIn(app.locator('input[name="name"]'), "Jordan");
  await typeIn(app.locator('input[name="email"]'), `jordan+${run}@example.com`);
  await tap(app.getByText("Dev sign in"));
  await app.waitForURL(`${APP}/`);
  await say(app, "Create a group for the people you share costs with", "Add your roommates by name — they can join later", 2200);
  await typeIn(app.locator('input[placeholder="Apartment 4B"]'), "Apartment 4B");
  await typeIn(app.locator('input[placeholder="Ayush, Nishant"]'), "Sam, Priya");
  await tap(app.getByText("Create group"));
  await app.waitForURL(/\/g\//);
  const groupUrl = app.url().split("?")[0];
  await app.goto(`${groupUrl}?tab=members`);
  await expect(app.getByTestId("invite-link")).toContainText("/join/");
  await say(app, "Share the invite link", "When Sam and Priya open it, they pick their name and join", 3000);

  // 2. A regular expense
  await app.goto(`${groupUrl}/new`);
  await say(app, "Add everyday expenses in seconds", "Split equally, by parts, or by exact amounts", 1600);
  await typeIn(app.locator("#amount"), "60");
  await typeIn(app.locator('input[name="title"]'), "Internet bill");
  await tap(app.getByTestId("save-expense"), 900);

  // 3. A Walmart order through the extension
  const walmart = track(await ctx.newPage());
  show(walmart);
  await walmart.goto(ORDER_URL);
  const btn = walmart.locator("#billsplit-process-btn");
  await expect(btn).toBeVisible({ timeout: 15000 });
  await say(walmart, "Now a Walmart order: open it on walmart.com", "The Bill Split extension adds a “Split this order” button", 3000);
  const procP = ctx.waitForEvent("page");
  await tap(btn, 0);
  const proc = track(await procP);
  await proc.waitForLoadState();
  await expect(proc.getByTestId("item-card")).toBeVisible();
  show(proc);
  await say(proc, "Every item, one card at a time", "The order is read straight from Walmart and checked against the total to the cent", 3400);
  await say(proc, "Tap who shares this item", "", 600);
  await tap(proc.getByTestId("member-Jordan"));
  await tap(proc.getByTestId("member-Sam"), 900);
  await tap(proc.getByTestId("next"));
  await say(proc, "“Everyone” for shared stuff", "", 400);
  await tap(proc.getByTestId("all"), 800);
  await tap(proc.getByTestId("next"));
  await say(proc, "Uneven? Split by parts or by amount", "", 400);
  await tap(proc.getByTestId("same-as-last"));
  await tap(proc.getByRole("radio", { name: "By parts" }));
  await tap(proc.getByLabel("more parts for Priya"), 1200);
  await tap(proc.getByTestId("next"));
  await say(proc, "Or fly through with the keyboard", "1, 2, 3 pick people · Enter goes to the next item", 500);
  for (let i = 3; !(await proc.getByTestId("review").isVisible()); i++) {
    await proc.keyboard.press(String((i % 3) + 1));
    await pause(250);
    await proc.keyboard.press("Enter");
    await pause(450);
  }
  await say(proc, "Review: who paid, and everyone's total", "Tax and fees are split in proportion by default", 1200);
  await tap(proc.getByTestId("payer"), 0);
  await proc.getByTestId("payer").selectOption({ label: "Sam" });
  await pause(1600);
  await say(proc, "Send it to the group", "", 400);
  await tap(proc.getByTestId("submit"));
  await expect(proc.getByTestId("done")).toBeVisible();
  await pause(1500);

  // 4. Back in the app
  show(app);
  await app.goto(`${groupUrl}?tab=expenses`);
  await say(app, "The order shows up as one expense", "", 2200);
  await tap(app.getByText("Walmart order").first());
  await app.waitForURL(/\/e\//);
  await say(app, "With every item and who shares it", "Anyone in the group can fix an assignment — every change lands in Activity", 3200);
  await app.mouse.wheel(0, 700);
  await pause(1800);
  await app.goto(`${groupUrl}?tab=balances`);
  await say(app, "Balances update automatically", "", 2800);
  await app.goto(`${groupUrl}?tab=settle`);
  await expect(app.getByTestId("settle-up")).toBeVisible();
  await say(app, "Settle up with one tap when someone pays you back", "", 1400);
  await tap(app.locator(".pay-card").first().getByTestId("mark-paid"), 2200);
  await say(app, "", "", 0);
  await card(app, "Bill Split", "bsplit.vercel.app", 3000);
  segs.at(-1)!.to = Date.now();
});

test.afterAll(async () => {
  const pages = [...born.keys()];
  await ctx?.close(); // flushes the videos
  const clips = await Promise.all(segs.map(async (s) => ({
    video: await s.page.video()!.path(),
    from: (s.from - born.get(s.page)!) / 1000,
    to: (s.to! - born.get(s.page)!) / 1000,
  })));
  fs.writeFileSync(path.join(OUT, "segments.json"), JSON.stringify(clips, null, 1));
  console.log(`recorded ${pages.length} tabs, ${clips.length} segments → ${OUT}/segments.json`);
});
