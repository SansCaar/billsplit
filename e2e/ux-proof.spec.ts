// Before/after proof for the UX flow audit: walks each audited flow and screenshots the moments that changed.
// Run the same spec on old and new code: UX_TAG=before|after npx playwright test ux-proof
// Uses dev sign-in and the anonymized Walmart fixture on a fake walmart.com, so no real data appears.
import { test, chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadFixture, orderPageHtml } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXT = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const TAG = process.env.UX_TAG ?? "before";
const OUT = path.resolve(import.meta.dirname, "../proof/ux", TAG);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 860 };
const notes: Record<string, string> = {};

const sanskar = { name: "Sanskar", email: `sanskar+${run}@example.com` };
const ayush = { name: "Ayush", email: `ayush+${run}@example.com` };

async function signIn(page: Page, u: { name: string; email: string }) {
  await page.goto(`${APP}/signin?dev=1`);
  await page.fill('input[name="name"]', u.name);
  await page.fill('input[name="email"]', u.email);
  await page.click("text=Dev sign in");
  await page.waitForURL(`${APP}/`);
}
const api = (page: Page, p: string, method = "GET", body?: unknown) =>
  page.evaluate(async ([p, method, body]) => {
    const r = await fetch(p as string, { method: method as string, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  }, [p, method, body] as const);
const shot = async (page: Page, name: string, full = true) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full, animations: "disabled", caret: "initial" });
};
/** A native alert() can't be screenshotted headless: draw a faithful stand-in so the proof shows what users saw. */
const drawNativeAlert = (page: Page, text: string) =>
  page.evaluate((text) => {
    const d = document.createElement("div");
    d.setAttribute("style", "position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:2147483647;display:grid;place-items:start center;padding-top:16px;font:14px system-ui");
    d.innerHTML = `<div style="width:440px;background:#fff;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.3);padding:20px 22px"><div style="font-weight:600;margin-bottom:8px">${location.host} says</div><div style="white-space:pre-wrap"></div><div style="text-align:right;margin-top:18px"><span style="background:#1a73e8;color:#fff;border-radius:16px;padding:7px 18px">OK</span></div><div style="margin-top:10px;font-size:11px;color:#a00">[native browser alert() — recreated for the screenshot]</div></div>`;
    (d.querySelector("div div:nth-child(2)") as HTMLElement).textContent = text;
    document.body.appendChild(d);
  }, text);

let browser: Browser;
test.beforeAll(async () => { browser = await chromium.launch(); });
test.afterAll(async () => { await browser?.close(); fs.writeFileSync(path.join(OUT, "notes.json"), JSON.stringify(notes, null, 2)); });

