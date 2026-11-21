// Every sign-in / joining screen, web and extension, at phone and desktop sizes. Run: npx playwright test login-screens
import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadFixture, orderPageHtml } from "./fake-walmart";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const EXT = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const OUT = path.resolve(import.meta.dirname, "../proof/login");
fs.mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const SIZES = [["phone", 390, 844], ["small", 320, 640], ["desktop", 1440, 900], ["laptop", 1024, 720]] as const;

test("web sign-in screens", async () => {
  test.setTimeout(480_000);
  const browser = await chromium.launch();
  const setup = await (await browser.newContext()).newPage();
  await setup.goto(`${APP}/signin?dev=1`); await setup.fill('input[name="name"]', "Sanskar"); await setup.fill('input[name="email"]', `login+${run}@example.com`);
  await setup.click("text=Dev sign in"); await setup.waitForURL(`${APP}/`);
  const g = await setup.evaluate(async () => (await fetch("/api/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant", "Priya"] }) })).json());
  const token = g.invite.token;
  for (const [label, width, height] of SIZES) {
    const phone = width < 760;
    const anon = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone });
    const p = await anon.newPage();
    await p.goto(`${APP}/signin`); await expect(p.getByText("Continue with Google")).toBeVisible();
    await p.screenshot({ path: path.join(OUT, `web-signin-${label}.png`), fullPage: true });
    await p.goto(`${APP}/join/${token}`); await expect(p.getByRole("heading", { name: /Join Apartment 4B/ })).toBeVisible();
    await p.screenshot({ path: path.join(OUT, `web-invite-signin-${label}.png`), fullPage: true });
    await p.goto(`${APP}/signin?dev=1&callbackUrl=/join/${token}`); await p.fill('input[name="name"]', "Priya"); await p.fill('input[name="email"]', `priya+${label}+${run}@example.com`);
    await p.click("text=Dev sign in"); await p.waitForURL(`${APP}/join/${token}`); await expect(p.getByTestId("join")).toBeVisible();
    await p.screenshot({ path: path.join(OUT, `web-join-${label}.png`), fullPage: true });
    await p.goto(`${APP}/join/not-a-real-token`); await p.screenshot({ path: path.join(OUT, `web-invite-invalid-${label}.png`), fullPage: true });
    await p.goto(`${APP}/connected`); await p.screenshot({ path: path.join(OUT, `web-connected-${label}.png`), fullPage: true });
    await anon.close();
  }
  await browser.close();
});

test("extension sign-in flow", async () => {
  test.setTimeout(480_000);
  const order = loadFixture("substituted-49-items");
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-login-")), {
    channel: "chromium", headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`], viewport: { width: 1280, height: 800 },
  });
  await ctx.route("https://www.walmart.com/**", (r) => new URL(r.request().url()).pathname === `/orders/${order.id}` ? r.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(order) }) : r.fulfill({ status: 404, body: "" }));
  const shot = async (p: import("@playwright/test").Page, name: string) => {
    for (const [w, h] of [[1280, 800], [420, 820]] as const) { await p.setViewportSize({ width: w, height: h }); await p.screenshot({ path: path.join(OUT, `ext-${name}-${w}.png`) }); }
    await p.setViewportSize({ width: 1280, height: 800 });
  };
  // Signed out: the splitter asks to connect.
  const walmart = await ctx.newPage();
  await walmart.goto(`https://www.walmart.com/orders/${order.id}`);
  const [proc] = await Promise.all([ctx.waitForEvent("page"), walmart.locator("#billsplit-process-btn").click()]);
  await expect(proc.getByTestId("signin")).toBeVisible();
  await shot(proc, "signin");
  // Clicking opens the sign-in tab; the splitter waits.
  const [signinTab] = await Promise.all([ctx.waitForEvent("page"), proc.getByTestId("open-signin").click()]);
  await expect(proc.getByText("Waiting for you to sign in")).toBeVisible();
  await shot(proc, "waiting");
  expect(signinTab.url()).toContain("/signin?callbackUrl=/connected");
  // Sign in (dev login in tests), with no group yet: the splitter moves on by itself and closes the sign-in tab.
  await signinTab.goto(`${APP}/signin?dev=1&callbackUrl=/connected`);
  await signinTab.fill('input[name="name"]', "Sanskar"); await signinTab.fill('input[name="email"]', `extlogin+${run}@example.com`);
  await signinTab.click("text=Dev sign in");
  await signinTab.waitForURL(/\/connected/).catch(() => {});
  await expect(proc.getByText("Create a group first")).toBeVisible({ timeout: 15000 });
  await expect.poll(() => signinTab.isClosed(), { timeout: 10000 }).toBe(true);
  await shot(proc, "no-group");
  // Create a group through the API, then the splitter continues on focus.
  const app = await ctx.newPage(); await app.goto(`${APP}/`);
  await app.evaluate(async () => fetch("/api/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Apartment 4B", placeholderNames: ["Ayush"] }) }));
  await app.close(); await proc.bringToFront(); await proc.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(proc.getByTestId("item-card")).toBeVisible({ timeout: 15000 });
  await shot(proc, "ready");
  // Lost order data (tab reopened): a clear message.
  const lost = await ctx.newPage(); await lost.goto(proc.url().replace(/order=[^&]+/, "order=000"));
  await expect(lost.getByText("Open the order again")).toBeVisible();
  await shot(lost, "order-missing");
  await ctx.close();
});
