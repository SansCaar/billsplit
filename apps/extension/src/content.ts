import { BTN_ID, createSplitButton, setButtonBusy } from "./splitButton";
import { crossCheck, expandAllSections, orderIdFromPath, parseOrderHtml, visibleItemNames } from "./walmartPage";

async function processCurrentOrder(btn?: HTMLButtonElement) {
  const id = orderIdFromPath(location.pathname);
  if (!id) return { error: "Open a single order's details page on walmart.com first." };
  if (btn) setButtonBusy(btn, true);
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
    alert(`Bill Split: ${msg}`);
    return { error: msg };
  } finally {
    if (btn) setButtonBusy(btn, false);
  }
}

function ensureButton() {
  const onOrder = !!orderIdFromPath(location.pathname);
  const existing = document.getElementById(BTN_ID);
  if (!onOrder) { existing?.remove(); return; }
  if (existing) return;
  const b = createSplitButton((btn) => processCurrentOrder(btn));
  document.body.appendChild(b);
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