test("ux proof: web flows", async () => {
  test.setTimeout(300_000);
  // ---- Flow A: a brand-new user creates a group through the form.
  const dctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
  const d = await dctx.newPage();
  await signIn(d, sanskar);
  await d.fill('input[placeholder="Apartment 4B"]', "Apartment 4B");
  await d.fill('input[placeholder="Ayush, Nishant"]', "Ayush, Nishant");
  await d.getByRole("button", { name: "Create group" }).click();
  await d.waitForURL(/\/g\/[^/?]+/);
  const newGroupUrl = d.url().split("?")[0]!;
  await shot(d, "a1-new-group-desktop");
  const state = await dctx.storageState();
  const pctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: state });
  const p = await pctx.newPage();
  await p.goto(newGroupUrl);
  await shot(p, "a2-new-group-phone");
  const fresh = await api(d, `/api/groups/${newGroupUrl.split("/").pop()}`);
  const inviteToken: string = (fresh.group ?? fresh).invite.token;

  // ---- Flow D seed: a group with real activity.
  const g = await api(d, "/api/groups", "POST", { name: "House on Elm", placeholderNames: ["Ayush", "Nishant"] });
  const [s, a, n] = g.members.map((m: { id: string }) => m.id);
  await api(d, `/api/groups/${g._id}/expenses`, "POST", { title: "Groceries", amount: 9000, payerId: a, split: { method: "equal", shares: [s, a, n].map((memberId) => ({ memberId })) } });
  await api(d, `/api/groups/${g._id}/expenses`, "POST", { title: "Internet", amount: 6000, payerId: s, split: { method: "equal", shares: [s, a, n].map((memberId) => ({ memberId })) } });
  await api(d, `/api/groups/${g._id}/expenses`, "POST", { title: "Pizza night", amount: 4500, payerId: s, split: { method: "equal", shares: [s, n].map((memberId) => ({ memberId })) } });
  await d.goto(`${APP}/g/${g._id}`);
  await shot(d, "d1-balances-desktop");
  await p.goto(`${APP}/g/${g._id}`);
  await shot(p, "d1-balances-phone");

  // Adding an everyday expense: where do you land?
  await d.goto(`${APP}/g/${g._id}/new`);
  await shot(d, "b1-new-expense-desktop");
  await d.goto(`${APP}/extension`);
  await shot(d, "b2-extension-page-desktop");
  await d.goto(`${APP}/g/${g._id}/new`);
  await d.fill("#amount", "84");
  await d.fill('input[name="title"]', "Electricity");
  await d.getByTestId("save-expense").click();
  await d.waitForURL((u) => !u.pathname.endsWith("/new"));
  await shot(d, "d2-after-add-expense-desktop");

  // Members / invite settings.
  await d.goto(`${APP}/g/${g._id}?tab=settings`);
  await shot(d, "d3-members-desktop");

  // Settle up on a phone: tap "Mark received" lower on the page; is there visible feedback?
  await p.goto(`${APP}/g/${g._id}?tab=settle`);
  const mark = p.getByTestId("mark-paid").first();
  await mark.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, 200));
  await mark.click();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, "d4-after-mark-paid-phone.png"), animations: "disabled" });

  // ---- Flow C: Ayush opens the invite to the new group (which has placeholders Ayush, Nishant).
  const actx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ap = await actx.newPage();
  await signIn(ap, ayush);
  await ap.goto(`${APP}/join/${inviteToken}`);
  await shot(ap, "c1-join-phone");
  const join = ap.getByTestId("join");
  if (await join.isEnabled()) {
    // The hurried path: tap the big button without reading the list.
    await join.click();
    await ap.waitForURL(/\/g\//);
    await ap.goto(`${newGroupUrl}?tab=settings`);
    notes.c2 = "Join was enabled with 'I'm someone new' preselected; tapping it added a duplicate member.";
    await shot(ap, "c2-hurried-join-result-phone");
  } else {
    notes.c2 = "Join stays disabled until the person picks who they are.";
    await shot(ap, "c2-hurried-join-result-phone");
  }

  // Invite to a group with no placeholders: how many taps after sign-in?
  const office = await api(d, "/api/groups", "POST", { name: "Office lunch" });
  await ap.goto(`${APP}/join/${office.invite.token}`);
  await ap.waitForLoadState("networkidle");
  await shot(ap, "c3-join-no-placeholders-phone");
  notes.c3 = ap.url().includes("/g/") ? "Joined automatically; landed in the group." : "Shown a Join screen with nothing to decide.";
});

