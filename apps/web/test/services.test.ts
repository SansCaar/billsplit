import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";
import { parseWalmartOrder } from "@billsplit/core/walmart";
import type { Assignments, ParsedOrder } from "@billsplit/core";
import * as svc from "../lib/services";
import type { Actor } from "../lib/model";

let mongo: MongoMemoryServer;
let client: MongoClient;
let db: Db;
const fixtures = path.resolve(import.meta.dirname, "../../../packages/core/test/fixtures/walmart");
const fixture = (n: string): ParsedOrder => parseWalmartOrder(JSON.parse(fs.readFileSync(`${fixtures}/${n}.json`, "utf8")));

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongo.getUri());
});
afterAll(async () => {
  await client.close();
  await mongo.stop();
});

let sanskar: Actor, ayush: Actor, outsider: Actor;
beforeEach(async () => {
  db = client.db(`t${Math.random().toString(36).slice(2)}`);
  await svc.ensureIndexes(db);
  const u1 = await svc.upsertUser(db, { email: "s@example.com", name: "Sanskar" });
  const u2 = await svc.upsertUser(db, { email: "a@example.com", name: "Ayush" });
  const u3 = await svc.upsertUser(db, { email: "x@example.com", name: "Mallory" });
  sanskar = { userId: u1._id, name: u1.name };
  ayush = { userId: u2._id, name: u2.name };
  outsider = { userId: u3._id, name: u3.name };
});

