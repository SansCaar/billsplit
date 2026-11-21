// Screenshots every web-app page at phone and desktop sizes with realistic demo data. Run: npx playwright test ui-shots
import { test, chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { parseWalmartOrder } from "@billsplit/core/walmart";
import { loadFixture } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../proof/ui", process.env.UI_TAG ?? "before");
fs.mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);

async function signIn(page: Page, name: string, email: string) {
  await page.goto(`${APP}/signin`);
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.click("text=Dev sign in");
  await page.waitForURL(`${APP}/`);
}
const api = (page: Page, p: string, method = "GET", body?: unknown) =>
  page.evaluate(async ([p, method, body]) => {
    const r = await fetch(p as string, { method: method as string, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  }, [p, method, body] as const);

test("ui screenshots", async () => {
  test.setTimeout(240_000);
  const browser = await chromium.launch();
  const setup = await (await browser.newContext()).newPage();
  await signIn(setup, "Sanskar", `demo+${run}@example.com`);
  const g = await api(setup, "/api/groups", "POST", { name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant", "Priya"] });
  const [s, a, n, p] = g.members.map((m: { id: string }) => m.id);
  const order = parseWalmartOrder(loadFixture("two-fulfillments-unavailable"));
  const ids = [s, a, n, p];
  const assignments = Object.fromEntries(order.items.filter((i) => i.amount > 0).map((i, k) => [i.key, { method: "equal", shares: k % 4 === 0 ? ids.map((memberId) => ({ memberId })) : [{ memberId: ids[k % 4] }, ...(k % 3 === 0 ? [{ memberId: ids[(k + 1) % 4] }] : [])] }]));
  const o = await api(setup, `/api/groups/${g._id}/orders`, "POST", { order, assignments, rules: { tax: "proportional", fees: "equal" }, payerId: a });
  await api(setup, `/api/groups/${g._id}/expenses`, "POST", { title: "Electricity — November", amount: 8642, payerId: s, split: { method: "equal", shares: ids.map((memberId) => ({ memberId })) } });
  await api(setup, `/api/groups/${g._id}/expenses`, "POST", { title: "Internet", amount: 6000, payerId: n, split: { method: "parts", shares: [{ memberId: s, parts: 1 }, { memberId: a, parts: 1 }, { memberId: n, parts: 2 }] } });
  await api(setup, `/api/groups/${g._id}/settlements`, "POST", { fromId: p, toId: s, amount: 2000 });
  await api(setup, `/api/expenses/${o.expenseId}`, "PATCH", { assignments: { ...assignments, [order.items.find((i) => i.amount > 0)!.key]: { method: "equal", shares: [{ memberId: n }] } } });
  const state = await setup.context().storageState();

  for (const [label, viewport] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 860 }]] as const) {
    const ctx = await browser.newContext({ viewport, storageState: state, deviceScaleFactor: 2, isMobile: label === "phone", hasTouch: label === "phone" });
    const page = await ctx.newPage();
    const shot = async (name: string, full = true) => { await page.waitForLoadState("networkidle"); return page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: full, animations: "disabled", caret: "initial" }); };
    const _unused = (name: string, full = true) => page.screenshot({ path: path.join(OUT, `${label}-${name}.png`), fullPage: full, animations: "disabled", caret: "initial" });
    await page.goto(`${APP}/`); await shot("01-home");
    await page.goto(`${APP}/g/${g._id}`); await shot("02-group");
    await page.goto(`${APP}/g/${g._id}?tab=balances`); await shot("02b-balances");
    await page.goto(`${APP}/g/${g._id}?tab=activity`); await shot("02c-activity");
    await page.goto(`${APP}/g/${g._id}?tab=group`); await shot("02d-group-settings");
    await page.goto(`${APP}/g/${g._id}/new`); await shot("03-new-expense");
    await page.goto(`${APP}${o.url}`); await shot("04-walmart-expense");
    if (await page.getByTestId("filter-mine").count()) { await page.getByTestId("filter-mine").click(); await shot("04b-mine"); await page.getByText(/^All \d+/).click(); }
    await page.getByTestId("edit").click(); await shot("05-fix-review");
    await page.locator(".bs-table tr").first().click(); await shot("06-fix-card", false);
    const manual = (await api(page, `/api/groups/${g._id}`)).expenses.find((e: { kind: string }) => e.kind === "manual");
    await page.goto(`${APP}/e/${manual._id}`); await shot("07-manual-expense");
    await page.goto(`${APP}/join/${g.invite.token}`); await shot("08-join");
    await ctx.close();
  }
  const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const ap = await anon.newPage(); await ap.goto(`${APP}/signin`); await ap.screenshot({ path: path.join(OUT, "phone-00-signin.png") });
  await browser.close();
});
