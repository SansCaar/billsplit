import { randomBytes, randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import {
  carryAssignments,
  computeBalances,
  DEFAULT_SPLIT_RULES,
  describeChange,
  diffOrders,
  fmtMoney,
  resolveSplit,
  splitOrder,
  suggestSettlements,
  unassignedItems,
  type Assignments,
  type Cents,
  type FieldChange,
  type MemberId,
  type ParsedOrder,
  type Split,
  type SplitRules,
} from "@billsplit/core";
import type {
  ActivityAction,
  ActivityDoc,
  Actor,
  ExpenseDoc,
  GroupDoc,
  MemberDoc,
  SettlementDoc,
  SnapshotDoc,
  UserDoc,
} from "./model";

export class ServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const id = () => randomUUID();
const token = () => randomBytes(16).toString("base64url");

export const cols = (db: Db) => ({
  users: db.collection<UserDoc>("users"),
  groups: db.collection<GroupDoc>("groups"),
  expenses: db.collection<ExpenseDoc>("expenses"),
  settlements: db.collection<SettlementDoc>("settlements"),
  snapshots: db.collection<SnapshotDoc>("snapshots"),
  activity: db.collection<ActivityDoc>("activity"),
});

export async function ensureIndexes(db: Db) {
  const c = cols(db);
  await Promise.all([
    c.users.createIndex({ email: 1 }, { unique: true }),
    c.groups.createIndex({ "members.userId": 1 }),
    c.groups.createIndex({ "invite.token": 1 }, { unique: true }),
    c.expenses.createIndex({ groupId: 1, date: -1 }),
    c.expenses.createIndex(
      { groupId: 1, "walmart.orderNumber": 1 },
      { unique: true, partialFilterExpression: { kind: "walmart" } },
    ),
    c.settlements.createIndex({ groupId: 1, date: -1 }),
    c.snapshots.createIndex({ expenseId: 1, at: -1 }),
    c.activity.createIndex({ groupId: 1, at: -1 }),
    c.activity.createIndex({ expenseId: 1, at: -1 }),
  ]);
}

/* ---------------- Users ---------------- */

export async function upsertUser(db: Db, u: { email: string; name: string; image?: string | null }): Promise<UserDoc> {
  const email = u.email.toLowerCase().trim();
  const res = await cols(db).users.findOneAndUpdate(
    { email },
    { $set: { name: u.name || email, image: u.image ?? null }, $setOnInsert: { _id: id(), email, createdAt: new Date() } },
    { upsert: true, returnDocument: "after" },
  );
  return res!;
}

/* ---------------- Activity ---------------- */

async function log(
  db: Db,
  actor: Actor,
  groupId: string,
  action: ActivityAction,
  summary: string,
  extra: { expenseId?: string; settlementId?: string; changes?: FieldChange[]; subjectTitle?: string; amount?: number; impact?: Record<string, number> } = {},
) {
  await cols(db).activity.insertOne({
    _id: id(),
    groupId,
    expenseId: extra.expenseId ?? null,
    settlementId: extra.settlementId ?? null,
    actorUserId: actor.userId,
    actorName: actor.name,
    action,
    summary,
    changes: extra.changes ?? [],
    ...(extra.subjectTitle !== undefined ? { subjectTitle: extra.subjectTitle } : {}),
    ...(extra.amount !== undefined ? { amount: extra.amount } : {}),
    ...(extra.impact && Object.keys(extra.impact).length ? { impact: extra.impact } : {}),
    at: new Date(),
  });
}

/** Each Member's balance contribution from one Expense (payer credited the sum of shares). */
function contribution(e: Pick<ExpenseDoc, "payerId" | "shares" | "deleted"> | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!e || e.deleted) return out;
  let sum = 0;
  for (const [id, c] of Object.entries(e.shares)) { out[id] = (out[id] ?? 0) - c; sum += c; }
  out[e.payerId] = (out[e.payerId] ?? 0) + sum;
  return out;
}
/** Balance change per Member between two states of an Expense. */
export function balanceImpact(before: Parameters<typeof contribution>[0], after: Parameters<typeof contribution>[0]): Record<string, number> {
  const a = contribution(after), b = contribution(before);
  const out: Record<string, number> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (a[id] ?? 0) - (b[id] ?? 0);
    if (d !== 0) out[id] = d;
  }
  return out;
}

