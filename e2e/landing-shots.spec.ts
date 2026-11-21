// Screenshots the landing page through its scroll story, at desktop and phone sizes. Run: npx playwright test landing-shots
import { test, expect, chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../proof/landing");
fs.mkdirSync(OUT, { recursive: true });

for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
  test(`landing @${label}`, async () => {
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width, height }, isMobile: label === "phone", hasTouch: label === "phone" })).newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(`${APP}/`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Split the Walmart order");
    await page.screenshot({ path: path.join(OUT, `${label}-00-hero.png`) });
    // Walk each story step: scroll so the step crosses the trigger line at several depths.
    const steps = page.locator("[data-step]");
    const n = await steps.count();
    for (let i = 0; i < n; i++) {
      for (const depth of [0.15, 0.75]) {
        await steps.nth(i).evaluate((el, d) => { const r = el.getBoundingClientRect(); window.scrollBy(0, r.top - innerHeight * 0.55 + r.height * d); }, depth);
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(OUT, `${label}-step${i + 1}-${Math.round(depth * 100)}.png`) });
      }
    }
    for (const id of ["install"]) { await page.locator(`#${id}`).scrollIntoViewIfNeeded(); await page.waitForTimeout(600); await page.screenshot({ path: path.join(OUT, `${label}-${id}.png`) }); }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${label}-end.png`) });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow").toBeLessThanOrEqual(1);
    expect(errors, errors.join("\n")).toEqual([]);
    await browser.close();
  });
}
