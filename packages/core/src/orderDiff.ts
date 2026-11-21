import type { Assignments, Cents, Fee, Item, ParsedOrder } from "./types";

export type OrderChange =
  | { type: "item-added"; item: Item }
  | { type: "item-removed"; item: Item }
  | { type: "item-changed"; key: string; name: string; fields: Array<{ field: string; before: unknown; after: unknown }> }
  | { type: "fee-added"; fee: Fee }
  | { type: "fee-removed"; fee: Fee }
  | { type: "fee-changed"; key: string; label: string; before: Cents; after: Cents }
  | { type: "tax-changed"; before: Cents; after: Cents };

const ITEM_FIELDS = ["name", "quantity", "amount", "status", "fulfillmentId"] as const;

/** What changed between the last Processing snapshot and a new one. */
export function diffOrders(prev: ParsedOrder, next: ParsedOrder): OrderChange[] {
  const changes: OrderChange[] = [];
  const prevItems = new Map(prev.items.map((i) => [i.key, i]));
  const nextItems = new Map(next.items.map((i) => [i.key, i]));
  for (const [key, n] of nextItems) {
    const p = prevItems.get(key);
    if (!p) {
      changes.push({ type: "item-added", item: n });
      continue;
    }
    const fields = ITEM_FIELDS.filter((f) => p[f] !== n[f]).map((f) => ({ field: f, before: p[f], after: n[f] }));
    if (fields.length) changes.push({ type: "item-changed", key, name: n.name, fields });
  }
  for (const [key, p] of prevItems) if (!nextItems.has(key)) changes.push({ type: "item-removed", item: p });

  const prevFees = new Map(prev.fees.map((f) => [f.key, f]));
  const nextFees = new Map(next.fees.map((f) => [f.key, f]));
  for (const [key, n] of nextFees) {
    const p = prevFees.get(key);
    if (!p) changes.push({ type: "fee-added", fee: n });
    else if (p.amount !== n.amount) changes.push({ type: "fee-changed", key, label: n.label, before: p.amount, after: n.amount });
  }
  for (const [key, p] of prevFees) if (!nextFees.has(key)) changes.push({ type: "fee-removed", fee: p });

  if (prev.tax !== next.tax) changes.push({ type: "tax-changed", before: prev.tax, after: next.tax });
  return changes;
}

/** Carry existing Assignments onto a re-processed Order, by Item key. */
export function carryAssignments(prev: Assignments, next: ParsedOrder): Assignments {
  const out: Assignments = {};
  for (const item of next.items) {
    const a = prev[item.key];
    if (a) out[item.key] = a;
  }
  return out;
}

export function describeChange(c: OrderChange, money: (c: Cents) => string = fmtMoney): string {
  switch (c.type) {
    case "item-added":
      return `New item: ${c.item.name} (${money(c.item.amount)})`;
    case "item-removed":
      return `Removed item: ${c.item.name}`;
    case "item-changed": {
      const st = c.fields.find((f) => f.field === "status");
      const amt = c.fields.find((f) => f.field === "amount");
      if (st && (st.after === "refunded" || st.after === "unavailable")) return `${c.name} was ${st.after === "refunded" ? "refunded" : "marked unavailable"}${amt ? ` (${money(Number(amt.before))})` : ""}`;
      const parts = c.fields.filter((f) => f.field !== "fulfillmentId").map((f) =>
        f.field === "amount" ? `price ${money(Number(f.before))} → ${money(Number(f.after))}` : f.field === "quantity" ? `quantity ${f.before} → ${f.after}` : f.field === "name" ? `now “${f.after}”` : `${f.field} ${f.before} → ${f.after}`);
      return `${c.name}: ${parts.join(", ") || "updated"}`;
    }
    case "fee-added":
      return `New fee: ${c.fee.label} (${money(c.fee.amount)})`;
    case "fee-removed":
      return `Removed fee: ${c.fee.label}`;
    case "fee-changed":
      return `${c.label}: ${money(c.before)} → ${money(c.after)}`;
    case "tax-changed":
      return `Tax: ${money(c.before)} → ${money(c.after)}`;
  }
}

function fmt(field: string, v: unknown, money: (c: Cents) => string): string {
  return field === "amount" && typeof v === "number" ? money(v) : String(v);
}

export function fmtMoney(c: Cents): string {
  const sign = c < 0 ? "-" : "";
  return `${sign}$${(Math.abs(c) / 100).toFixed(2)}`;
}