export async function listActivity(db: Db, actor: Actor, groupId: string, opts: { expenseId?: string; limit?: number } = {}) {
  await requireGroup(db, actor, groupId);
  const q: Record<string, unknown> = { groupId };
  if (opts.expenseId) q.expenseId = opts.expenseId;
  return cols(db).activity.find(q).sort({ at: -1 }).limit(opts.limit ?? 200).toArray();
}

/* ---------------- Groups & Members ---------------- */

export async function requireGroup(db: Db, actor: Actor, groupId: string): Promise<{ group: GroupDoc; me: MemberDoc }> {
  const group = await cols(db).groups.findOne({ _id: groupId });
  if (!group) throw new ServiceError("Group not found", 404);
  const me = group.members.find((m) => m.userId === actor.userId && !m.leftAt);
  if (!me) throw new ServiceError("You are not a member of this group", 403);
  return { group, me };
}

const activeMembers = (g: GroupDoc) => g.members.filter((m) => !m.leftAt);
const memberName = (g: GroupDoc, mid: MemberId) => g.members.find((m) => m.id === mid)?.name ?? "Unknown";

export async function createGroup(db: Db, actor: Actor, input: { name: string; placeholderNames?: string[] }) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Group name is required");
  const now = new Date();
  const group: GroupDoc = {
    _id: id(),
    name,
    createdBy: actor.userId,
    members: [
      { id: id(), name: actor.name, userId: actor.userId, joinedAt: now, leftAt: null },
      ...(input.placeholderNames ?? []).filter((n) => n.trim()).map((n) => ({ id: id(), name: n.trim(), userId: null, joinedAt: null, leftAt: null })),
    ],
    invite: { token: token(), enabled: true },
    defaults: { splitRules: { ...DEFAULT_SPLIT_RULES } },
    createdAt: now,
  };
  await cols(db).groups.insertOne(group);
  await log(db, actor, group._id, "group.created", `${actor.name} created the group "${name}"`);
  return group;
}

export async function listGroups(db: Db, actor: Actor) {
  return cols(db).groups.find({ members: { $elemMatch: { userId: actor.userId, leftAt: null } } }).sort({ createdAt: 1 }).toArray();
}

export async function addPlaceholderMember(db: Db, actor: Actor, groupId: string, name: string) {
  await requireGroup(db, actor, groupId);
  const n = name.trim();
  if (!n) throw new ServiceError("Name is required");
  const m: MemberDoc = { id: id(), name: n, userId: null, joinedAt: null, leftAt: null };
  await cols(db).groups.updateOne({ _id: groupId }, { $push: { members: m } });
  await log(db, actor, groupId, "member.added", `${actor.name} added ${n}`);
  return m;
}

export async function removeMember(db: Db, actor: Actor, groupId: string, memberId: MemberId) {
  const { group } = await requireGroup(db, actor, groupId);
  const m = activeMembers(group).find((x) => x.id === memberId);
  if (!m) throw new ServiceError("Member not found", 404);
  const { balances } = await computeGroupBalances(db, group);
  if ((balances[memberId] ?? 0) !== 0) throw new ServiceError(`${m.name} can only leave when their balance is $0.00 (now ${fmtMoney(balances[memberId]!)})`);
  await cols(db).groups.updateOne({ _id: groupId, "members.id": memberId }, { $set: { "members.$.leftAt": new Date() } });
  await log(db, actor, groupId, "member.removed", actor.userId === m.userId ? `${m.name} left the group` : `${actor.name} removed ${m.name}`);
}

