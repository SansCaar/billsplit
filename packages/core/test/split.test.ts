import { describe, expect, it } from "vitest";
import {
  computeBalances,
  diffOrders,
  carryAssignments,
  resolveSplit,
  splitOrder,
  suggestSettlements,
  unassignedItems,
  type Item,
  type ParsedOrder,
  DEFAULT_SPLIT_RULES,
} from "../src/index";

const item = (key: string, amount: number, fulfillmentId: string | null = "f1", extra: Partial<Item> = {}): Item => ({
  key, name: key, quantity: 1, amount, fulfillmentId, status: "ok", ...extra,
});
const equal = (...ids: string[]) => ({ method: "equal" as const, shares: ids.map((memberId) => ({ memberId })) });

describe("resolveSplit", () => {
  it("equal split rounds down and leaves the remainder unassigned", () => {
    const r = resolveSplit(1000, equal("a", "b", "c"));
    expect([...r.shares.values()]).toEqual([333, 333, 333]);
    expect(r.remainder).toBe(1);
  });
  it("by parts", () => {
    const r = resolveSplit(900, { method: "parts", shares: [{ memberId: "a", parts: 2 }, { memberId: "b", parts: 1 }] });
    expect(Object.fromEntries(r.shares)).toEqual({ a: 600, b: 300 });
    expect(r.remainder).toBe(0);
  });
  it("by amount; leftover is unassigned; over-allocation throws", () => {
    const r = resolveSplit(1000, { method: "amount", shares: [{ memberId: "a", amount: 700 }, { memberId: "b", amount: 250 }] });
    expect(r.remainder).toBe(50);
    expect(() => resolveSplit(100, { method: "amount", shares: [{ memberId: "a", amount: 101 }] })).toThrow();
  });
});

describe("splitOrder", () => {
  it("tax is proportional to item totals by default", () => {
    const order = { items: [item("milk", 300), item("tv", 900)], fees: [], tax: 120 };
    const r = splitOrder(order, { milk: equal("a"), tv: equal("b") }, DEFAULT_SPLIT_RULES);
    expect(r.members.a).toEqual({ items: 300, tax: 30, fees: 0, total: 330 });
    expect(r.members.b).toEqual({ items: 900, tax: 90, fees: 0, total: 990 });
    expect(r.unassignedRemainder).toBe(0);
  });

  it("tax can be switched to equal", () => {
    const order = { items: [item("milk", 300), item("tv", 900)], fees: [], tax: 120 };
    const r = splitOrder(order, { milk: equal("a"), tv: equal("b") }, { tax: "equal", fees: "equal" });
    expect(r.members.a!.tax).toBe(60);
    expect(r.members.b!.tax).toBe(60);
  });

  it("a Fulfillment fee only goes to Members with Items in that Fulfillment", () => {
    const order = {
      items: [item("milk", 500, "delivery"), item("eggs", 500, "delivery"), item("lamp", 2000, "shipping")],
      fees: [{ key: "ship", label: "Shipping", kind: "shipping" as const, amount: 600, fulfillmentId: "shipping" }],
      tax: 0,
    };
    const r = splitOrder(order, { milk: equal("a"), eggs: equal("b"), lamp: equal("b", "c") }, DEFAULT_SPLIT_RULES);
    expect(r.members.a!.fees).toBe(0);
    expect(r.members.b!.fees).toBe(300);
    expect(r.members.c!.fees).toBe(300);
  });

  it("an Order-level fee (tip) is split equally among everyone with Items", () => {
    const order = {
      items: [item("milk", 100, "d"), item("lamp", 10000, "s")],
      fees: [{ key: "tip", label: "Driver tip", kind: "tip" as const, amount: 500, fulfillmentId: null }],
      tax: 0,
    };
    const r = splitOrder(order, { milk: equal("a"), lamp: equal("b") }, DEFAULT_SPLIT_RULES);
    expect(r.members.a!.fees).toBe(250);
    expect(r.members.b!.fees).toBe(250);
  });

  it("fees can be proportional", () => {
    const order = {
      items: [item("x", 100), item("y", 300)],
      fees: [{ key: "d", label: "Delivery", kind: "delivery" as const, amount: 400, fulfillmentId: "f1" }],
      tax: 0,
    };
    const r = splitOrder(order, { x: equal("a"), y: equal("b") }, { tax: "proportional", fees: "proportional" });
    expect(r.members.a!.fees).toBe(100);
    expect(r.members.b!.fees).toBe(300);
  });

  it("refunded items are $0 and need no assignment; payer credit = sum of shares", () => {
    const order = { items: [item("a1", 1000), item("gone", 0, "f1", { status: "refunded" })], fees: [], tax: 0 };
    expect(unassignedItems(order, {})).toHaveLength(1);
    const r = splitOrder(order, { a1: equal("a", "b", "c") }, DEFAULT_SPLIT_RULES);
    expect(r.assignedTotal).toBe(999);
    expect(r.unassignedRemainder).toBe(1);
    expect(r.assignedTotal + r.unassignedRemainder).toBe(r.splitTotal);
  });
});

describe("balances", () => {
  it("payer is credited the sum of shares; settlements reduce debt", () => {
    const b = computeBalances(
      [{ payerId: "a", shares: { a: 333, b: 333, c: 333 } }],
      [{ fromId: "b", toId: "a", amount: 333 }],
    );
    expect(b).toEqual({ a: 333, b: 0, c: -333 });
    expect(suggestSettlements(b)).toEqual([{ fromId: "c", toId: "a", amount: 333 }]);
  });
  it("deleted expenses are ignored", () => {
    expect(computeBalances([{ payerId: "a", shares: { b: 100 }, deleted: true }], [], ["a", "b"])).toEqual({ a: 0, b: 0 });
  });
});

describe("re-processing", () => {
  const base: ParsedOrder = {
    orderNumber: "1", placedAt: null, sourceUrl: "", fulfillments: [], fees: [], subtotal: null, total: null,
    tax: 100, paymentCards: [], warnings: [], items: [item("milk", 300), item("eggs", 400)],
  };
  it("detects refunds, new items and tax changes, and carries assignments", () => {
    const next: ParsedOrder = { ...base, tax: 80, items: [item("milk", 0, "f1", { status: "refunded" }), item("bread", 250)] };
    const changes = diffOrders(base, next);
    expect(changes.map((c) => c.type).sort()).toEqual(["item-added", "item-changed", "item-removed", "tax-changed"]);
    const carried = carryAssignments({ milk: equal("a"), eggs: equal("b") }, next);
    expect(Object.keys(carried)).toEqual(["milk"]);
  });
});
