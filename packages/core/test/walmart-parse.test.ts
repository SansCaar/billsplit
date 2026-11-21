import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseWalmartOrder, reconcile, extractOrderJsonFromHtml } from "../src/walmart/index";
import { splitOrder, DEFAULT_SPLIT_RULES, type Assignments, type ParsedOrder } from "../src/index";

const dir = path.join(import.meta.dirname, "fixtures/walmart");
const load = (name: string): ParsedOrder =>
  parseWalmartOrder(JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8")), `https://www.walmart.com/orders/x`);
const all = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

describe("Walmart parser — every real-order fixture", () => {
  it.each(all)("%s accounts for every cent of Walmart's total with no warnings", (name) => {
    const o = load(name);
    expect(o.warnings).toEqual([]);
    expect(reconcile(o)).toBe(0);
    expect(o.orderNumber).toMatch(/^9000/);
    for (const i of o.items) {
      expect(i.key).toBeTruthy();
      expect(i.name).not.toBe("Unknown item");
      expect(Number.isInteger(i.amount)).toBe(true);
    }
    expect(new Set(o.items.map((i) => i.key)).size).toBe(o.items.length);
  });

  it.each(all)("%s can be fully split among Members with nothing lost", (name) => {
    const o = load(name);
    const members = ["a", "b", "c"];
    const a: Assignments = {};
    o.items.forEach((i, idx) => (a[i.key] = { method: "equal", shares: [{ memberId: members[idx % 3]! }, ...(idx % 2 ? [{ memberId: "c" }] : [])] }));
    const r = splitOrder(o, a, DEFAULT_SPLIT_RULES);
    expect(r.assignedTotal + r.unassignedRemainder).toBe(o.total);
    expect(r.unassignedRemainder).toBeGreaterThanOrEqual(-5);
    expect(r.unassignedRemainder).toBeLessThan(20);
  });
});

describe("Walmart parser — specific cases", () => {
  it("substituted order: 15 lines, 49 units, substitute keeps original name", () => {
    const o = load("substituted-49-items");
    expect(o.items).toHaveLength(15);
    expect(Math.round(o.items.reduce((s, i) => s + i.quantity, 0))).toBe(48); // Walmart says 49: it counts 0.198 lb of ginger as 1
    const sub = o.items.find((i) => i.status === "substituted")!;
    expect(sub.name).toBe("Fresh Honeycrisp Apple, Each");
    expect(sub.substitutedFor).toBe("Fresh Red Mango, Each");
    expect(sub.amount).toBe(872);
    expect(o.subtotal).toBe(5069);
    expect(o.tax).toBe(253);
    expect(o.total).toBe(5322);
    expect(o.paymentCards).toEqual([{ brand: "OnePay CashRewards", last4: "4242" }]);
    expect(o.placedAt).toBe("2026-11-20T00:13:42-06:00");
  });

  it("two Fulfillments; unavailable items are $0", () => {
    const o = load("two-fulfillments-unavailable");
    expect(o.fulfillments).toHaveLength(2);
    const unavailable = o.items.filter((i) => i.status === "unavailable");
    expect(unavailable).toHaveLength(3);
    expect(unavailable.every((i) => i.amount === 0)).toBe(true);
    expect(o.items.reduce((s, i) => s + i.amount, 0)).toBe(9209);
  });

  it("returned item: amount 0 and its tax is removed", () => {
    const o = load("returned-item-refund");
    const ret = o.items.filter((i) => i.status === "refunded");
    expect(ret.map((i) => i.name)).toEqual([expect.stringContaining("Tide PODS")]);
    expect(ret[0]!.amount).toBe(0);
    expect(o.tax).toBe(745 - 139);
    expect(o.total).toBe(12363);
  });

  it("promo discount already inside line prices is not double-counted", () => {
    const o = load("promo-discount-in-lines");
    expect(o.fees.filter((f) => f.kind === "discount")).toEqual([]);
    expect(o.total).toBe(10744);
  });

  it("driver tip becomes a Fee on the delivery Fulfillment", () => {
    const o = load("driver-tip");
    const tip = o.fees.find((f) => f.kind === "tip")!;
    expect(tip.amount).toBe(1030);
    expect(tip.fulfillmentId).toBe(o.fulfillments[0]!.id);
  });

  it("express '3 hours or less' fee is a delivery Fee; free delivery rows are dropped", () => {
    const o = load("express-delivery-fee");
    expect(o.fees).toEqual([expect.objectContaining({ label: "3 hours or less", kind: "delivery", amount: 500, fulfillmentId: o.fulfillments[0]!.id })]);
  });

  it("shipped marketplace item and store delivery are separate Fulfillments", () => {
    const o = load("shipped-plus-store-delivery");
    expect(o.fulfillments.map((f) => f.kind).sort()).toEqual(["delivery", "shipping"]);
    expect(o.fulfillments.find((f) => f.kind === "shipping")!.label).toMatch(/^Shipped by /);
  });

  it("a fully canceled order has only $0 items", () => {
    const o = load("fully-canceled");
    expect(o.items.length).toBeGreaterThan(0);
    expect(o.items.every((i) => i.amount === 0)).toBe(true);
    expect(o.total).toBe(0);
  });

  it("extracts the order from a full page's HTML", () => {
    const order = JSON.parse(fs.readFileSync(path.join(dir, "driver-tip.json"), "utf8"));
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialData: { data: { order } } } } })}</script></html>`;
    expect(extractOrderJsonFromHtml(html).id).toBe(order.id);
    expect(() => extractOrderJsonFromHtml("<html></html>")).toThrow(/signed in/);
  });
});