export async function setInvite(db: Db, actor: Actor, groupId: string, input: { enabled?: boolean; regenerate?: boolean }) {
  const { group } = await requireGroup(db, actor, groupId);
  if (group.createdBy !== actor.userId) throw new ServiceError("Only the group's creator can change the invite link", 403);
  const set: Record<string, unknown> = {};
  if (typeof input.enabled === "boolean") set["invite.enabled"] = input.enabled;
  if (input.regenerate) set["invite.token"] = token();
  await cols(db).groups.updateOne({ _id: groupId }, { $set: set });
  const what = input.regenerate ? "made a new invite link" : input.enabled ? "turned the invite link on" : "turned the invite link off";
  await log(db, actor, groupId, "invite.changed", `${actor.name} ${what}`);
}

export async function previewInvite(db: Db, inviteToken: string) {
  const group = await cols(db).groups.findOne({ "invite.token": inviteToken });
  if (!group || !group.invite.enabled) throw new ServiceError("This invite link is not valid or has been turned off", 404);
  return { groupId: group._id, name: group.name, placeholders: activeMembers(group).filter((m) => !m.userId).map((m) => ({ id: m.id, name: m.name })) };
}

/** Join through an Invite Link, optionally claiming a placeholder Member. */
export async function joinGroup(db: Db, actor: Actor, inviteToken: string, claimMemberId?: MemberId) {
  const group = await cols(db).groups.findOne({ "invite.token": inviteToken });
  if (!group || !group.invite.enabled) throw new ServiceError("This invite link is not valid or has been turned off", 404);
  if (activeMembers(group).some((m) => m.userId === actor.userId)) return group;
  const now = new Date();
  if (claimMemberId) {
    const ph = activeMembers(group).find((m) => m.id === claimMemberId && !m.userId);
    if (!ph) throw new ServiceError("That spot was already claimed");
    await cols(db).groups.updateOne({ _id: group._id, "members.id": claimMemberId }, { $set: { "members.$.userId": actor.userId, "members.$.joinedAt": now } });
    await log(db, actor, group._id, "member.joined", `${actor.name} joined as ${ph.name}`);
  } else {
    await cols(db).groups.updateOne({ _id: group._id }, { $push: { members: { id: id(), name: actor.name, userId: actor.userId, joinedAt: now, leftAt: null } } });
    await log(db, actor, group._id, "member.joined", `${actor.name} joined the group`);
  }
  return (await cols(db).groups.findOne({ _id: group._id }))!;
}

export async function updateGroupDefaults(db: Db, actor: Actor, groupId: string, rules: SplitRules) {
  const { group } = await requireGroup(db, actor, groupId);
  validateRules(rules);
  await cols(db).groups.updateOne({ _id: groupId }, { $set: { "defaults.splitRules": rules } });
  await log(db, actor, groupId, "group.updated", `${actor.name} changed the default Walmart split rules`, {
    changes: changeIf("Tax split", group.defaults.splitRules.tax, rules.tax).concat(changeIf("Fee split", group.defaults.splitRules.fees, rules.fees)),
  });
}

function validateRules(r: SplitRules) {
  if (!["proportional", "equal"].includes(r.tax) || !["proportional", "equal"].includes(r.fees)) throw new ServiceError("Invalid split rules");
}

const changeIf = (label: string, before: unknown, after: unknown): FieldChange[] =>
  JSON.stringify(before) === JSON.stringify(after) ? [] : [{ path: label, label, before, after }];

/* ---------------- Expense math ---------------- */

function validateMembers(group: GroupDoc, ids: MemberId[]) {
  const ok = new Set(activeMembers(group).map((m) => m.id));
  for (const m of ids) if (!ok.has(m)) throw new ServiceError("Split includes someone who is not in the group");
}

function computeManual(amount: Cents, split: Split) {
  if (amount <= 0) throw new ServiceError("Amount must be more than $0");
  try {
    const r = resolveSplit(amount, split);
    if (r.shares.size === 0) throw new ServiceError("Pick at least one person to split with");
    return { shares: Object.fromEntries(r.shares), unassignedRemainder: r.remainder };
  } catch (e) {
    throw e instanceof ServiceError ? e : new ServiceError((e as Error).message);
  }
}

