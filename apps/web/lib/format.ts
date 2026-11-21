import { fmtMoney, type Cents } from "@billsplit/core";
import type { ExpenseDoc, GroupDoc } from "./model";

export const shortOrder = (n: string) => `#…${n.slice(-4)}`;

/** Friendly title: default Walmart titles ("Walmart #2000155…") become "Walmart order". */
export function displayTitle(e: Pick<ExpenseDoc, "kind" | "title" | "walmart">): string {
  if (e.kind === "walmart" && e.walmart && e.title === `Walmart #${e.walmart.orderNumber}`) return "Walmart order";
  return e.title;
}

export function expenseSubtitle(e: ExpenseDoc, payerName: string): string {
  if (e.kind === "walmart" && e.walmart) {
    const n = e.walmart.order.items.filter((i) => i.amount > 0).length;
    return `${shortOrder(e.walmart.orderNumber)} · ${n} item${n === 1 ? "" : "s"} · ${payerName} paid`;
  }
  return `${payerName} paid ${fmtMoney(e.amount)}`;
}

/** What an Expense means for one Member: how much they lent (paid for others) or owe. */
export function involvement(e: ExpenseDoc, meId: string): { kind: "lent" | "owe" | "none" | "even"; amount: Cents } {
  const share = e.shares[meId] ?? 0;
  if (e.payerId === meId) {
    const others = Object.entries(e.shares).filter(([k]) => k !== meId).reduce((a, [, v]) => a + v, 0);
    return others > 0 ? { kind: "lent", amount: others } : { kind: "even", amount: 0 };
  }
  return share > 0 ? { kind: "owe", amount: share } : { kind: "none", amount: 0 };
}

export const monthLabel = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" });
export const dayLabel = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function balanceText(b: Cents): { label: string; cls: string } {
  if (b > 0) return { label: "gets back", cls: "pos" };
  if (b < 0) return { label: "owes", cls: "neg" };
  return { label: "settled up", cls: "mute" };
}

export const memberName = (g: GroupDoc, id: string) => g.members.find((m) => m.id === id)?.name ?? "Someone";
export const memberIndex = (g: GroupDoc, id: string) => g.members.findIndex((m) => m.id === id);
