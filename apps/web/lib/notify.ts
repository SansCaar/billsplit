/**
 * Who gets a Notification, and what it says. Pure: no database, no network.
 * See GLOSSARY.md (Notification, Notification Level, Involved Member, Nudge) and ADR 0003.
 */
import { fmtMoney } from "@billsplit/core";
import type { ActivityDoc, GroupDoc, NotificationLevel, NotifyPrefs } from "./model";
import { fillNudgeLine } from "./nudgeLines";

export interface PushMessage {
  title: string;
  body: string;
  /** Path to open when the Notification is tapped. */
  url: string;
  /** Notifications with the same tag replace each other on a device. */
  tag: string;
}

export interface Outgoing {
  userId: string;
  message: PushMessage;
}

export const DEFAULT_LEVEL: NotificationLevel = "involved";

export function levelFor(prefs: NotifyPrefs | null | undefined, groupId: string): NotificationLevel {
  return prefs?.groups?.[groupId] ?? prefs?.level ?? DEFAULT_LEVEL;
}

/** The place in the app the Activity is about. */
export function activityUrl(a: Pick<ActivityDoc, "groupId" | "expenseId" | "settlementId">): string {
  if (a.expenseId) return `/e/${a.expenseId}`;
  if (a.settlementId) return `/g/${a.groupId}?tab=expenses`;
  return `/g/${a.groupId}?tab=settings`;
}

function activityTag(a: Pick<ActivityDoc, "_id" | "expenseId" | "settlementId">): string {
  if (a.expenseId) return `expense:${a.expenseId}`;
  if (a.settlementId) return `settlement:${a.settlementId}`;
  return `activity:${a._id}`;
}

function balanceLine(cents: number | undefined): string {
  if (!cents) return "";
  return `Your balance ${cents > 0 ? "+" : "−"}${fmtMoney(Math.abs(cents))}`;
}

/**
 * Notifications for one Activity: every joined Member except whoever made the change,
 * filtered by each person's Notification Level for this Group.
 */
export function activityNotifications(
  a: ActivityDoc,
  group: Pick<GroupDoc, "_id" | "name" | "members">,
  prefsByUser: ReadonlyMap<string, NotifyPrefs | null | undefined>,
): Outgoing[] {
  const involved = new Set(a.involved ?? []);
  const url = activityUrl(a);
  const tag = activityTag(a);
  const out: Outgoing[] = [];
  for (const m of group.members) {
    if (!m.userId || m.leftAt || m.userId === a.actorUserId) continue;
    const level = levelFor(prefsByUser.get(m.userId), group._id);
    if (level === "involved" && !involved.has(m.id)) continue;
    const bal = balanceLine(a.impact?.[m.id]);
    out.push({ userId: m.userId, message: { title: group.name, body: bal ? `${a.summary}\n${bal}` : a.summary, url, tag } });
  }
  return out;
}

/** A Nudge reaches the receiver whatever their Notification Level. */
export function nudgeMessage(n: { groupId: string; fromId: string; amount: number; line: number }, senderName: string, groupName: string): PushMessage {
  return {
    title: `${senderName} nudged you · ${groupName}`,
    body: fillNudgeLine(n.line, senderName, fmtMoney(n.amount)),
    url: `/g/${n.groupId}?tab=settle`,
    tag: `nudge:${n.groupId}:${n.fromId}`,
  };
}
