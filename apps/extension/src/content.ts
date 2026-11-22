import { BTN_ID, createSplitButton, setButtonBusy, showButtonError } from "./splitButton";
import { crossCheck, expandAllSections, orderIdFromPath, parseOrderHtml, visibleItemNames } from "./walmartPage";

async function processCurrentOrder(btn?: HTMLButtonElement) {
  const id = orderIdFromPath(location.pathname);
  if (!id) return { error: "Open a single order's details page on walmart.com first." };
  if (btn) setButtonBusy(btn, true);
  document.getElementById("billsplit-toast")?.remove();
  try {
    const res = await fetch(`/orders/${id}`, { credentials: "include" });
    const order = parseOrderHtml(await res.text(), location.href);
    if (order.orderNumber !== id) throw new Error("Walmart returned a different order than the one on screen. Reload and try again.");
    // Heads-up from the user: expand all dropdowns so nothing is hidden, then cross-check against what the page shows.
    expandAllSections();
    await new Promise((r) => setTimeout(r, 900));
    order.warnings.push(...crossCheck(order, visibleItemNames()));
    await chrome.runtime.sendMessage({ type: "open-process", order });
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    const friendly = /__NEXT_DATA__/.test(msg) ? "Walmart didn't send the order details. Make sure you're signed in to walmart.com." : msg;
    showButtonError("Bill Split couldn't read this order", ` ${friendly} Reload the page and click “Split this order” again.`);
    return { error: msg };
  } finally {
    if (btn) setButtonBusy(btn, false);
  }
}

let seenButton: boolean | null = null;
async function ensureButton() {
  const onOrder = !!orderIdFromPath(location.pathname);
  const existing = document.getElementById(BTN_ID);
  if (!onOrder) { existing?.remove(); return; }
  if (existing) return;
  // The full entrance animation plays once per browser; after that the button simply appears.
  if (seenButton === null) seenButton = !!(await chrome.storage.local.get("seenButton")).seenButton;
  if (document.getElementById(BTN_ID)) return;
  const b = createSplitButton((btn) => processCurrentOrder(btn), { quiet: seenButton });
  document.body.appendChild(b);
  if (!seenButton) { seenButton = true; chrome.storage.local.set({ seenButton: true }); }
}

// Walmart is a single-page app: watch for URL changes.
let last = "";
setInterval(() => { if (location.href !== last) { last = location.href; ensureButton(); } }, 700);
ensureButton();

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "process-current") {
    processCurrentOrder(document.getElementById(BTN_ID) as HTMLButtonElement | undefined).then(reply);
    return true;
  }
});