function computeWalmart(order: ParsedOrder, assignments: Assignments, rules: SplitRules) {
  const missing = unassignedItems(order, assignments);
  if (missing.length) throw new ServiceError(`Every item needs at least one person. Still unassigned: ${missing.map((i) => i.name).slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);
  try {
    const r = splitOrder(order, assignments, rules);
    const shares = Object.fromEntries(Object.entries(r.members).map(([k, v]) => [k, v.total]));
    return { shares, unassignedRemainder: r.unassignedRemainder, amount: order.total ?? r.splitTotal };
  } catch (e) {
    throw new ServiceError((e as Error).message);
  }
}

function assignmentMembers(a: Assignments): MemberId[] {
  return Object.values(a).flatMap((s) => s.shares.map((x) => x.memberId));
}

/* ---------------- Human-readable change descriptions ---------------- */

function describeSplit(group: GroupDoc, s: Split | undefined): string {
  if (!s || !s.shares.length) return "nobody";
  const names = s.shares.map((x) => {
    const n = memberName(group, x.memberId);
    if (s.method === "parts") return `${n} ×${x.parts ?? 1}`;
    if (s.method === "amount") return `${n} ${fmtMoney(x.amount ?? 0)}`;
    return n;
  });
  return names.join(", ") + (s.method === "equal" ? "" : ` (${s.method === "parts" ? "by parts" : "by amount"})`);
}

function describeExpenseChanges(group: GroupDoc, before: ExpenseDoc, after: ExpenseDoc): FieldChange[] {
  const out: FieldChange[] = [];
  out.push(...changeIf("Title", before.title, after.title));
  out.push(...changeIf("Date", before.date.toISOString().slice(0, 10), after.date.toISOString().slice(0, 10)));
  out.push(...changeIf("Amount", fmtMoney(before.amount), fmtMoney(after.amount)));
  out.push(...changeIf("Paid by", memberName(group, before.payerId), memberName(group, after.payerId)));
  if (before.split || after.split) out.push(...changeIf("Split", describeSplit(group, before.split), describeSplit(group, after.split)));
  if (before.walmart && after.walmart) {
    const bw = before.walmart, aw = after.walmart;
    out.push(...changeIf("Tax split", bw.rules.tax, aw.rules.tax));
    out.push(...changeIf("Fee split", bw.rules.fees, aw.rules.fees));
    const items = new Map([...bw.order.items, ...aw.order.items].map((i) => [i.key, i]));
    for (const [key, item] of items) {
      const b = describeSplit(group, bw.assignments[key]);
      const a = describeSplit(group, aw.assignments[key]);
      if (b !== a) out.push({ path: `items.${key}`, label: item.name, before: b, after: a });
    }
    const bItems = new Map(bw.order.items.map((i) => [i.key, i]));
    for (const i of aw.order.items) {
      const p = bItems.get(i.key);
      if (p && p.amount !== i.amount) out.push({ path: `items.${i.key}.amount`, label: `${i.name} price`, before: fmtMoney(p.amount), after: fmtMoney(i.amount) });
      if (p && p.name !== i.name) out.push({ path: `items.${i.key}.name`, label: "Item name", before: p.name, after: i.name });
    }
    for (const p of bw.order.items) if (!aw.order.items.some((i) => i.key === p.key)) out.push({ path: `items.${p.key}`, label: p.name, before: "in order", after: "removed" });
  }
  // Share changes per Member
  const ids = new Set([...Object.keys(before.shares), ...Object.keys(after.shares)]);
  for (const m of ids) {
    const b = before.shares[m] ?? 0, a = after.shares[m] ?? 0;
    if (b !== a) out.push({ path: `shares.${m}`, label: `${memberName(group, m)}'s share`, before: fmtMoney(b), after: fmtMoney(a) });
  }
  return out;
}

