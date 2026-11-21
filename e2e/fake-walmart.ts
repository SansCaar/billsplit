// Builds a walmart.com order-details page from an anonymized fixture: real Walmart JSON shape in __NEXT_DATA__,
// plus a minimal DOM whose item sections start COLLAPSED (to exercise "expand all dropdowns").
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../packages/core/test/fixtures/walmart");
export const loadFixture = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8"));

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function orderPageHtml(order: any): string {
  const next = { props: { pageProps: { initialData: { data: { order } } } } };
  const sections = order.groups_2101.flatMap((g: any, gi: number) => (g.categories?.length ? g.categories : [{ name: "Items", items: g.items }]).map((c: any, ci: number) => {
    const id = `sec-${gi}-${ci}`;
    const items = c.items.map((i: any) => `<div data-testid="itemtile-stack"><img src="${i.productInfo?.imageInfo?.thumbnailUrl ?? ""}" width=40><span data-testid="productName">${esc(i.productInfo?.name ?? "")}</span> <span data-testid="line-price">${esc(i.priceInfo?.linePrice?.displayValue ?? "")}</span></div>`).join("");
    return `<section><button aria-expanded="false" aria-controls="${id}" onclick="this.setAttribute('aria-expanded','true');document.getElementById('${id}').hidden=false">${esc(c.name ?? "Items")}</button><div id="${id}" hidden>${items}</div></section>`;
  })).join("");
  return `<!doctype html><html><head><title>Order details - Walmart.com</title><style>body{font-family:sans-serif;padding:20px} section{border:1px solid #ddd;margin:8px 0;padding:8px} button{font-weight:bold}</style></head>
<body><header><a href="/orders">Purchase history</a> <button aria-expanded="false">Departments</button></header>
<main><h1>Order #${order.id}</h1><p>Total ${order.priceDetails.grandTotal.displayValue}</p>${sections}</main>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(next).replace(/</g, "\\u003c")}</script></body></html>`;
}

/** Simulate Walmart refunding one item after delivery (moves it to a RETURNED section and adds a refund row). */
export function withRefund(order: any, itemName: string, taxRate = 0.05) {
  const o = structuredClone(order);
  for (const g of o.groups_2101) {
    for (const c of g.categories) {
      const idx = c.items.findIndex((i: any) => i.productInfo.name === itemName);
      if (idx < 0) continue;
      const [it] = c.items.splice(idx, 1);
      g.categories.push({ type: "RETURNED", name: "Return complete", items: [it], substitutions: null });
      const line = it.priceInfo.linePrice.value;
      const refund = Math.round((line + line * taxRate) * 100) / 100;
      const pd = o.priceDetails;
      pd.refund = [{ label: "Refund", value: -refund, displayValue: `-$${refund.toFixed(2)}` }];
      for (const k of ["grandTotal", "grandTotalWithTips"]) if (pd[k]) pd[k].value = Math.round((pd[k].value - refund) * 100) / 100;
      return o;
    }
  }
  throw new Error(`item ${itemName} not found`);
}
