import type { Assignments, Cents, FieldChange, MemberId, ParsedOrder, Split, SplitRules } from "@billsplit/core";

export interface UserDoc {
  _id: string;
  email: string;
  name: string;
  image?: string | null;
  createdAt: Date;
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
  at: Date;
}

export interface Actor {
  userId: string;
  name: string;
}
