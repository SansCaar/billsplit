// Records the ~30 s captioned installation guide in docs/demo. Skipped in normal test runs.
//
//   pnpm build:ext                                  # extension pointed at the hosted app
//   cd e2e && DEMO=1 npx playwright test install-video
//   ../tools/make-install-video.sh                  # stitches .install-clips into docs/demo/install-guide.mp4 + .gif
//
// Chrome's native folder picker can't be recorded from Playwright, so that step is a caption; everything else is the
// real chrome://extensions page and the real extension on a fake walmart.com (anonymized fixture).
import { test, chromium, type BrowserContext, type Page, type Locator } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadFixture, orderPageHtml } from "./fake-walmart";

test.skip(!process.env.DEMO, "set DEMO=1 to record the install video");

const DIST = process.env.EXT_DIR ?? path.resolve(import.meta.dirname, "../apps/extension/dist");
const OUT = path.resolve(import.meta.dirname, "../.install-clips");
const SIZE = { width: 1280, height: 800 };
const order = loadFixture("substituted-49-items");
const ORDER_URL = `https://www.walmart.com/orders/${order.id}`;
const INSTALL_CMD = "curl -fsSL https://raw.githubusercontent.com/SansCaar/billsplit/main/tools/install-extension.sh | zsh";

// ---------- clip bookkeeping (each tab records its own video; log which tab is on screen when) ----------
type Seg = { page: Page; from: number; to?: number };
const born = new Map<Page, number>();
const segs: Seg[] = [];
const track = (p: Page) => { born.set(p, Date.now()); return p; };
function show(p: Page) {
  const now = Date.now();
  const last = segs.at(-1);
  if (last && last.page === p) return;
  if (last) last.to = now;
  segs.push({ page: p, from: now });
}

// ---------- captions, step badge and a visible cursor ----------
const OVERLAY = `
  (() => {
    if (document.getElementById('demo-cap')) return;
    const css = document.createElement('style');
    css.textContent = \`
      #demo-cap{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:1040px;
        background:rgba(17,24,39,.92);color:#fff;font:600 22px/1.35 -apple-system,system-ui,sans-serif;padding:14px 26px;
        border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center;transition:opacity .25s;pointer-events:none}
      #demo-cap b{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#245b47;margin-right:10px;font-size:17px;vertical-align:1px}
      #demo-cap small{display:block;font-weight:500;font-size:16px;opacity:.75;margin-top:4px}
      #demo-cap:empty{opacity:0}
      #demo-cur{position:fixed;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(255,196,0,.55);border:2px solid #f59e0b;z-index:2147483647;pointer-events:none;
        transition:left .55s cubic-bezier(.3,.7,.2,1),top .55s cubic-bezier(.3,.7,.2,1),transform .15s}
      #demo-cur.down{transform:scale(.7)}\`;
    document.documentElement.appendChild(css);
    const cap = document.createElement('div'); cap.id = 'demo-cap'; document.documentElement.appendChild(cap);
    const cur = document.createElement('div'); cur.id = 'demo-cur'; document.documentElement.appendChild(cur);
  })()`;
const overlay = (p: Page) => p.evaluate(OVERLAY);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function say(p: Page, step: string, text: string, sub = "", hold = 2000) {
  await overlay(p);
  await p.evaluate(([n, t, s]) => {
    // Built from nodes, not innerHTML: chrome:// pages enforce Trusted Types.
    const cap = document.getElementById("demo-cap")!;
    cap.replaceChildren();
    if (!t) return;
    if (n) { const b = document.createElement("b"); b.textContent = n; cap.append(b); }
    cap.append(t);
    if (s) { const sm = document.createElement("small"); sm.textContent = s; cap.append(sm); }
  }, [step, text, sub]);
  await pause(hold);
}
async function point(l: Locator, click = true, hold = 400) {
  const p = l.page();
  await overlay(p);
  const b = (await l.boundingBox())!;
  await p.evaluate(([x, y]) => { const c = document.getElementById("demo-cur")!; c.style.left = `${x}px`; c.style.top = `${y}px`; }, [b.x + b.width / 2, b.y + b.height / 2]);
  await pause(650);
  if (click) {
    await p.evaluate(() => document.getElementById("demo-cur")!.classList.add("down"));
    await pause(120);
    await l.click();
    await p.evaluate(() => document.getElementById("demo-cur")?.classList.remove("down")).catch(() => {});
  }
  await pause(hold);
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
/** A macOS-style Terminal window that types the install command and prints the installer's first-run output. */
function terminalHtml() {
  const out = [
    "› Downloading Bill Split ext-v0.1.3…",
    "✓ Bill Split 0.1.3 downloaded to ~/Bill Split Extension",
    "",
    "  Now add it to Chrome (one time only):",
    "    1. Chrome opens on chrome://extensions. Turn on Developer mode.",
    "    2. Click Load unpacked and pick the 'Bill Split Extension' folder.",
    "    3. Bill Split appears in the list.",
  ];
  return `<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#dfe8e2,#c9d8cf);font-family:-apple-system,system-ui,sans-serif">
  <div style="width:1000px;border-radius:12px;overflow:hidden;box-shadow:0 30px 70px -20px rgba(0,0,0,.45);background:#1e1f22">
    <div style="height:34px;background:#2b2d31;display:flex;align-items:center;gap:8px;padding:0 14px">
      <i style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:50%;background:#28c840"></i>
      <span style="flex:1;text-align:center;color:#9aa0a6;font-size:13px;margin-right:52px">Terminal — zsh</span></div>
    <pre id="t" style="margin:0;padding:22px 24px;height:330px;color:#e8eaed;font:15px/1.6 ui-monospace,Menlo,monospace;white-space:pre-wrap"></pre>
  </div>
  <script>
    const t = document.getElementById('t'), cmd = ${JSON.stringify(INSTALL_CMD)}, out = ${JSON.stringify(out.map(esc))};
    t.innerHTML = '<span style="color:#7fd1ae">~</span> <span style="color:#9aa0a6">%</span> ';
    let i = 0;
    const type = () => { if (i < cmd.length) { t.append(cmd[i++]); setTimeout(type, 14); } else setTimeout(print, 450); };
    let j = 0;
    const print = () => { if (j < out.length) { const l = out[j++]; t.insertAdjacentHTML('beforeend', '\\n' + (l.startsWith('✓') ? '<span style="color:#7fd1ae">' + l + '</span>' : l)); setTimeout(print, j === 1 ? 700 : 140); } };
    window.startTyping = () => setTimeout(type, 300);
  </script></body></html>`;
}

async function card(p: Page, title: string, sub: string, hold: number) {
  await p.setContent(`<html><body style="margin:0;overflow:hidden"><div style="position:fixed;inset:0;display:grid;place-items:center;background:linear-gradient(135deg,#2f7a5f,#1b4536);
    font-family:-apple-system,system-ui,sans-serif;color:#f7faf5;text-align:center"><div><div style="font-size:64px">🧾</div>
    <h1 style="font-size:52px;margin:12px 0 10px">${title}</h1><p style="font-size:24px;opacity:.85;margin:0">${sub}</p></div></div></body></html>`);
  await pause(hold);
}

const launch = (args: string[]) => chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "bs-install-")), {
  channel: "chromium", headless: true, args, viewport: SIZE, recordVideo: { dir: OUT, size: SIZE },
});

