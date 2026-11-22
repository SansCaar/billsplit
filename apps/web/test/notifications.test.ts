import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Db } from "mongodb";
import * as svc from "../lib/services";
import { activityNotifications, levelFor, type Outgoing } from "../lib/notify";
import { deliverPush } from "../lib/push";
import type { Actor, GroupDoc } from "../lib/model";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) }));

let mongo: MongoMemoryServer;
let client: MongoClient;
let db: Db;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongo.getUri());
});
afterAll(async () => {
  await client.close();
  await mongo.stop();
});

/** Captures what would be pushed, instead of sending it. */
let sent: Outgoing[];
let pending: Promise<void>[];
const flush = async () => { await Promise.all(pending); pending = []; };
const to = (a: Actor) => sent.filter((o) => o.userId === a.userId);

let sanskar: Actor, ayush: Actor, mallory: Actor;
beforeEach(async () => {
  db = client.db(`n${Math.random().toString(36).slice(2)}`);
  await svc.ensureIndexes(db);
  sent = [];
  pending = [];
  svc.notifier.deliver = async (_db, out) => { sent.push(...out); return out.length; };
  svc.notifier.defer = (task) => { pending.push(task()); };
  const mk = async (email: string, name: string) => { const u = await svc.upsertUser(db, { email, name }); return { userId: u._id, name: u.name }; };
  sanskar = await mk("s@example.com", "Sanskar");
  ayush = await mk("a@example.com", "Ayush");
  mallory = await mk("m@example.com", "Mallory");
});

/** Sanskar, Ayush and Mallory have joined; Nishant is a placeholder. */
async function household() {
  const g = await svc.createGroup(db, sanskar, { name: "Apartment 4B", placeholderNames: ["Ayush", "Nishant"] });
  await svc.joinGroup(db, ayush, g.invite.token, g.members.find((m) => m.name === "Ayush")!.id);
  await svc.joinGroup(db, mallory, g.invite.token);
  const group = (await svc.listGroups(db, sanskar))[0]!;
  const id = (n: string) => group.members.find((m) => m.name === n)!.id;
  await flush();
  sent = [];
  return { g: group, s: id("Sanskar"), a: id("Ayush"), n: id("Nishant"), m: id("Mallory") };
}

const equal = (...ids: string[]) => ({ method: "equal" as const, shares: ids.map((memberId) => ({ memberId })) });

describe("Notifications about Activity", () => {
  it("go to Involved Members only by default, never to whoever made the change", async () => {
    const { g, s, a } = await household();
    const e = await svc.createManualExpense(db, sanskar, g._id, { title: "Paper towels", amount: 1200, payerId: s, split: equal(s, a) });
    await flush();
    expect(to(sanskar)).toEqual([]);
    expect(to(mallory)).toEqual([]);
    expect(to(ayush)).toHaveLength(1);
    expect(to(ayush)[0]!.message).toMatchObject({ title: "Apartment 4B", url: `/e/${e._id}`, tag: `expense:${e._id}` });
    expect(to(ayush)[0]!.message.body).toContain("Your balance −$6.00");
  });

  it("level All, set for one Group, gets everything in that Group", async () => {
    const { g, s, a } = await household();
    await svc.setGroupNotifyLevel(db, mallory, g._id, "all");
    await svc.createManualExpense(db, sanskar, g._id, { title: "Paper towels", amount: 1200, payerId: s, split: equal(s, a) });
    await flush();
    expect(to(mallory)).toHaveLength(1);
    expect(to(mallory)[0]!.message.body).not.toContain("Your balance");
    // Back to the default (Involved): nothing.
    await svc.setGroupNotifyLevel(db, mallory, g._id, null);
    await svc.createManualExpense(db, sanskar, g._id, { title: "Soap", amount: 400, payerId: s, split: equal(s, a) });
    await flush();
    expect(to(mallory)).toHaveLength(1);
  });

  it("someone taken off an expense is still Involved in that change", async () => {
    const { g, s, a, m } = await household();
    const e = await svc.createManualExpense(db, sanskar, g._id, { title: "Snacks", amount: 900, payerId: s, split: equal(s, a, m) });
    await flush();
    sent = [];
    await svc.updateExpense(db, sanskar, e._id, { split: equal(s, a) });
    await flush();
    expect(to(mallory)).toHaveLength(1);
    expect(to(mallory)[0]!.message.body).toContain("Your balance +$3.00");
  });

  it("payments open the Expenses tab; member changes involve everyone and open the Members tab", async () => {
    const { g, s, a } = await household();
    await svc.recordSettlement(db, ayush, g._id, { fromId: a, toId: s, amount: 4000 });
    await flush();
    expect(to(sanskar)[0]!.message.url).toBe(`/g/${g._id}?tab=expenses`);
    expect(to(mallory)).toEqual([]);
    sent = [];
    await svc.addPlaceholderMember(db, sanskar, g._id, "Priya");
    await flush();
    expect(sent.map((o) => o.userId).sort()).toEqual([ayush.userId, mallory.userId].sort());
    expect(sent[0]!.message.url).toBe(`/g/${g._id}?tab=settings`);
  });

  it("nothing is sent when no transport is configured", async () => {
    const { g, s, a } = await household();
    svc.notifier.deliver = null;
    await svc.createManualExpense(db, sanskar, g._id, { title: "Soap", amount: 400, payerId: s, split: equal(s, a) });
    await flush();
    expect(sent).toEqual([]);
  });
});

