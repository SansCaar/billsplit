// UI fault audit: every web page and every extension screen at phone, tablet and desktop widths.
// Checks page overflow, clipped text, overlapping controls, broken images and console errors, and screenshots each.
// Run (needs `pnpm dev` and `pnpm --filter extension build:local`): npx playwright test ui-audit
import { test, expect, chromium, type Page, type BrowserContext } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseWalmartOrder } from "@billsplit/core/walmart";
import { loadFixture, orderPageHtml } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXT = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const OUT = path.resolve(import.meta.dirname, "../proof/ui-audit", process.env.UI_TAG ?? "latest");
fs.mkdirSync(OUT, { recursive: true });
const WIDTHS = [320, 390, 768, 1024, 1440];
test.use({ actionTimeout: 10_000 });
const run = Date.now().toString(36);

type Finding = { page: string; width: number; kind: string; detail: string };
const findings: Finding[] = [];

const api = (page: Page, p: string, method = "GET", body?: unknown) =>
  page.evaluate(async ([p, method, body]) => (await fetch(p as string, { method: method as string, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json(), [p, method, body] as const);

async function devSignIn(page: Page, name: string, email: string) {
  await page.goto(`${APP}/signin?dev=1`);
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.click("text=Dev sign in");
  await page.waitForURL(`${APP}/`);
}

/** Runs in the page: returns layout faults. */
async function scan(page: Page) {
  return page.evaluate(() => {
    const out: { kind: string; detail: string }[] = [];
    const W = document.documentElement.clientWidth;
    const desc = (e: Element) => {
      const h = e as HTMLElement;
      const t = (h.innerText || h.getAttribute("aria-label") || (h as HTMLInputElement).placeholder || "").trim().replace(/\s+/g, " ").slice(0, 40);
      const cls = typeof h.className === "string" && h.className ? "." + h.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      return `${e.tagName.toLowerCase()}${cls}${t ? ` "${t}"` : ""}`;
    };
    const visible = (e: Element) => {
      const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
    };
    const inScroller = (e: Element) => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (["auto", "scroll", "hidden", "clip"].includes(s.overflowX)) return true;
      }
      return false;
    };
    if (document.documentElement.scrollWidth > W + 1) out.push({ kind: "page-overflow", detail: `document ${document.documentElement.scrollWidth}px wide in a ${W}px viewport` });
    const all = [...document.querySelectorAll("body *")].filter(visible);
    for (const e of all) {
      const r = e.getBoundingClientRect();
      if ((r.right > W + 1 || r.left < -1) && !inScroller(e) && getComputedStyle(e).position !== "fixed") out.push({ kind: "off-screen", detail: `${desc(e)} spans ${Math.round(r.left)}..${Math.round(r.right)}` });
      // Text cut off without an ellipsis or a line clamp.
      const s = getComputedStyle(e);
      const clips = ["hidden", "clip"].includes(s.overflowX) || ["hidden", "clip"].includes(s.overflowY);
      const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (clips && hasText && s.textOverflow !== "ellipsis" && s.webkitLineClamp === "none" && !(e instanceof HTMLInputElement)) {
        const he = e as HTMLElement;
        if (he.scrollWidth > he.clientWidth + 2 || he.scrollHeight > he.clientHeight + 2) out.push({ kind: "clipped-text", detail: desc(e) });
      }
      // Buttons/links whose label doesn't fit on their line.
      if ((e.tagName === "BUTTON" || e.classList.contains("btn")) && s.whiteSpace === "nowrap" && (e as HTMLElement).scrollWidth > (e as HTMLElement).clientWidth + 2) out.push({ kind: "button-overflow", detail: desc(e) });
    }
    // Overlapping controls (not nested in each other).
    const ctl = all.filter((e) => e.matches("a[href], button, input, select, textarea, summary, [role=tab]") && !e.closest("[aria-hidden=true], .sr-only"));
    const rects = ctl.map((e) => e.getBoundingClientRect());
    const floating = ctl.map((e) => { for (let p: Element | null = e; p; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === "fixed" || pos === "sticky") return true; } return false; });
    for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
      const a = rects[i]!, b = rects[j]!;
      if (ctl[i]!.contains(ctl[j]!) || ctl[j]!.contains(ctl[i]!)) continue;
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ix > 4 && iy > 4 && floating[i] === floating[j]) out.push({ kind: "overlap", detail: `${desc(ctl[i]!)} ∩ ${desc(ctl[j]!)}` });
    }
    for (const img of document.images) if (img.complete && img.naturalWidth === 0 && img.src && visible(img)) out.push({ kind: "broken-image", detail: img.src.slice(0, 80) });
    return out;
  });
}

