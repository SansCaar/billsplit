// Reduce raw Walmart order JSON (proof/raw, git-ignored) to anonymized fixtures with only parser-relevant fields.
import fs from "node:fs";
// Which real orders become which fixture lives in proof/raw (git-ignored), never in the repo.
const pick = JSON.parse(fs.readFileSync("proof/raw/fixture-map.json", "utf8"));
const out = "packages/core/test/fixtures/walmart";
let n = 0;
const keepPrice = (p) => p && { label: p.label, value: p.value, displayValue: p.displayValue };
const item = (i) => ({
  id: i.id, quantity: i.quantity, statusCode: i.statusCode,
  productInfo: { name: i.productInfo?.name, usItemId: i.productInfo?.usItemId, imageInfo: i.productInfo?.imageInfo },
  priceInfo: { itemPrice: i.priceInfo?.itemPrice, linePrice: i.priceInfo?.linePrice },
});
for (const [name, id] of Object.entries(pick)) {
  const o = JSON.parse(fs.readFileSync(`proof/raw/order-${id}.initialData.json`, "utf8")).data.order;
  n++;
  const fakeId = `9000000000000${String(n).padStart(2, "0")}`;
  const pd = o.priceDetails;
  const groupIds = new Map();
  const gid = (x) => { if (!x) return x; if (!groupIds.has(x)) groupIds.set(x, `group-${groupIds.size + 1}`); return groupIds.get(x); };
  const fx = {
    id: fakeId,
    orderDate: o.orderDate,
    tippableGroup: o.tippableGroup ? { id: gid(o.tippableGroup.id) } : null,
    paymentMethods: (o.paymentMethods || []).map((p) => ({ title: p.title, cardType: p.cardType, paymentType: p.paymentType, description: p.description ? "Ending in 4242" : null, displayValues: p.displayValues })),
    priceDetails: {
      subTotal: keepPrice(pd.subTotal), taxTotal: keepPrice(pd.taxTotal), grandTotal: keepPrice(pd.grandTotal),
      grandTotalWithTips: keepPrice(pd.grandTotalWithTips), driverTip: keepPrice(pd.driverTip), belowMinimumFee: keepPrice(pd.belowMinimumFee),
      fees: (pd.fees || []).map(keepPrice), discounts: (pd.discounts || []).map((d) => ({ ...keepPrice(d), label: /promo code/i.test(d.label) ? "TESTCODE promo code" : d.label })),
      refund: Array.isArray(pd.refund) ? pd.refund.map(keepPrice) : keepPrice(pd.refund),
    },
    groups_2101: o.groups_2101.map((g, gi) => ({
      id: gid(g.id), purchaseOrderId: g.purchaseOrderId ? `po-${gi + 1}` : null,
      fulfillmentType: g.fulfillmentType, detailedGroupType: g.detailedGroupType, deliveryMessage: g.deliveryMessage,
      seller: g.seller ? { name: g.seller.name } : null,
      items: g.items.map(item),
      categories: (g.categories || []).map((c) => ({ type: c.type, name: c.name, items: c.items.map(item), substitutions: c.substitutions ? c.substitutions.map(item) : null })),
    })),
  };
  fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(fx, null, 1));
}
// PII check: none of these strings may appear in fixtures.
// PII check: real card digits and order numbers (read from the raw data) must not appear in fixtures.
const realDigits = new Set();
for (const f of fs.readdirSync("proof/raw").filter((f) => f.endsWith(".initialData.json"))) {
  const o = JSON.parse(fs.readFileSync(`proof/raw/${f}`, "utf8")).data.order;
  for (const p of o.paymentMethods || []) { const m = String(p.description || "").match(/(\d{4})\s*$/); if (m) realDigits.add(m[1]); }
}
const forbidden = [new RegExp(process.env.PII_NAMES || "^$", "i"), new RegExp(`\\b(${[...realDigits].join("|") || "^$"})\\b`), /2000\d{11}/, /@/];
for (const f of fs.readdirSync(out)) {
  const s = fs.readFileSync(`${out}/${f}`, "utf8");
  for (const re of forbidden) if (re.test(s)) console.log("PII MATCH", f, re, s.match(re)[0]);
}
console.log("wrote", fs.readdirSync(out).length, "fixtures");