let before: BrowserContext; // Chrome before the extension is loaded
let after: BrowserContext; // Chrome with it loaded (from a folder named like the installer's)
test.beforeAll(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const ext = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bs-home-")), "Bill Split Extension");
  fs.cpSync(DIST, ext, { recursive: true });
  before = await launch([]);
  after = await launch([`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]);
  await after.route("https://www.walmart.com/**", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === `/orders/${order.id}`) return route.fulfill({ status: 200, contentType: "text/html", body: orderPageHtml(order) });
    return route.fulfill({ status: 404, body: "not found" });
  });
});

test("record the install guide", async () => {
  test.setTimeout(120_000);
  // Warm up the "after" browser's pages off camera so the cuts are instant.
  const list = track(await after.newPage());
  await list.goto("chrome://extensions");
  await list.locator("#devMode").click();

  // 1) Title + installer in Terminal
  const a = track(await before.newPage());
  show(a);
  await card(a, "Install Bill Split", "The Walmart order splitter for Chrome · about 30 seconds", 2000);
  await a.setContent(terminalHtml());
  await say(a, "1", "Paste this in Terminal", "It downloads the extension to ~/Bill Split Extension", 0);
  await a.evaluate(() => (window as unknown as { startTyping: () => void }).startTyping());
  await pause(5600);

  // 2) chrome://extensions: Developer mode, then Load unpacked
  await a.goto("chrome://extensions");
  await say(a, "2", "Open chrome://extensions and turn on Developer mode", "", 200);
  await point(a.locator("#devMode"), true, 700);
  await say(a, "3", "Click Load unpacked, pick the “Bill Split Extension” folder", "It's in your home folder", 200);
  await point(a.getByRole("button", { name: "Load unpacked" }), false, 2000);

  // 3) It's in the list
  show(list);
  await say(list, "✓", "Bill Split is installed", "To update later, run the same command and click ↻", 2600);

  // 4) A Walmart order: the button appears; click it
  const walmart = track(await after.newPage()); // opened now: an idle blank tab records no frames
  await walmart.goto(ORDER_URL);
  show(walmart);
  await say(walmart, "4", "Open any order on walmart.com", "", 2600);
  await say(walmart, "4", "Click “Split this order”", "", 0);
  const [proc] = await Promise.all([after.waitForEvent("page"), point(walmart.locator("#billsplit-process-btn"), true, 0)]);
  track(proc);
  await proc.waitForLoadState("domcontentloaded");
  await pause(400);
  show(proc);
  await say(proc, "", "Sign in once, then assign every item to your group", "", 2800);
  segs.at(-1)!.to = Date.now();
});

test.afterAll(async () => {
  await Promise.all([before?.close(), after?.close()]); // flushes the videos
  const clips = await Promise.all(segs.map(async (s) => ({
    video: await s.page.video()!.path(),
    from: (s.from - born.get(s.page)!) / 1000,
    to: (s.to! - born.get(s.page)!) / 1000,
  })));
  fs.writeFileSync(path.join(OUT, "segments.json"), JSON.stringify(clips, null, 1));
  const total = clips.reduce((n, c) => n + c.to - Math.max(c.from, 0), 0);
  console.log(`${clips.length} segments, ${total.toFixed(1)} s → ${OUT}/segments.json`);
});