describe("Nudges", () => {
  it("ask for exactly what Settle up shows, reach the receiver, and are not Activities", async () => {
    const { g, s, a } = await household();
    await svc.createManualExpense(db, sanskar, g._id, { title: "Groceries", amount: 3000, payerId: s, split: equal(s, a) });
    await flush();
    sent = [];
    const before = await db.collection("activity").countDocuments();
    const r = await svc.sendNudge(db, sanskar, g._id, { toId: a, line: 0 });
    await flush();
    expect(r).toEqual({ amount: 1500, count: 1 });
    expect(to(ayush)).toHaveLength(1);
    expect(to(ayush)[0]!.message).toMatchObject({ title: "Sanskar nudged you · Apartment 4B", url: `/g/${g._id}?tab=settle` });
    expect(to(ayush)[0]!.message.body).toBe("Sanskar is down to the last packet of ramen. You owe $15.00.");
    expect(await db.collection("activity").countDocuments()).toBe(before);
    expect((await svc.groupSummary(db, ayush, g._id)).nudges).toEqual({ [svc.nudgeKey(s, a)]: 1 });
  });

  it("only the person owed can nudge, and never a placeholder", async () => {
    const { g, s, a, n, m } = await household();
    await svc.createManualExpense(db, sanskar, g._id, { title: "Groceries", amount: 3000, payerId: s, split: equal(s, a, n) });
    await expect(svc.sendNudge(db, ayush, g._id, { toId: s, line: 0 })).rejects.toThrow(/doesn't owe you/);
    await expect(svc.sendNudge(db, sanskar, g._id, { toId: m, line: 0 })).rejects.toThrow(/doesn't owe you/);
    await expect(svc.sendNudge(db, sanskar, g._id, { toId: n, line: 0 })).rejects.toThrow(/hasn't joined/);
    await expect(svc.sendNudge(db, sanskar, g._id, { toId: a, line: 999 })).rejects.toThrow(/lines/);
  });

  it("are limited to 3 per pair in any 24 hours", async () => {
    const { g, s, a } = await household();
    await svc.createManualExpense(db, sanskar, g._id, { title: "Groceries", amount: 3000, payerId: s, split: equal(s, a) });
    const t0 = new Date("2026-11-21T10:00:00Z");
    for (let i = 0; i < 3; i++) await svc.sendNudge(db, sanskar, g._id, { toId: a, line: i }, new Date(t0.getTime() + i * 60_000));
    await expect(svc.sendNudge(db, sanskar, g._id, { toId: a, line: 3 }, new Date(t0.getTime() + 3600_000))).rejects.toThrow(/3 times today/);
    // Rolling window: once the first Nudge is 24h old, one slot frees up (the other two are still recent).
    const nextDay = new Date(t0.getTime() + 24 * 3600_000 + 1000);
    await expect(svc.sendNudge(db, sanskar, g._id, { toId: a, line: 3 }, nextDay)).resolves.toMatchObject({ count: 3 });
    await expect(svc.sendNudge(db, sanskar, g._id, { toId: a, line: 4 }, nextDay)).rejects.toThrow(/3 times today/);
  });
});

describe("pure rules", () => {
  it("a per-Group level overrides the default", () => {
    expect(levelFor(undefined, "g1")).toBe("involved");
    expect(levelFor({ level: "all" }, "g1")).toBe("all");
    expect(levelFor({ level: "all", groups: { g1: "involved" } }, "g1")).toBe("involved");
  });

  it("left Members and placeholders get nothing", () => {
    const group = { _id: "g", name: "G", members: [
      { id: "m1", name: "A", userId: "u1", joinedAt: null, leftAt: null },
      { id: "m2", name: "B", userId: "u2", joinedAt: null, leftAt: new Date() },
      { id: "m3", name: "C", userId: null, joinedAt: null, leftAt: null },
      { id: "m4", name: "D", userId: "u4", joinedAt: null, leftAt: null },
    ] } as Pick<GroupDoc, "_id" | "name" | "members">;
    const a = { _id: "x", groupId: "g", expenseId: null, settlementId: null, actorUserId: "u1", actorName: "A", action: "group.updated" as const, summary: "A renamed", changes: [], involved: ["m1", "m2", "m3", "m4"], at: new Date() };
    expect(activityNotifications(a, group, new Map()).map((o) => o.userId)).toEqual(["u4"]);
  });
});

describe("delivery", () => {
  it("sends to every device and forgets ones the push service says are gone", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    await svc.savePushDevice(db, ayush, { endpoint: "https://push.example/ok", keys: { p256dh: "k", auth: "a" } }, null);
    await svc.savePushDevice(db, ayush, { endpoint: "https://push.example/gone", keys: { p256dh: "k", auth: "a" } }, null);
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith("gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
    });
    const n = await deliverPush(db, [{ userId: ayush.userId, message: { title: "t", body: "b", url: "/", tag: "x" } }]);
    expect(n).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect((await db.collection("pushDevices").find().toArray()).map((d) => d.endpoint)).toEqual(["https://push.example/ok"]);
  });

  it("a shared browser belongs to whoever turned it on last", async () => {
    const sub = { endpoint: "https://push.example/shared", keys: { p256dh: "k", auth: "a" } };
    await svc.savePushDevice(db, ayush, sub, null);
    await svc.savePushDevice(db, mallory, sub, null);
    expect((await db.collection("pushDevices").find().toArray()).map((d) => d.userId)).toEqual([mallory.userId]);
  });
});
