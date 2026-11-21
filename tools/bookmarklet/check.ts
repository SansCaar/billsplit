// Bookmarklet (check only): runs the real Walmart parser on the open order page and shows a summary. Sends nothing anywhere.
import { orderIdFromPath, parseOrderHtml, expandAllSections, visibleItemNames, crossCheck } from "../../apps/extension/src/walmartPage";
import { reconcile as totalCheck } from "@billsplit/core/walmart";

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;
function show(html: string) {
  document.getElementById("bs-check")?.remove();
  const d = document.createElement("div");
  d.id = "bs-check";
  d.setAttribute("style", "position:fixed;inset:auto 10px 10px 10px;max-height:70vh;overflow:auto;z-index:2147483647;background:#fff;color:#111;border-radius:14px;padding:16px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35)");
  d.innerHTML = html + `<button style="margin-top:12px;width:100%;padding:12px;border:0;border-radius:10px;background:#5b5bf7;color:#fff;font-weight:700">Close</button>`;
  d.querySelector("button")!.onclick = () => d.remove();
  document.body.appendChild(d);
}
(async () => {
  const id = orderIdFromPath(location.pathname);
  if (!id) return show("<b>Bill Split</b><br>Open a single order's details page first (walmart.com/orders/…).");
  show("<b>Bill Split</b><br>Reading order…");
  try {
    const res = await fetch(`/orders/${id}`, { credentials: "include" });
    const o = parseOrderHtml(await res.text(), location.href);
    expandAllSections();
    await new Promise((r) => setTimeout(r, 900));
    o.warnings.push(...crossCheck(o, visibleItemNames()));
    const diff = totalCheck(o);
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
    show(`<b>Bill Split check ${diff === 0 ? "✅" : "⚠️"}</b><br>
      Items: ${o.items.length} (${o.items.filter((i) => i.status !== "ok").length} not charged/changed)<br>
      Fees: ${o.fees.length} · Tax: ${$(o.tax)}<br>
      Walmart total: ${o.total === null ? "?" : $(o.total)}<br>
      Matches to the cent: <b>${diff === 0 ? "yes" : `no, off by ${diff}¢`}</b>
      ${o.warnings.length ? `<ul>${o.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}`);
  } catch (e) {
    show(`<b>Bill Split ❌</b><br>${(e as Error).message}`);
  }
})();
