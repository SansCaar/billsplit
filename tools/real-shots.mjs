// Screenshots of the real Walmart order pages in the user's Chrome (read-only), after expanding sections with the extension's code.
import fs from "node:fs";
import { chromium } from "playwright-core";
import { wsUrl } from "./cdp.mjs";
const out = "../proof/real-chrome"; fs.mkdirSync(out, { recursive: true });
const harness = fs.readFileSync("dist/harness.js", "utf8");
const b = await chromium.connectOverCDP(wsUrl(), { timeout: 180000 });
const ctx = b.contexts().find((c) => c.pages().some((p) => p.url().includes("walmart.com"))) ?? b.contexts()[0];
const page = await ctx.newPage();
const ids = JSON.parse(fs.readFileSync("../proof/raw/shot-ids.json", "utf8"));
for (const [name, id] of Object.entries(ids)) {
  await page.goto(`https://www.walmart.com/orders/${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="productName"]', { timeout: 30000 });
  await page.addScriptTag({ content: harness });
  await page.evaluate(() => window.__billsplit.expand());
  await page.waitForTimeout(1500);
  // Mask personal details before capturing.
  await page.evaluate(() => {
    const re = /(Ending in \d{4}|Hi, \w+( \w)?|\d{3,} [A-Z][a-z]+ (St|Ave|Rd|Dr|Blvd|Ln|Way)\b[^\n]*)/g;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, "███");
    document.querySelectorAll('[data-testid*="address" i], [class*="address" i]').forEach((e) => (e.style.filter = "blur(6px)"));
  });
  const check = JSON.parse(await page.evaluate(() => window.__billsplit.check()));
  fs.writeFileSync(`${out}/${name}.json`, JSON.stringify({ ...check, id: "…" + check.id.slice(-4) }, null, 2));
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(name, check.parsedLines, check.pageTiles, check.warnings.length);
}
await page.close();
await b.close().catch(() => {});
