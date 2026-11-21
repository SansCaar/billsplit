import { test, expect, chromium } from "@playwright/test";
const APP = process.env.APP_URL ?? "http://localhost:3000";

test("settle up on a phone: mark received, partial amount, custom payment, undo", async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true })).newPage();
  const run = Date.now().toString(36);
  await page.goto(`${APP}/signin`); await page.fill('input[name="name"]', "Sanskar"); await page.fill('input[name="email"]', `su+${run}@example.com`); await page.click("text=Dev sign in"); await page.waitForURL(`${APP}/`);
  const api = (p: string, method = "GET", body?: unknown) => page.evaluate(async ([p, m, b]) => (await fetch(p as string, { method: m as string, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined })).json(), [p, method, body] as const);
  const g = await api("/api/groups", "POST", { name: "Flat", placeholderNames: ["Ayush", "Nishant"] });
  const [s, a, n] = g.members.map((m: { id: string }) => m.id);
  await api(`/api/groups/${g._id}/expenses`, "POST", { title: "Rent", amount: 9000, payerId: s, split: { method: "equal", shares: [{ memberId: s }, { memberId: a }, { memberId: n }] } });
  const bal = async () => (await api(`/api/groups/${g._id}`)).balances as Record<string, number>;
  expect(await bal()).toEqual({ [s]: 6000, [a]: -3000, [n]: -3000 });

  await page.goto(`${APP}/g/${g._id}`);
  await page.getByRole("link", { name: "Settle up" }).first().tap();
  await expect(page.getByTestId("settle-up")).toBeVisible();
  await expect(page.locator(".pay-card")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // 1) Ayush pays in full: one tap.
  await page.locator(".pay-card", { hasText: "Ayush" }).getByTestId("mark-paid").tap();
  await expect(page.getByRole("status")).toContainText("Ayush paid you $30.00");
  expect((await bal())[a]).toBe(0);

  // 2) Nishant pays part of it via "Other amount".
  await page.locator(".pay-card", { hasText: "Nishant" }).getByText("Other amount").tap();
  await page.getByLabel("Amount paid").fill("12.50");
  await page.getByRole("button", { name: "Record", exact: true }).tap();
  await expect(page.locator(".pay-card", { hasText: "Nishant" })).toContainText("$17.50");
  expect((await bal())[n]).toBe(-1750);

  // 3) Record something else by tapping people.
  await page.getByText("Something else?").tap();
  await page.getByRole("radiogroup", { name: "Who paid?" }).getByRole("radio", { name: "Nishant" }).tap();
  await page.getByRole("radiogroup", { name: "Who got paid?" }).getByRole("radio", { name: "You" }).tap();
  await page.getByPlaceholder("$0.00").fill("17.50");
  await page.getByPlaceholder("Optional, e.g. Venmo").fill("Venmo");
  await page.getByRole("button", { name: "Save payment" }).tap();
  await expect(page.getByText("You're settled up")).toBeVisible();
  expect(Object.values(await bal())).toEqual([0, 0, 0]);
  await expect(page.locator(".list li", { hasText: "Venmo" })).toBeVisible();

  // 4) Undo the last one: Nishant owes $17.50 again.
  page.once("dialog", (d) => d.accept());
  await page.locator(".list li", { hasText: "Venmo" }).getByText("Undo").tap();
  await expect(page.locator(".pay-card", { hasText: "Nishant" })).toContainText("$17.50");
  expect((await bal())[n]).toBe(-1750);
  await page.screenshot({ path: "../proof/mobile/settle-up-360.png", fullPage: true });
  await browser.close();
});
