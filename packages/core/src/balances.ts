import type { Cents, MemberId } from "./types";

/** Minimal shape of an Expense for balance purposes. */
export interface BalanceExpense {
  payerId: MemberId;
  /** Per-Member share in cents. The Payer is credited the sum of these (ADR 0002). */
  shares: Record<MemberId, Cents>;
  deleted?: boolean;
}

export interface BalanceSettlement {
  fromId: MemberId; // who paid back
  toId: MemberId; // who received
  amount: Cents;
  deleted?: boolean;
}

/** Positive = is owed money, negative = owes money. */
export function computeBalances(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[],
  memberIds: MemberId[] = [],
): Record<MemberId, Cents> {
  const bal: Record<MemberId, Cents> = {};
  for (const id of memberIds) bal[id] = 0;
  for (const e of expenses) {
    if (e.deleted) continue;
    let sum = 0;
    for (const [id, c] of Object.entries(e.shares)) {
      bal[id] = (bal[id] ?? 0) - c;
      sum += c;
    }
    bal[e.payerId] = (bal[e.payerId] ?? 0) + sum;
  }
  for (const s of settlements) {
    if (s.deleted) continue;
    bal[s.fromId] = (bal[s.fromId] ?? 0) + s.amount;
    bal[s.toId] = (bal[s.toId] ?? 0) - s.amount;
  }
  return bal;
}

export interface SuggestedPayment {
  fromId: MemberId;
  toId: MemberId;
  amount: Cents;
}

/** Greedy largest-debtor-pays-largest-creditor; at most n-1 payments. */
export function suggestSettlements(balances: Record<MemberId, Cents>): SuggestedPayment[] {
  const debtors = Object.entries(balances).filter(([, b]) => b < 0).map(([id, b]) => ({ id, left: -b }));
  const creditors = Object.entries(balances).filter(([, b]) => b > 0).map(([id, b]) => ({ id, left: b }));
  const out: SuggestedPayment[] = [];
  const byLeft = (a: { left: number }, b: { left: number }) => b.left - a.left;
  while (debtors.length && creditors.length) {
    debtors.sort(byLeft);
    creditors.sort(byLeft);
    const d = debtors[0]!;
    const c = creditors[0]!;
    const amt = Math.min(d.left, c.left);
    out.push({ fromId: d.id, toId: c.id, amount: amt });
    d.left -= amt;
    c.left -= amt;
    if (d.left === 0) debtors.shift();
    if (c.left === 0) creditors.shift();
  }
  return out;
}
