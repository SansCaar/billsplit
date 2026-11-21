// Mobile compatibility audit: overflow, tap targets, input zoom, tiny text, sticky overlap. Run: npx playwright test mobile-audit
import { test, chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { parseWalmartOrder } from "@billsplit/core/walmart";
import { loadFixture } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../proof/mobile", process.env.UI_TAG ?? "audit");
fs.mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);

const api = (page: Page, p: string, method = "GET", body?: unknown) =>
  page.evaluate(async ([p, method, body]) => (await fetch(p as string, { method: method as string, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })).json(), [p, method, body] as const);

async function audit(page: Page) {
  return page.evaluate(() => {
    const W = Math.min(document.documentElement.clientWidth, screen.width);
    const out: { overflow: string[]; smallTargets: string[]; zoomInputs: string[]; tinyText: string[]; docWidth: number; vw: number } = { overflow: [], smallTargets: [], zoomInputs: [], tinyText: [], docWidth: Math.max(document.documentElement.scrollWidth, innerWidth), vw: W };
    const desc = (e: Element) => { const h = e as HTMLElement; const t = (h.innerText || h.getAttribute("aria-label") || (h as HTMLInputElement).placeholder || "").trim().replace(/\s+/g, " ").slice(0, 30); return `${e.tagName.toLowerCase()}${h.className && typeof h.className === "string" ? "." + h.className.split(" ").filter(Boolean).slice(0, 2).join(".") : ""}${t ? ` "${t}"` : ""}`; };
    const visible = (e: Element) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !e.closest(".sr-only,nextjs-portal,[aria-hidden=true]"); };
    for (const e of document.querySelectorAll("body *")) {
      if (!visible(e) || e.closest("nextjs-portal")) continue;
      const r = e.getBoundingClientRect();
      // Overflow: element extends past the viewport, and isn't inside a horizontal scroller.
      if (r.right > W + 1 || r.left < -1) {
        let p: Element | null = e.parentElement, scroller = false;
        while (p) { const s = getComputedStyle(p); if ((s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden") && p !== document.body && p !== document.documentElement) { scroller = true; break; } p = p.parentElement; }
        if (!scroller) out.overflow.push(`${desc(e)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
      const interactive = e.matches("a[href], button, select, input:not([type=hidden]), summary, [role=button], [role=checkbox], [role=tab]");
      if (interactive && !e.closest(".tabs") && !(e as HTMLElement).closest("p, .li-sub, .note")) {
        if (r.height < 40 || r.width < 40) out.smallTargets.push(`${desc(e)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      if (e.matches("input:not([type=checkbox]):not([type=radio]), select, textarea") && parseFloat(getComputedStyle(e).fontSize) < 16) out.zoomInputs.push(`${desc(e)} ${getComputedStyle(e).fontSize}`);
      if (e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11) out.tinyText.push(`${desc(e)} ${getComputedStyle(e).fontSize}`);
    }
    out.overflow = [...new Set(out.overflow)].slice(0, 12); out.smallTargets = [...new Set(out.smallTargets)].slice(0, 25); out.zoomInputs = [...new Set(out.zoomInputs)]; out.tinyText = [...new Set(out.tinyText)].slice(0, 10);
    return out;
  });
}

test("mobile audit", async () => {
  test.setTimeout(900_000);
  const browser = await chromium.launch();
  const setup = await (await browser.newContext()).newPage();
  await setup.goto(`${APP}/signin`); await setup.fill('input[name="name"]', "Sanskar Lamsal"); await setup.fill('input[name="email"]', `m+${run}@example.com`); await setup.click("text=Dev sign in"); await setup.waitForURL(`${APP}/`);
  const g = await api(setup, "/api/groups", "POST", { name: "Apartment 4B with a fairly long name", placeholderNames: ["Alexandria Featherstonehaugh", "Nishant", "Priya", "Christopher Montgomery"] });
  const ids = g.members.map((m: { id: string }) => m.id);
  const order = parseWalmartOrder(loadFixture("shipped-plus-store-delivery"));
  const assignments = Object.fromEntries(order.items.filter((i) => i.amount > 0).map((i, k) => [i.key, { method: "equal", shares: k % 3 === 0 ? ids.map((memberId: string) => ({ memberId })) : [{ memberId: ids[k % ids.length] }] }]));
  const o = await api(setup, `/api/groups/${g._id}/orders`, "POST", { order, assignments, rules: { tax: "proportional", fees: "equal" }, payerId: ids[1] });
  const man = await api(setup, `/api/groups/${g._id}/expenses`, "POST", { title: "Electricity and internet for the whole of November", amount: 123456, payerId: ids[0], split: { method: "equal", shares: ids.map((memberId: string) => ({ memberId })) } });
  await api(setup, `/api/groups/${g._id}/settlements`, "POST", { fromId: ids[2], toId: ids[0], amount: 2000 });
  // Pre-set the viewer timezone cookie so pages don't do their one-time refresh during the audit.
  await setup.context().addCookies([{ name: "tz", value: "America%2FChicago", url: APP }]);
  const state = await setup.context().storageState();

  const pages: [string, string, ((p: Page) => Promise<void>)?][] = [
    ["home", "/"],
    ["group-balances", `/g/${g._id}`],
    ["group-settle", `/g/${g._id}?tab=settle`],
    ["group-settle-other", `/g/${g._id}?tab=settle`, async (p) => { const b = p.getByText("Other amount").first(); if (await b.count()) await b.click(); }],
    ["group-settle-record", `/g/${g._id}?tab=settle`, async (p) => { await p.getByText("Something else?").click(); }],
    ["group-expenses", `/g/${g._id}?tab=expenses`],
    ["group-activity", `/g/${g._id}?tab=activity`],
    ["group-settings", `/g/${g._id}?tab=settings`],
    ["new-expense", `/g/${g._id}/new`],
    ["new-expense-parts", `/g/${g._id}/new`, async (p) => { await p.getByRole("tab", { name: "By parts" }).click(); }],
    ["new-expense-amount", `/g/${g._id}/new`, async (p) => { await p.fill("#amount", "120.00"); await p.getByRole("tab", { name: "By amount" }).click(); }],
    ["walmart-expense", o.url],
    ["fix-review", o.url, async (p) => { await p.getByTestId("edit").click(); }],
    ["fix-card", o.url, async (p) => { await p.getByTestId("edit").click(); await p.locator(".bs-table tr").first().click(); }],
    ["fix-card-amount", o.url, async (p) => { await p.getByTestId("edit").click(); await p.locator(".bs-table tr").first().click(); await p.getByRole("tab", { name: "By amount" }).click(); }],
    ["manual-expense", `/e/${man._id}`],
    ["manual-edit", `/e/${man._id}`, async (p) => { await p.getByTestId("edit").click(); }],
    ["join", `/join/${g.invite.token}`],
    ["account-menu", "/", async (p) => { await p.getByTestId("whoami").click(); }],
  ];
  const sizes: [string, { width: number; height: number }][] = [["320", { width: 320, height: 640 }], ["360", { width: 360, height: 760 }], ["390", { width: 390, height: 844 }], ["430", { width: 430, height: 932 }], ["landscape", { width: 844, height: 390 }]];
  const report: Record<string, unknown> = {};
  for (const [sz, viewport] of sizes) {
    const ctx = await browser.newContext({ viewport, storageState: state, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15_000); // a blocked tap should fail fast, not hang the audit
    for (const [name, url, act] of pages) {
      await page.goto(`${APP}${url}`); await page.waitForLoadState("networkidle");
      if (act) { await act(page); await page.waitForTimeout(300); }
      const a = await audit(page);
      // Sticky bar overlap: when scrolled to the very bottom, is the last real content hidden under a fixed bar?
      const overlap = await page.evaluate(async () => {
        window.scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 150));
        const bar = [...document.querySelectorAll(".sticky-bar, .bs-nav-card, .bs-nav-review")].find((b) => getComputedStyle(b).position === "fixed" || getComputedStyle(b).position === "sticky");
        if (!bar) return null;
        const top = bar.getBoundingClientRect().top;
        const content = [...document.querySelectorAll("main .card, main .bs-editor, main .bs-review, main section")].filter((e) => !bar.contains(e) && !e.contains(bar));
        const hidden = content.filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > top + 2 && r.top < top; });
        return hidden.length ? `content under bar: ${hidden.map((h) => h.className).join(", ").slice(0, 80)}` : null;
      });
      report[`${sz}/${name}`] = { ...a, overlap };
      if (sz === "320" || sz === "390") await page.screenshot({ path: path.join(OUT, `${sz}-${name}.png`), fullPage: false, animations: "disabled", caret: "initial" });
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
  await browser.close();
});
