import { crossCheck, expandAllSections, orderIdFromPath, parseOrderHtml, visibleItemNames } from "./walmartPage";

const BTN_ID = "billsplit-process-btn";

async function processCurrentOrder(btn?: HTMLButtonElement) {
  const id = orderIdFromPath(location.pathname);
  if (!id) return { error: "Open a single order's details page on walmart.com first." };
  if (btn) { btn.disabled = true; btn.textContent = "Reading order…"; }
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
    if (btn) { btn.disabled = false; btn.textContent = "🧾 Split this order"; }
  }
}

function ensureButton() {
  const onOrder = !!orderIdFromPath(location.pathname);
  const existing = document.getElementById(BTN_ID);
  if (!onOrder) { existing?.remove(); return; }
  if (existing) return;
  const b = document.createElement("button");
  b.id = BTN_ID;
  b.textContent = "🧾 Split this order";
  Object.assign(b.style, {
    position: "fixed", right: "22px", bottom: "22px", zIndex: "2147483647", padding: "14px 20px", borderRadius: "999px",
    border: "0", background: "#245b47", color: "#f7faf5", font: "700 15px system-ui,sans-serif",
    boxShadow: "0 12px 30px -10px rgba(27,69,54,.65)", cursor: "pointer",
  } as CSSStyleDeclaration);
  b.addEventListener("click", () => processCurrentOrder(b));
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