test("ux proof: extension flow", async () => {
  test.setTimeout(300_000);
  const order = loadFixture("substituted-49-items");
  const ORDER_URL = `https://www.walmart.com/orders/${order.id}`;
  let failNextFetch = false;
  const ctx: BrowserContext = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-ux-")), {
    channel: "chromium", headless: true, viewport: DESKTOP,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await ctx.route("https://www.walmart.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname !== `/orders/${order.id}`) return route.fulfill({ status: 404, body: "not found" });
    if (failNextFetch && route.request().resourceType() === "fetch") { failNextFetch = false; return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Walmart is busy</body></html>" }); }
    return route.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(order) });
  });
  const app = await ctx.newPage();
  await signIn(app, { name: "Sanskar", email: `ext+${run}@example.com` });
  await api(app, "/api/groups", "POST", { name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant"] });
  await api(app, "/api/groups", "POST", { name: "Ski trip", placeholderNames: ["Ayush", "Nishant", "Priya"] });

  // Walmart page: reading the order fails.
  const walmart = await ctx.newPage();
  await walmart.goto(ORDER_URL);
  await walmart.locator("#billsplit-process-btn").waitFor({ timeout: 15000 });
  await walmart.waitForTimeout(2500);
  let alertText = "";
  walmart.once("dialog", async (dlg) => { alertText = dlg.message(); await dlg.accept(); });
  failNextFetch = true;
  await walmart.locator("#billsplit-process-btn").click();
  await walmart.waitForTimeout(2000);
  if (alertText) { notes.e6 = `alert(): ${alertText}`; await drawNativeAlert(walmart, alertText); }
  await walmart.screenshot({ path: path.join(OUT, "e6-walmart-read-error.png"), animations: "disabled" });
  await walmart.reload();
  await walmart.locator("#billsplit-process-btn").waitFor({ timeout: 15000 });
  await walmart.waitForTimeout(2500);

  const [proc] = await Promise.all([ctx.waitForEvent("page"), walmart.locator("#billsplit-process-btn").click()]);
  await proc.waitForLoadState();
  await proc.getByTestId("item-card").waitFor();
  await shot(proc, "e1-process-start", false);

  // Assign three items, then switch the group.
  for (let i = 0; i < 3; i++) { await proc.getByTestId("member-Sanskar").click(); await proc.getByTestId("next").click(); }
  const before = await proc.locator(".bs-progress-label").innerText();
  await proc.getByTestId("group").selectOption({ label: "Ski trip" });
  await proc.waitForTimeout(2000);
  await proc.getByTestId("item-card").or(proc.getByTestId("review")).first().waitFor();
  const after = await proc.locator(".bs-progress-label").innerText();
  notes.e2 = `Progress before switching group: ${before}; after: ${after}`;
  await shot(proc, "e2-after-group-switch", false);

  // Finish every card from the keyboard, then jump back from Review to fix item 3.
  for (let k = 0; k < 60 && !(await proc.getByTestId("review").isVisible()); k++) {
    if (await proc.getByTestId("next").isDisabled()) await proc.keyboard.press("1");
    await proc.keyboard.press("Enter");
    await proc.waitForTimeout(60);
  }
  await proc.getByTestId("review").waitFor();
  await proc.getByTestId("payer").selectOption({ label: "Sanskar" });
  await shot(proc, "e3a-review");
  await proc.locator(".bs-table tr").nth(2).click();
  await proc.getByTestId("item-card").waitFor();
  await proc.getByTestId("member-Ayush").click();
  await shot(proc, "e3b-fixing-one-item-from-review", false);
  let presses = 0;
  if (await proc.getByTestId("back-to-review").count()) { await proc.getByTestId("back-to-review").click(); presses = 1; }
  else for (; presses < 60 && !(await proc.getByTestId("review").isVisible()); presses++) { await proc.getByTestId("next").click(); await proc.waitForTimeout(40); }
  notes.e3 = `Clicks needed to get back to Review after fixing item 3: ${presses}`;

  // Sending fails once.
  let procAlert = "";
  proc.once("dialog", async (dlg) => { procAlert = dlg.message(); await dlg.accept(); });
  await ctx.route(/\/api\/groups\/[^/]+\/orders$/, (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Database timed out" }) }), { times: 1 });
  await proc.getByTestId("submit").click();
  await proc.waitForTimeout(1500);
  if (procAlert) { notes.e4 = `alert(): ${procAlert}`; await drawNativeAlert(proc, procAlert); }
  await shot(proc, "e4-send-error", false);
  if (procAlert) await proc.evaluate(() => document.body.lastElementChild?.remove());

  await proc.getByTestId("submit").click();
  await proc.getByTestId("done").waitFor();
  await shot(proc, "e5-done", false);
  await ctx.close();
});
