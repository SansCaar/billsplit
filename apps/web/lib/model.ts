import type { Assignments, Cents, FieldChange, MemberId, ParsedOrder, Split, SplitRules } from "@billsplit/core";

export interface UserDoc {
  _id: string;
  email: string;
  name: string;
  image?: string | null;
  createdAt: Date;
  /** Notification Level: a default, plus optional per-Group levels. Missing = "involved". */
  notify?: NotifyPrefs;
}

export type NotificationLevel = "all" | "involved";
export interface NotifyPrefs {
  level: NotificationLevel;
  groups?: Record<string, NotificationLevel>;
}

/** One browser/device that has turned notifications on. _id = sha256(endpoint). */
export interface PushDeviceDoc {
  _id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
}

/** A sent Nudge. Not an Activity (ADR 0003); kept only to rate-limit and to show "Nudged N times today". */
export interface NudgeDoc {
  _id: string;
  groupId: string;
  /** Member who is owed (sender) and Member who owes (receiver). */
  fromId: MemberId;
  toId: MemberId;
  amount: Cents;
  line: number;
  at: Date;
}

export interface MemberDoc {
  id: MemberId;
  name: string;
  /** null = placeholder Member who has not joined yet. */
  userId: string | null;
  joinedAt: Date | null;
  leftAt: Date | null;
}

export interface GroupDoc {
  _id: string;
  name: string;
  createdBy: string; // userId
  members: MemberDoc[];
  invite: { token: string; enabled: boolean };
  defaults: { splitRules: SplitRules };
  createdAt: Date;
}

export interface WalmartPart {
  orderNumber: string;
  card: { brand: string; last4: string } | null;
  order: ParsedOrder;
  assignments: Assignments;
  rules: SplitRules;
}

export interface ExpenseDoc {
  _id: string;
  groupId: string;
  kind: "manual" | "walmart";
  title: string;
  date: Date;
  payerId: MemberId;
  /** Total charged, in cents. */
  amount: Cents;
  /** Manual Expenses only. */
  split?: Split;
  walmart?: WalmartPart;
  /** Derived: per-Member share in cents. */
  shares: Record<MemberId, Cents>;
  /** Derived: cents given to nobody (ADR 0002). */
  unassignedRemainder: Cents;
  deleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementDoc {
  _id: string;
  groupId: string;
  fromId: MemberId;
  toId: MemberId;
  amount: Cents;
  date: Date;
  note?: string;
  deleted: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface SnapshotDoc {
  _id: string;
  groupId: string;
  expenseId: string;
  orderNumber: string;
  parsed: ParsedOrder;
  processedBy: string;
  at: Date;
}

export type ActivityAction =
  | "expense.created"
  | "expense.updated"
  | "expense.deleted"
  | "expense.restored"
  | "order.processed"
  | "order.reprocessed"
  | "settlement.created"
  | "settlement.updated"
  | "settlement.deleted"
  | "group.created"
  | "group.updated"
  | "member.added"
  | "member.joined"
  | "member.removed"
  | "invite.changed";

export interface ActivityDoc {
  _id: string;
  groupId: string;
  expenseId: string | null;
  settlementId: string | null;
  actorUserId: string;
  actorName: string;
  action: ActivityAction;
  summary: string;
  /** Human-readable before/after lines. */
  changes: FieldChange[];
  /** What the entry is about (expense title, "Nishant → Sanskar" for payments). Newer entries only. */
  subjectTitle?: string;
  /** Money involved (expense total or payment amount). */
  amount?: number;
  /** How much each Member's balance moved because of this change, in cents (+ = owed more). */
  impact?: Record<string, number>;
  /** Involved Members (GLOSSARY). Newer entries only. */
  involved?: MemberId[];
  at: Date;
}

export interface Actor {
  userId: string;
  name: string;
}