function watchConsole(page: Page, label: () => string) {
  page.on("console", (m) => { if (m.type() === "error") findings.push({ page: label(), width: page.viewportSize()?.width ?? 0, kind: "console-error", detail: m.text().slice(0, 200) }); });
  page.on("pageerror", (e) => findings.push({ page: label(), width: page.viewportSize()?.width ?? 0, kind: "page-error", detail: e.message.slice(0, 200) }));
}

async function check(page: Page, name: string, width: number, full = true) {
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(250);
  for (const f of await scan(page)) findings.push({ page: name, width, ...f });
  await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: full, animations: "disabled" });
}

for (const width of WIDTHS) test(`web app pages @${width}px`, async () => {
  test.setTimeout(400_000);
  const browser = await chromium.launch();
  const setup = await (await browser.newContext()).newPage();
  await devSignIn(setup, "Sanskar Lamsal", `audit+${run}@example.com`);
  const g = await api(setup, "/api/groups", "POST", { name: "Apartment 4B on Maple Street", placeholderNames: ["Alexandria Montgomery", "Nishant", "Priya Venkataraman"] });
  const ids: string[] = g.members.map((m: { id: string }) => m.id);
  const [s, a, n, p] = ids;
  const order = parseWalmartOrder(loadFixture("two-fulfillments-unavailable"));
  const assignments = Object.fromEntries(order.items.filter((i) => i.amount > 0).map((i, k) => [i.key, { method: "equal", shares: k % 4 === 0 ? ids.map((memberId) => ({ memberId })) : [{ memberId: ids[k % 4]! }] }]));
  const o = await api(setup, `/api/groups/${g._id}/orders`, "POST", { order, assignments, rules: { tax: "proportional", fees: "equal" }, payerId: a });
  const manual = await api(setup, `/api/groups/${g._id}/expenses`, "POST", { title: "Electricity and internet for the whole of November", amount: 14642, payerId: s, split: { method: "equal", shares: ids.map((memberId) => ({ memberId })) } });
  await api(setup, `/api/groups/${g._id}/expenses`, "POST", { title: "Pizza", amount: 3150, payerId: n, split: { method: "parts", shares: [{ memberId: s, parts: 1 }, { memberId: a, parts: 1 }, { memberId: n, parts: 2 }] } });
  await api(setup, `/api/groups/${g._id}/settlements`, "POST", { fromId: p, toId: s, amount: 2000 });
  const state = await setup.context().storageState();
  const manualId = manual._id ?? manual.expenseId ?? manual.expense?._id;

  {
    const phone = width < 760;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, storageState: state, isMobile: phone, hasTouch: phone });
    const page = await ctx.newPage();
    let current = "";
    watchConsole(page, () => current);
    const visit = async (name: string, url: string) => { current = name; await page.goto(`${APP}${url}`); await check(page, name, width); };
    await visit("home", "/");
    await visit("home-new-group-open", "/?new=1");
    for (const tab of ["balances", "settle", "expenses", "activity", "settings"]) await visit(`group-${tab}`, `/g/${g._id}?tab=${tab}`);
    await visit("group-activity-filtered", `/g/${g._id}?tab=activity&f=payments&mine=1`);
    await visit("new-expense", `/g/${g._id}/new`);
    current = "new-expense-by-amount"; await page.getByRole("tab", { name: "By amount" }).first().click({ timeout: 5000 }).catch(() => findings.push({ page: current, width, kind: "audit-step-failed", detail: "couldn't click By amount" })); await check(page, current, width);
    await visit("walmart-expense", o.url);
    await visit("splitter-review", `${o.url}?edit=1`);
    current = "splitter-card"; await page.locator(".bs-table tr").first().click({ timeout: 5000 }).catch(() => findings.push({ page: current, width, kind: "audit-step-failed", detail: "couldn't open the first item card" })); await check(page, current, width, false);
    if (manualId) { await visit("manual-expense", `/e/${manualId}`); }
    await visit("join", `/join/${g.invite.token}`);
    await visit("missing-group", `/g/00000000-0000-0000-0000-000000000000`);
    await ctx.close();

    // Signed-out and brand-new-user screens.
    const anon = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone });
    const ap = await anon.newPage(); current = "signin"; watchConsole(ap, () => current);
    await ap.goto(`${APP}/signin`); await check(ap, "signin", width);
    current = "join-signed-out"; await ap.goto(`${APP}/join/${g.invite.token}`); await check(ap, "join-signed-out", width);
    await devSignIn(ap, "Priya", `fresh+${width}+${run}@example.com`);
    current = "home-empty"; await check(ap, "home-empty", width);
    await anon.close();
  }
  await browser.close();
});

