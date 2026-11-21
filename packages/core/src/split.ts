import type {
  Assignments,
  Cents,
  Item,
  MemberId,
  ParsedOrder,
  Share,
  Split,
  SplitRules,
} from "./types";

/**
 * Divide `amount` by integer-ish weights, rounding each share DOWN.
 * Leftover cents are returned as `remainder` and given to nobody (ADR 0002).
 */
export function divideByWeights(
  amount: Cents,
  weights: Array<[MemberId, number]>,
): { shares: Map<MemberId, Cents>; remainder: Cents } {
  if (amount < 0) {
    // Negative amounts (discounts): split the magnitude, then negate. Leftover stays unassigned.
    const r = divideByWeights(-amount, weights);
    return { shares: new Map([...r.shares].map(([k, v]) => [k, -v])), remainder: -r.remainder };
  }
  const shares = new Map<MemberId, Cents>();
  const positive = weights.filter(([, w]) => w > 0);
  const total = positive.reduce((s, [, w]) => s + w, 0);
  if (amount === 0 || total === 0) return { shares, remainder: amount };
  let given = 0;
  for (const [id, w] of positive) {
    const share = Math.floor((amount * w) / total + 1e-9);
    shares.set(id, (shares.get(id) ?? 0) + share);
    given += share;
  }
  return { shares, remainder: amount - given };
}

export class SplitError extends Error {}

/** Resolve one Split of `amount` into per-Member cents. */
export function resolveSplit(
  amount: Cents,
  split: Split,
): { shares: Map<MemberId, Cents>; remainder: Cents } {
  const uniq = dedupe(split.shares);
  if (uniq.length === 0) return { shares: new Map(), remainder: amount };
  switch (split.method) {
    case "equal":
      return divideByWeights(amount, uniq.map((s) => [s.memberId, 1]));
    case "parts":
      return divideByWeights(amount, uniq.map((s) => [s.memberId, s.parts ?? 1]));
    case "amount": {
      const shares = new Map<MemberId, Cents>();
      let sum = 0;
      for (const s of uniq) {
        const a = Math.round(s.amount ?? 0);
        if (a < 0) throw new SplitError("Amounts cannot be negative");
        shares.set(s.memberId, a);
        sum += a;
      }
      if (sum > amount) throw new SplitError(`Amounts add up to ${sum}¢, more than ${amount}¢`);
      return { shares, remainder: amount - sum };
    }
  }
}

function dedupe(shares: Share[]): Share[] {
  const seen = new Map<MemberId, Share>();
  for (const s of shares) seen.set(s.memberId, s);
  return [...seen.values()];
}

export function isAssigned(split: Split | undefined): boolean {
  return !!split && split.shares.length > 0;
}

/** Items that still need at least one Member before the Order can be sent. */
export function unassignedItems(order: Pick<ParsedOrder, "items">, a: Assignments): Item[] {
  return order.items.filter((i) => i.amount > 0 && !isAssigned(a[i.key]));
}

export interface MemberBreakdown {
  items: Cents;
  tax: Cents;
  fees: Cents;
  total: Cents;
}

export interface OrderSplitResult {
  members: Record<MemberId, MemberBreakdown>;
  /** Sum of all Member totals — what the Payer is credited. */
  assignedTotal: Cents;
  /** Cents given to nobody (rounding leftovers + anything unassigned). */
  unassignedRemainder: Cents;
  /** Sum of item + tax + fee amounts that were split. */
  splitTotal: Cents;
}

function add(map: Map<MemberId, Cents>, into: Record<MemberId, MemberBreakdown>, field: "items" | "tax" | "fees") {
  for (const [id, c] of map) {
    const b = (into[id] ??= { items: 0, tax: 0, fees: 0, total: 0 });
    b[field] += c;
    b.total += c;
  }
}

/**
 * Compute what each Member owes for a Walmart Order.
 * - Items: per their Assignment.
 * - Tax: proportional to Item totals (or equal among Members with Items), per rules.
 * - Fees: a Fulfillment Fee goes to Members with Items in that Fulfillment;
 *   an Order Fee goes to Members with Items anywhere in the Order. Equal or proportional, per rules.
 */
export function splitOrder(
  order: Pick<ParsedOrder, "items" | "fees" | "tax">,
  assignments: Assignments,
  rules: SplitRules,
): OrderSplitResult {
  const members: Record<MemberId, MemberBreakdown> = {};
  let remainder = 0;
  // Per-fulfillment item totals per member, for fee weighting.
  const byFulfillment = new Map<string | null, Map<MemberId, Cents>>();
  const orderItemTotals = new Map<MemberId, Cents>();

  for (const item of order.items) {
    if (item.amount <= 0) continue;
    const split = assignments[item.key];
    if (!isAssigned(split)) {
      remainder += item.amount;
      continue;
    }
    const r = resolveSplit(item.amount, split!);
    remainder += r.remainder;
    add(r.shares, members, "items");
    const f = byFulfillment.get(item.fulfillmentId) ?? new Map<MemberId, Cents>();
    byFulfillment.set(item.fulfillmentId, f);
    for (const [id, c] of r.shares) {
      f.set(id, (f.get(id) ?? 0) + c);
      orderItemTotals.set(id, (orderItemTotals.get(id) ?? 0) + c);
    }
    // Members assigned with 0 cents (e.g. amount split giving 0) still participate.
    for (const s of split!.shares) {
      if (!f.has(s.memberId)) f.set(s.memberId, 0);
      if (!orderItemTotals.has(s.memberId)) orderItemTotals.set(s.memberId, 0);
    }
  }

  const weigh = (pool: Map<MemberId, Cents>, rule: "equal" | "proportional"): Array<[MemberId, number]> => {
    const entries = [...pool.entries()];
    if (rule === "equal") return entries.map(([id]) => [id, 1]);
    const prop = entries.filter(([, c]) => c > 0);
    // If nobody has a positive item total, fall back to equal.
    return prop.length ? prop : entries.map(([id]) => [id, 1]);
  };

  // Tax
  if (order.tax > 0) {
    const r = divideByWeights(order.tax, weigh(orderItemTotals, rules.tax));
    remainder += r.remainder;
    add(r.shares, members, "tax");
  }

  // Fees
  for (const fee of order.fees) {
    if (fee.amount === 0) continue;
    let pool = fee.fulfillmentId === null ? orderItemTotals : byFulfillment.get(fee.fulfillmentId);
    // A Fulfillment fee whose Fulfillment has no assigned Items falls back to the whole Order.
    if (!pool || pool.size === 0) pool = orderItemTotals;
    const rule = fee.kind === "discount" ? "proportional" : rules.fees;
    const r = divideByWeights(fee.amount, weigh(pool, rule));
    remainder += r.remainder;
    add(r.shares, members, "fees");
  }

  const assignedTotal = Object.values(members).reduce((s, b) => s + b.total, 0);
  const splitTotal =
    order.items.reduce((s, i) => s + Math.max(0, i.amount), 0) +
    Math.max(0, order.tax) +
    order.fees.reduce((s, f) => s + f.amount, 0);
  return { members, assignedTotal, unassignedRemainder: remainder, splitTotal };
}