/* ---------------- Expenses ---------------- */

export interface ManualExpenseInput {
  title: string;
  date?: string;
  amount: Cents;
  payerId: MemberId;
  split: Split;
}

export async function createManualExpense(db: Db, actor: Actor, groupId: string, input: ManualExpenseInput) {
  const { group } = await requireGroup(db, actor, groupId);
  if (!input.title?.trim()) throw new ServiceError("Description is required");
  validateMembers(group, [input.payerId, ...input.split.shares.map((s) => s.memberId)]);
  const { shares, unassignedRemainder } = computeManual(input.amount, input.split);
  const now = new Date();
  const e: ExpenseDoc = {
    _id: id(), groupId, kind: "manual", title: input.title.trim(), date: input.date ? new Date(input.date) : now,
    payerId: input.payerId, amount: input.amount, split: input.split, shares, unassignedRemainder,
    deleted: false, createdBy: actor.userId, createdAt: now, updatedAt: now,
  };
  await cols(db).expenses.insertOne(e);
  await log(db, actor, groupId, "expense.created", `${actor.name} added "${e.title}" (${fmtMoney(e.amount)}), paid by ${memberName(group, e.payerId)}`, { expenseId: e._id, subjectTitle: e.title, amount: e.amount, impact: balanceImpact(null, e) });
  return e;
}

export async function getExpense(db: Db, actor: Actor, expenseId: string) {
  const e = await cols(db).expenses.findOne({ _id: expenseId });
  if (!e) throw new ServiceError("Expense not found", 404);
  const { group } = await requireGroup(db, actor, e.groupId);
  return { expense: e, group };
}

export interface ExpensePatch {
  title?: string;
  date?: string;
  payerId?: MemberId;
  amount?: Cents; // manual only
  split?: Split; // manual only
  assignments?: Assignments; // walmart only
  rules?: SplitRules; // walmart only
}

/** Any Member can edit anything; every change is recorded as Activity. */
export async function updateExpense(db: Db, actor: Actor, expenseId: string, patch: ExpensePatch) {
  const { expense: before, group } = await getExpense(db, actor, expenseId);
  const after: ExpenseDoc = structuredClone(before);
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new ServiceError("Description is required");
    after.title = patch.title.trim();
  }
  if (patch.date) after.date = new Date(patch.date);
  if (patch.payerId) {
    validateMembers(group, [patch.payerId]);
    after.payerId = patch.payerId;
  }
  if (after.kind === "manual") {
    if (patch.amount !== undefined) after.amount = patch.amount;
    if (patch.split) {
      validateMembers(group, patch.split.shares.map((s) => s.memberId));
      after.split = patch.split;
    }
    Object.assign(after, computeManual(after.amount, after.split!));
  } else {
    const w = after.walmart!;
    if (patch.assignments) {
      validateMembers(group, assignmentMembers(patch.assignments));
      w.assignments = patch.assignments;
    }
    if (patch.rules) {
      validateRules(patch.rules);
      w.rules = patch.rules;
    }
    const r = computeWalmart(w.order, w.assignments, w.rules);
    after.shares = r.shares;
    after.unassignedRemainder = r.unassignedRemainder;
  }
  const changes = describeExpenseChanges(group, before, after);
  if (!changes.length) return before;
  after.updatedAt = new Date();
  await cols(db).expenses.replaceOne({ _id: expenseId }, after);
  await log(db, actor, group._id, "expense.updated", `${actor.name} edited "${after.title}"`, { expenseId, changes, subjectTitle: after.title, amount: after.amount, impact: balanceImpact(before, after) });
  return after;
}

export async function setExpenseDeleted(db: Db, actor: Actor, expenseId: string, deleted: boolean) {
  const { expense, group } = await getExpense(db, actor, expenseId);
  if (expense.deleted === deleted) return;
  await cols(db).expenses.updateOne({ _id: expenseId }, { $set: { deleted, updatedAt: new Date() } });
  await log(db, actor, group._id, deleted ? "expense.deleted" : "expense.restored", `${actor.name} ${deleted ? "deleted" : "restored"} "${expense.title}"`, { expenseId, subjectTitle: expense.title, amount: expense.amount, impact: deleted ? balanceImpact(expense, null) : balanceImpact(null, { ...expense, deleted: false }) });
}

