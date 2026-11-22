/**
 * Real push, end to end: Ayush turns notifications on in Google Chrome, Sanskar adds an expense and nudges,
 * and the Notifications arrive through Chrome's push service on Ayush's service worker.
 * Needs: `pnpm dev` with VAPID keys in apps/web/.env.local, Google Chrome installed, network access.
 * APP defaults to http://localhost:3000.
 */
import { test, expect, chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = process.env.APP ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../proof/push");
const run = Date.now().toString(36);

async function signIn(page: Page, name: string, email: string) {
  await page.goto(`${APP}/signin?dev=1`);
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

/** Notifications currently shown by this page's service worker. */
const shown = (page: Page) =>
  page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, url: (n.data as { url?: string })?.url })));

test("notifications and nudges arrive through real push", async () => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT, { recursive: true });

  const sBrowser = await chromium.launch();
  const s = await (await sBrowser.newContext()).newPage();
  // Chrome refuses push in incognito-style contexts, so Ayush gets a real (temporary) profile.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "bs-push-"));
  const aCtx = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: process.env.HEADED !== "1", viewport: { width: 1100, height: 820 }, permissions: ["notifications"] });
  const a = aCtx.pages()[0] ?? (await aCtx.newPage());

  try {
    await signIn(s, "Sanskar", `push+s${run}@example.com`);
    await signIn(a, "Ayush", `push+a${run}@example.com`);
    const g = await api(s, "/api/groups", "POST", { name: "Apartment 4B", placeholderNames: ["Ayush"] });
    const [S, A] = g.members.map((m: { id: string }) => m.id);
    await api(a, `/api/invite/${g.invite.token}`, "POST", { claimMemberId: A });

    // Ayush adds something, so the banner appears.
    await api(a, `/api/groups/${g._id}/expenses`, "POST", { title: "Soap", amount: 400, payerId: A, split: { method: "equal", shares: [{ memberId: S }, { memberId: A }] } });
    await a.goto(`${APP}/g/${g._id}`);
    const banner = a.getByTestId("notify-banner");
    await expect(banner).toBeVisible();
    await a.screenshot({ path: `${OUT}/1-banner.png` });
    await banner.getByRole("button", { name: "Turn on notifications" }).click();
    await expect(banner).toBeHidden({ timeout: 45_000 }); // registering with the push service can take a while
    expect(await a.evaluate(async () => !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()))).toBe(true);

    // Sanskar adds an expense that involves Ayush → Ayush gets a Notification that opens the expense.
    const e = await api(s, `/api/groups/${g._id}/expenses`, "POST", { title: "Groceries", amount: 3000, payerId: S, split: { method: "equal", shares: [{ memberId: S }, { memberId: A }] } });
    await expect.poll(async () => (await shown(a)).find((n) => n.body.includes("Groceries")), { timeout: 30_000 }).toMatchObject({ title: "Apartment 4B", url: `/e/${e._id}` });

    // Sanskar nudges Ayush from the Balances tab.
    await s.goto(`${APP}/g/${g._id}`);
    await s.getByTestId("nudge-Ayush").click();
    const dialog = s.locator("dialog.nudge-dialog");
    await expect(dialog.locator(".nudge-line")).toHaveCount(3);
    await s.screenshot({ path: `${OUT}/2-nudge-picker.png` });
    const line = (await dialog.locator(".nudge-line").first().textContent())!;
    await dialog.locator(".nudge-line").first().click();
    await expect(dialog).toBeHidden();
    await expect(s.getByText("Nudged 1× today", { exact: true })).toBeVisible();
    await expect.poll(async () => (await shown(a)).find((n) => n.title.startsWith("Sanskar nudged you")), { timeout: 30_000 }).toMatchObject({ body: line, url: `/g/${g._id}?tab=settle` });

    // Phone width: the row and the picker still fit.
    await s.setViewportSize({ width: 390, height: 844 });
    await s.reload();
    await s.getByTestId("my-summary").screenshot({ path: `${OUT}/6-mobile-row.png` });
    await s.getByTestId("nudge-Ayush").click();
    await expect(dialog.locator(".nudge-line")).toHaveCount(3);
    await s.screenshot({ path: `${OUT}/7-mobile-picker.png` });
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Both sides see the count.
    await a.goto(`${APP}/g/${g._id}`);
    await expect(a.getByText("Sanskar nudged you 1× today", { exact: true })).toBeVisible();
    await a.screenshot({ path: `${OUT}/3-receiver-row.png` });

    // Settings: device switch and levels.
    await a.goto(`${APP}/settings`);
    await expect(a.getByText("On for this device")).toBeVisible();
    await a.screenshot({ path: `${OUT}/4-settings.png`, fullPage: true });
    await a.goto(`${APP}/g/${g._id}?tab=settings`);
    await a.getByTestId("group-notify").scrollIntoViewIfNeeded();
    await a.getByTestId("group-notify").screenshot({ path: `${OUT}/5-group-level.png` });
  } finally {
    await aCtx.close();
    await sBrowser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