async function household() {
  const g = await svc.createGroup(db, sanskar, { name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant"] });
  const ayushSpot = g.members.find((m) => m.name === "Ayush")!;
  await svc.joinGroup(db, ayush, g.invite.token, ayushSpot.id);
  const [s, a, n] = g.members.map((m) => m.id) as [string, string, string];
  return { g, s, a, n };
}

const assignRoundRobin = (o: ParsedOrder, ids: string[]): Assignments =>
  Object.fromEntries(o.items.map((i, idx) => [i.key, { method: "equal" as const, shares: [{ memberId: ids[idx % ids.length]! }] }]));

describe("groups, invites, members", () => {
  it("invite link joins and claims a placeholder; only the creator can turn it off", async () => {
    const { g, a } = await household();
    const after = (await svc.listGroups(db, ayush))[0]!;
    expect(after.members.find((m) => m.id === a)!.userId).toBe(ayush.userId);
    await expect(svc.setInvite(db, ayush, g._id, { enabled: false })).rejects.toThrow(/creator/);
    await svc.setInvite(db, sanskar, g._id, { enabled: false });
    await expect(svc.joinGroup(db, outsider, g.invite.token)).rejects.toThrow(/turned off/);
  });

  it("outsiders cannot read a group", async () => {
    const { g } = await household();
    await expect(svc.groupSummary(db, outsider, g._id)).rejects.toThrow(/not a member/);
  });

  it("a member can only leave at a $0 balance", async () => {
    const { g, s, n } = await household();
    await svc.createManualExpense(db, sanskar, g._id, { title: "Pizza", amount: 3000, payerId: s, split: { method: "equal", shares: [{ memberId: s }, { memberId: n }] } });
    await expect(svc.removeMember(db, sanskar, g._id, n)).rejects.toThrow(/balance is \$0.00/);
    await svc.recordSettlement(db, sanskar, g._id, { fromId: n, toId: s, amount: 1500 });
    await svc.removeMember(db, sanskar, g._id, n);
  });
});

describe("processing Walmart orders", () => {
  it("adds a real order as one Expense, tax proportional, payer credited sum of shares", async () => {
    const { g, s, a, n } = await household();
    const order = fixture("substituted-49-items");
    const { expense, created } = await svc.processOrder(db, sanskar, g._id, {
      order, assignments: assignRoundRobin(order, [s, a, n]), rules: g.defaults.splitRules, payerId: a,
    });
    expect(created).toBe(true);
    expect(expense.title).toBe(`Walmart #${order.orderNumber}`);
    expect(expense.amount).toBe(5322);
    expect(expense.walmart!.card).toEqual({ brand: "OnePay CashRewards", last4: "4242" });
    expect(expense.date.toISOString()).toBe(new Date("2026-11-20T00:13:42-06:00").toISOString());
    const sum = Object.values(expense.shares).reduce((x, y) => x + y, 0);
    expect(sum + expense.unassignedRemainder).toBe(5322);
    const summary = await svc.groupSummary(db, ayush, g._id);
    expect(summary.balances[a]).toBe(sum - expense.shares[a]!);
    expect(summary.activity[0]!.action).toBe("order.processed");
    expect(await svc.listSnapshots(db, sanskar, expense._id)).toHaveLength(1);
  });

  it("refuses to send an order with unassigned items", async () => {
    const { g, s } = await household();
    const order = fixture("two-fulfillments-unavailable");
    const partial = assignRoundRobin(order, [s]);
    delete partial[order.items.find((i) => i.amount > 0)!.key];
    await expect(svc.processOrder(db, sanskar, g._id, { order, assignments: partial, rules: g.defaults.splitRules, payerId: s })).rejects.toThrow(/unassigned/);
  });

  it("unavailable ($0) items do not need assignment", async () => {
    const { g, s } = await household();
    const order = fixture("two-fulfillments-unavailable");
    const a = assignRoundRobin({ ...order, items: order.items.filter((i) => i.amount > 0) }, [s]);
    await expect(svc.processOrder(db, sanskar, g._id, { order, assignments: a, rules: g.defaults.splitRules, payerId: s })).resolves.toBeTruthy();
  });

  it("re-processing the same order updates it, keeps assignments, shows changes, never duplicates", async () => {
    const { g, s, a } = await household();
    const order = fixture("substituted-49-items");
    const first = assignRoundRobin(order, [s, a]);
    const { expense } = await svc.processOrder(db, sanskar, g._id, { order, assignments: first, rules: g.defaults.splitRules, payerId: s });

    // Walmart later refunds one item and the tax drops.
    const changed: ParsedOrder = structuredClone(order);
    const refunded = changed.items[3]!;
    refunded.amount = 0;
    refunded.status = "refunded";
    changed.tax -= 20;
    changed.total = changed.total! - order.items[3]!.amount - 20;

    const preview = await svc.previewReprocess(db, ayush, g._id, changed);
    expect(preview.exists).toBe(true);
    if (!preview.exists) return;
    expect(preview.changes.map((c) => c.text)).toEqual(expect.arrayContaining([expect.stringContaining("Tax:"), expect.stringContaining(refunded.name)]));
    expect(preview.assignments).toEqual(first);

    const res = await svc.processOrder(db, ayush, g._id, { order: changed, assignments: preview.assignments, rules: preview.rules, payerId: preview.payerId });
    expect(res.created).toBe(false);
    expect(res.expense._id).toBe(expense._id);
    expect(res.expense.amount).toBe(changed.total);
    const all = await svc.groupSummary(db, sanskar, g._id);
    expect(all.expenses).toHaveLength(1);
    const act = await svc.listActivity(db, sanskar, g._id, { expenseId: expense._id });
    expect(act.map((x) => x.action)).toEqual(["order.reprocessed", "order.processed"]);
    expect(act[0]!.actorName).toBe("Ayush");
    expect(act[0]!.changes.length).toBeGreaterThan(0);
    expect(await svc.listSnapshots(db, sanskar, expense._id)).toHaveLength(2);
  });

  it("the same order in two different groups is allowed", async () => {
    const { g, s } = await household();
    const g2 = await svc.createGroup(db, sanskar, { name: "Trip" });
    const order = fixture("driver-tip");
    await svc.processOrder(db, sanskar, g._id, { order, assignments: assignRoundRobin(order, [s]), rules: g.defaults.splitRules, payerId: s });
    const me2 = g2.members[0]!.id;
    await svc.processOrder(db, sanskar, g2._id, { order, assignments: assignRoundRobin(order, [me2]), rules: g2.defaults.splitRules, payerId: me2 });
  });
});

describe("editing and activity", () => {
  it("any member can reassign an item; the change is logged with names", async () => {
    const { g, s, a, n } = await household();
    const order = fixture("express-delivery-fee");
    const { expense } = await svc.processOrder(db, sanskar, g._id, { order, assignments: assignRoundRobin(order, [s]), rules: g.defaults.splitRules, payerId: s });
    const key = order.items.find((i) => i.amount > 0)!.key;
    const assignments = { ...expense.walmart!.assignments, [key]: { method: "equal" as const, shares: [{ memberId: a }, { memberId: n }] } };
    await svc.updateExpense(db, ayush, expense._id, { assignments, rules: { tax: "equal", fees: "proportional" } });
    const [act] = await svc.listActivity(db, sanskar, g._id, { expenseId: expense._id });
    expect(act!.action).toBe("expense.updated");
    expect(act!.actorName).toBe("Ayush");
    const labels = act!.changes.map((c) => `${c.label}: ${c.before} → ${c.after}`);
    expect(labels).toEqual(expect.arrayContaining([
      expect.stringMatching(/: Sanskar → Ayush, Nishant$/),
      "Tax split: proportional → equal",
      "Fee split: equal → proportional",
    ]));
  });

  it("delete is soft and restorable; balances ignore deleted expenses", async () => {
    const { g, s, a } = await household();
    const e = await svc.createManualExpense(db, sanskar, g._id, { title: "Internet", amount: 6000, payerId: s, split: { method: "parts", shares: [{ memberId: s, parts: 1 }, { memberId: a, parts: 2 }] } });
    expect((await svc.groupSummary(db, sanskar, g._id)).balances[a]).toBe(-4000);
    await svc.setExpenseDeleted(db, ayush, e._id, true);
    expect((await svc.groupSummary(db, sanskar, g._id)).balances[a]).toBe(0);
    await svc.setExpenseDeleted(db, ayush, e._id, false);
    expect((await svc.groupSummary(db, sanskar, g._id)).balances[a]).toBe(-4000);
    const acts = (await svc.listActivity(db, sanskar, g._id, { expenseId: e._id })).map((x) => x.action);
    expect(acts).toEqual(["expense.restored", "expense.deleted", "expense.created"]);
  });

  it("by-amount split leaves leftover unassigned; payer only credited what was assigned", async () => {
    const { g, s, a } = await household();
    const e = await svc.createManualExpense(db, sanskar, g._id, { title: "Gas", amount: 1000, payerId: s, split: { method: "amount", shares: [{ memberId: a, amount: 600 }, { memberId: s, amount: 300 }] } });
    expect(e.unassignedRemainder).toBe(100);
    const sum = await svc.groupSummary(db, sanskar, g._id);
    expect(sum.balances[s]).toBe(600);
    expect(sum.suggestions).toEqual([{ fromId: a, toId: s, amount: 600 }]);
  });
});

describe("activity ledger impact", () => {
  it("records exactly how each balance moved, summing to zero", async () => {
    const { g, s, a, n } = await household();
    const e = await svc.createManualExpense(db, sanskar, g._id, { title: "Pizza", amount: 3000, payerId: s, split: { method: "equal", shares: [{ memberId: s }, { memberId: a }, { memberId: n }] } });
    let [act] = await svc.listActivity(db, sanskar, g._id, { expenseId: e._id });
    expect(act!.impact).toEqual({ [s]: 2000, [a]: -1000, [n]: -1000 });
    expect(act!.subjectTitle).toBe("Pizza");
    expect(act!.amount).toBe(3000);

    // Nishant drops out: Ayush now owes half, Sanskar is owed $5 less.
    await svc.updateExpense(db, ayush, e._id, { split: { method: "equal", shares: [{ memberId: s }, { memberId: a }] } });
    [act] = await svc.listActivity(db, sanskar, g._id, { expenseId: e._id });
    expect(act!.impact).toEqual({ [s]: -500, [a]: -500, [n]: 1000 });
    expect(Object.values(act!.impact!).reduce((x, y) => x + y, 0)).toBe(0);

    await svc.setExpenseDeleted(db, ayush, e._id, true);
    [act] = await svc.listActivity(db, sanskar, g._id, { expenseId: e._id });
    expect(act!.impact).toEqual({ [s]: -1500, [a]: 1500 });

    await svc.recordSettlement(db, ayush, g._id, { fromId: a, toId: s, amount: 700 });
    const feed = await svc.listActivity(db, sanskar, g._id);
    expect(feed[0]!.impact).toEqual({ [a]: 700, [s]: -700 });
    expect(feed[0]!.subjectTitle).toBe("Ayush → Sanskar");
  });
});