test("extension screens", async () => {
  test.setTimeout(300_000);
  const walmartOrder = loadFixture("substituted-49-items");
  const ORDER_URL = `https://www.walmart.com/orders/${walmartOrder.id}`;
  const ctx: BrowserContext = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-audit-")), {
    channel: "chromium", headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 1280, height: 860 },
  });
  await ctx.route("https://www.walmart.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === `/orders/${walmartOrder.id}`) return route.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(walmartOrder) });
    return route.fulfill({ status: 404, body: "not found" });
  });
  const app = await ctx.newPage();
  await devSignIn(app, "Sanskar", `ext+${run}@example.com`);
  await api(app, "/api/groups", "POST", { name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant"] });

  const walmart = await ctx.newPage();
  let current = "walmart-page";
  watchConsole(walmart, () => current);
  await walmart.goto(ORDER_URL);
  await expect(walmart.locator("#billsplit-process-btn")).toBeVisible({ timeout: 15000 });
  await walmart.screenshot({ path: path.join(OUT, "ext-walmart-button-1280.png") });
  const [proc] = await Promise.all([ctx.waitForEvent("page"), walmart.locator("#billsplit-process-btn").click()]);
  watchConsole(proc, () => current);
  await proc.waitForLoadState();
  await expect(proc.getByTestId("item-card")).toBeVisible();

  const both = async (name: string) => {
    current = name;
    for (const width of [1280, 900, 480]) { await proc.setViewportSize({ width, height: 860 }); await check(proc, name, width, false); }
    await proc.setViewportSize({ width: 1280, height: 860 });
  };
  await both("ext-first-card");
  await proc.getByTestId("member-Sanskar").click(); await proc.getByTestId("member-Ayush").click();
  await both("ext-card-assigned");
  await proc.getByRole("tab", { name: "By parts" }).click(); await both("ext-card-parts");
  await proc.getByRole("tab", { name: "By amount" }).click(); await both("ext-card-amount");
  await proc.getByRole("tab", { name: "Equal" }).click();
  await proc.getByTestId("next").click();
  for (let i = 1; i < 15; i++) { await proc.getByTestId("all").click(); await proc.getByTestId("next").click(); }
  await expect(proc.getByTestId("review")).toBeVisible();
  await both("ext-review");
  await proc.getByTestId("submit").click();
  await expect(proc.getByTestId("done")).toBeVisible();
  await both("ext-done");
  await ctx.close();
});

test.afterEach(() => {
  if (findings.length) fs.appendFileSync(path.join(OUT, "findings.jsonl"), findings.map((f) => JSON.stringify(f)).join("\n") + "\n");
  findings.length = 0;
});
test.afterAll(() => {
  const findings: Finding[] = fs.existsSync(path.join(OUT, "findings.jsonl")) ? fs.readFileSync(path.join(OUT, "findings.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const key = (f: Finding) => `${f.kind}|${f.page}|${f.detail}`;
  const grouped = new Map<string, { f: Finding; widths: number[] }>();
  for (const f of findings) { const k = key(f); const g = grouped.get(k) ?? { f, widths: [] }; g.widths.push(f.width); grouped.set(k, g); }
  const rows = [...grouped.values()].map(({ f, widths }) => ({ kind: f.kind, page: f.page, widths: [...new Set(widths)].sort((a, b) => a - b), detail: f.detail }));
  fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(rows, null, 1));
  console.log(`UI audit: ${rows.length} distinct findings → ${path.join(OUT, "findings.json")}`);
});
