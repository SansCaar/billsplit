// Builds a realistic activity history (two people, edits, payments, re-processing) and screenshots the ledger.
import { test, expect, chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { parseWalmartOrder } from "@billsplit/core/walmart";
import { loadFixture, withRefund } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../proof/ledger");
fs.mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const api = (page: Page, p: string, method = "GET", body?: unknown) =>
  page.evaluate(async ([p, m, b]) => { const r = await fetch(p as string, { method: m as string, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }); return r.json(); }, [p, method, body] as const);
async function signIn(page: Page, name: string, email: string) {
  await page.goto(`${APP}/signin`); await page.fill('input[name="name"]', name); await page.fill('input[name="email"]', email); await page.click("text=Dev sign in"); await page.waitForURL(`${APP}/`);
}

test("ledger screenshots", async () => {
  test.setTimeout(240_000);
  const browser = await chromium.launch();
  const sCtx = await browser.newContext(); const s = await sCtx.newPage(); await signIn(s, "Sanskar", `l+s${run}@example.com`);
  const aCtx = await browser.newContext(); const a = await aCtx.newPage(); await signIn(a, "Ayush", `l+a${run}@example.com`);
  const g = await api(s, "/api/groups", "POST", { name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant", "Priya"] });
  const [S, A, N, P] = g.members.map((m: { id: string }) => m.id);
  await api(a, `/api/invite/${g.invite.token}`, "POST", { claimMemberId: A });
  const raw = loadFixture("substituted-49-items");
  const order = parseWalmartOrder(raw);
  const ids = [S, A, N, P];
  const asg = Object.fromEntries(order.items.filter((i) => i.amount > 0).map((i, k) => [i.key, { method: "equal", shares: k % 4 === 0 ? ids.map((memberId) => ({ memberId })) : [{ memberId: ids[k % 4] }] }]));
  const o = await api(s, `/api/groups/${g._id}/orders`, "POST", { order, assignments: asg, rules: { tax: "proportional", fees: "equal" }, payerId: A });
  const elec = await api(s, `/api/groups/${g._id}/expenses`, "POST", { title: "Electricity — November", amount: 8642, payerId: S, split: { method: "equal", shares: ids.map((memberId) => ({ memberId })) } });
  await api(a, `/api/groups/${g._id}/expenses`, "POST", { title: "Internet", amount: 6000, payerId: A, split: { method: "parts", shares: [{ memberId: S, parts: 1 }, { memberId: A, parts: 1 }, { memberId: N, parts: 2 }] } });
  // Ayush fixes two items on the Walmart order.
  const keys = order.items.filter((i) => i.amount > 0).map((i) => i.key);
  await api(a, `/api/expenses/${o.expenseId}`, "PATCH", { assignments: { ...asg, [keys[1]!]: { method: "equal", shares: [{ memberId: A }, { memberId: N }] }, [keys[2]!]: { method: "equal", shares: [{ memberId: P }] } } });
  // Sanskar changes who paid the electricity and the date.
  await api(s, `/api/expenses/${elec._id}`, "PATCH", { payerId: N, title: "Electricity (Nov)" });
  await api(s, `/api/groups/${g._id}/settlements`, "POST", { fromId: P, toId: S, amount: 2000 });
  await api(a, `/api/groups/${g._id}/settlements`, "POST", { fromId: A, toId: N, amount: 1500 });
  const tmp = await api(s, `/api/groups/${g._id}/expenses`, "POST", { title: "Pizza night", amount: 4200, payerId: S, split: { method: "equal", shares: [{ memberId: S }, { memberId: A }] } });
  await api(a, `/api/expenses/${tmp._id}`, "PATCH", { deleted: true });
  await api(s, `/api/expenses/${tmp._id}`, "PATCH", { deleted: false });
  // Walmart refunds an item; Ayush re-processes.
  const refunded = parseWalmartOrder(withRefund(raw, "Great Value Penne Pasta, 16 oz"));
  const prev = await api(a, `/api/groups/${g._id}/orders/preview`, "POST", { order: refunded });
  await api(a, `/api/groups/${g._id}/orders`, "POST", { order: refunded, assignments: prev.assignments, rules: prev.rules, payerId: prev.payerId });
  const state = await sCtx.storageState();

  for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
    const ctx = await browser.newContext({ viewport, storageState: state, deviceScaleFactor: 2, isMobile: label === "phone", hasTouch: label === "phone", timezoneId: "America/Chicago" });
    const p = await ctx.newPage();
    const errors: string[] = []; p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
    await p.goto(`${APP}/g/${g._id}?tab=activity`); await p.waitForLoadState("networkidle");
    await expect(p.getByTestId("activity")).toContainText("Today");
    await expect(p.getByTestId("activity")).toContainText("changed who shares items in");
    await expect(p.getByTestId("activity")).toContainText("Priya paid you $20.00");
    await p.screenshot({ path: path.join(OUT, `${label}-ledger.png`), fullPage: true, animations: "disabled" });
    await p.locator(".ledger-details > summary").first().click();
    await p.locator(".ledger-details > summary").nth(2).click();
    await p.screenshot({ path: path.join(OUT, `${label}-ledger-details.png`), fullPage: true, animations: "disabled" });
    await p.goto(`${APP}/g/${g._id}?tab=activity&f=payments`); await p.screenshot({ path: path.join(OUT, `${label}-ledger-payments.png`), fullPage: true, animations: "disabled" });
    await p.goto(`${APP}${o.url}`); await p.waitForLoadState("networkidle"); await p.screenshot({ path: path.join(OUT, `${label}-expense-ledger.png`), fullPage: true, animations: "disabled" });
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (errors.length) console.log("console errors:", errors);
    await ctx.close();
  }
  await browser.close();
});