/* ---------------- Walmart Orders ---------------- */

/** Lookup used before Processing: does this Order already exist in the Group? */
export async function findOrder(db: Db, actor: Actor, groupId: string, orderNumber: string) {
  await requireGroup(db, actor, groupId);
  const expense = await cols(db).expenses.findOne({ groupId, kind: "walmart", "walmart.orderNumber": orderNumber });
  return expense;
}

/** Preview what re-Processing would change, with Assignments carried over by Item key. */
export async function previewReprocess(db: Db, actor: Actor, groupId: string, order: ParsedOrder) {
  const existing = await findOrder(db, actor, groupId, order.orderNumber);
  if (!existing) return { exists: false as const };
  const changes = diffOrders(existing.walmart!.order, order);
  return {
    exists: true as const,
    expenseId: existing._id,
    payerId: existing.payerId,
    rules: existing.walmart!.rules,
    assignments: carryAssignments(existing.walmart!.assignments, order),
    changes: changes.map((c) => ({ type: c.type, text: describeChange(c) })),
  };
}

export interface ProcessOrderInput {
  order: ParsedOrder;
  assignments: Assignments;
  rules: SplitRules;
  payerId: MemberId;
  title?: string;
}

/** Create or update the Expense for a Walmart Order. Never creates a duplicate. */
export async function processOrder(db: Db, actor: Actor, groupId: string, input: ProcessOrderInput) {
  const { group } = await requireGroup(db, actor, groupId);
  const { order } = input;
  if (!/^\d{6,}$/.test(order.orderNumber)) throw new ServiceError("Order number is missing or invalid");
  validateRules(input.rules);
  validateMembers(group, [input.payerId, ...assignmentMembers(input.assignments)]);
  // Drop assignments for Items that are not in the Order.
  const keys = new Set(order.items.map((i) => i.key));
  const assignments = Object.fromEntries(Object.entries(input.assignments).filter(([k]) => keys.has(k)));
  const { shares, unassignedRemainder, amount } = computeWalmart(order, assignments, input.rules);
  const card = order.paymentCards[0] ?? null;
  const walmart = { orderNumber: order.orderNumber, card, order, assignments, rules: input.rules };
  const now = new Date();
  const existing = await cols(db).expenses.findOne({ groupId, kind: "walmart", "walmart.orderNumber": order.orderNumber });

  let expense: ExpenseDoc;
  if (existing) {
    expense = { ...existing, payerId: input.payerId, amount, walmart, shares, unassignedRemainder, updatedAt: now };
    if (input.title?.trim()) expense.title = input.title.trim();
    const orderChanges = diffOrders(existing.walmart!.order, order).map((c): FieldChange => ({ path: `order.${c.type}`, label: "Walmart", before: null, after: describeChange(c) }));
    const changes = [...orderChanges, ...describeExpenseChanges(group, existing, expense)];
    await cols(db).expenses.replaceOne({ _id: existing._id }, expense);
    await log(db, actor, groupId, "order.reprocessed", `${actor.name} re-processed Walmart order #${order.orderNumber}`, { expenseId: expense._id, changes, subjectTitle: expense.title, amount, impact: balanceImpact(existing, expense) });
  } else {
    expense = {
      _id: id(), groupId, kind: "walmart", title: input.title?.trim() || `Walmart #${order.orderNumber}`,
      date: order.placedAt ? new Date(order.placedAt) : now, payerId: input.payerId, amount, walmart, shares, unassignedRemainder,
      deleted: false, createdBy: actor.userId, createdAt: now, updatedAt: now,
    };
    await cols(db).expenses.insertOne(expense);
    await log(db, actor, groupId, "order.processed", `${actor.name} processed Walmart order #${order.orderNumber} (${fmtMoney(amount)}), paid by ${memberName(group, input.payerId)}`, { expenseId: expense._id, subjectTitle: expense.title, amount, impact: balanceImpact(null, expense) });
  }
  await cols(db).snapshots.insertOne({ _id: id(), groupId, expenseId: expense._id, orderNumber: order.orderNumber, parsed: order, processedBy: actor.userId, at: now });
  return { expense, created: !existing };
}

