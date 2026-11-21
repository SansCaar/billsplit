import { chromium } from "playwright-core";
import { wsUrl } from "./cdp.mjs";
const b = await chromium.connectOverCDP(wsUrl(), { timeout: 60000 });
console.log("contexts", b.contexts().length, b.contexts().map(c => c.pages().map(p => p.url().slice(0, 60))));
await b.close();