export async function listSnapshots(db: Db, actor: Actor, expenseId: string) {
  await getExpense(db, actor, expenseId);
  return cols(db).snapshots.find({ expenseId }).sort({ at: -1 }).toArray();
}

/* ---------------- Settlements ---------------- */

export async function recordSettlement(db: Db, actor: Actor, groupId: string, input: { fromId: MemberId; toId: MemberId; amount: Cents; date?: string; note?: string }) {
  const { group } = await requireGroup(db, actor, groupId);
  validateMembers(group, [input.fromId, input.toId]);
  if (input.fromId === input.toId) throw new ServiceError("Pick two different people");
  if (!(input.amount > 0)) throw new ServiceError("Amount must be more than $0");
  const s: SettlementDoc = {
    _id: id(), groupId, fromId: input.fromId, toId: input.toId, amount: Math.round(input.amount),
    date: input.date ? new Date(input.date) : new Date(), note: input.note?.trim() || undefined,
    deleted: false, createdBy: actor.userId, createdAt: new Date(),
  };
  await cols(db).settlements.insertOne(s);
  await log(db, actor, groupId, "settlement.created", `${actor.name} recorded: ${memberName(group, s.fromId)} paid ${memberName(group, s.toId)} ${fmtMoney(s.amount)}`, { settlementId: s._id, subjectTitle: `${memberName(group, s.fromId)} → ${memberName(group, s.toId)}`, amount: s.amount, impact: { [s.fromId]: s.amount, [s.toId]: -s.amount } });
  return s;
}

export async function setSettlementDeleted(db: Db, actor: Actor, settlementId: string, deleted: boolean) {
  const s = await cols(db).settlements.findOne({ _id: settlementId });
  if (!s) throw new ServiceError("Settlement not found", 404);
  const { group } = await requireGroup(db, actor, s.groupId);
  await cols(db).settlements.updateOne({ _id: settlementId }, { $set: { deleted } });
  await log(db, actor, group._id, deleted ? "settlement.deleted" : "settlement.updated", `${actor.name} ${deleted ? "deleted" : "restored"} the payment ${memberName(group, s.fromId)} → ${memberName(group, s.toId)} ${fmtMoney(s.amount)}`, { settlementId, subjectTitle: `${memberName(group, s.fromId)} → ${memberName(group, s.toId)}`, amount: s.amount, impact: deleted ? { [s.fromId]: -s.amount, [s.toId]: s.amount } : { [s.fromId]: s.amount, [s.toId]: -s.amount } });
}

/* ---------------- Summary ---------------- */

async function computeGroupBalances(db: Db, group: GroupDoc) {
  const [expenses, settlements] = await Promise.all([
    cols(db).expenses.find({ groupId: group._id }).sort({ date: -1, createdAt: -1 }).toArray(),
    cols(db).settlements.find({ groupId: group._id }).sort({ date: -1 }).toArray(),
  ]);
  const balances = computeBalances(expenses, settlements, activeMembers(group).map((m) => m.id));
  return { expenses, settlements, balances };
}

export async function groupSummary(db: Db, actor: Actor, groupId: string) {
  const { group, me } = await requireGroup(db, actor, groupId);
  const { expenses, settlements, balances } = await computeGroupBalances(db, group);
  return {
    group,
    me,
    expenses,
    settlements,
    balances,
    suggestions: suggestSettlements(balances),
    activity: await cols(db).activity.find({ groupId }).sort({ at: -1 }).limit(50).toArray(),
  };
}
