import { resolveSplit, type Assignments, type Item, type MemberId, type Split, type SplitMethod } from "@billsplit/core";

/**
 * All assignment-screen state changes go through this reducer, so every click or keypress
 * applies to the *latest* state — never to a stale card (keys can arrive before React re-renders).
 */
export interface FlowState {
  assignments: Assignments;
  /** 0..items.length-1 = item cards; items.length = review. */
  step: number;
  lastSplit: Split | null;
}

export type FlowAction =
  | { type: "toggle"; memberId: MemberId }
  | { type: "all"; memberIds: MemberId[] }
  | { type: "sameAsLast" }
  | { type: "method"; method: SplitMethod }
  | { type: "patchShare"; memberId: MemberId; patch: { parts?: number; amount?: number } }
  | { type: "next" }
  | { type: "skip" }
  | { type: "back" }
  | { type: "jump"; key: string };

const EMPTY: Split = { method: "equal", shares: [] };

export function currentSplit(items: Item[], s: FlowState): Split {
  const item = items[s.step];
  return (item && s.assignments[item.key]) || EMPTY;
}

/** null = ok; otherwise a message, and whether it blocks moving on. */
export function checkSplit(item: Item | undefined, split: Split): { message: string; blocking: boolean } | null {
  if (!item || !split.shares.length) return null;
  try {
    const r = resolveSplit(item.amount, split);
    if (split.method === "amount" && r.remainder > 0) return { message: `${r.remainder}¢ not assigned to anyone`, blocking: false };
    return null;
  } catch (e) {
    return { message: (e as Error).message, blocking: true };
  }
}

export function canAdvance(items: Item[], s: FlowState): boolean {
  const item = items[s.step];
  const split = currentSplit(items, s);
  return !!item && split.shares.length > 0 && !checkSplit(item, split)?.blocking;
}

export function flowReducer(items: Item[]) {
  return (s: FlowState, a: FlowAction): FlowState => {
    const item = items[s.step];
    const cur = currentSplit(items, s);
    const set = (split: Split): FlowState => (item ? { ...s, assignments: { ...s.assignments, [item.key]: split } } : s);
    switch (a.type) {
      case "toggle": {
        if (!item) return s;
        const has = cur.shares.some((x) => x.memberId === a.memberId);
        return set({ ...cur, shares: has ? cur.shares.filter((x) => x.memberId !== a.memberId) : [...cur.shares, { memberId: a.memberId, parts: 1 }] });
      }
      case "all": {
        if (!item) return s;
        const everyone = a.memberIds.every((id) => cur.shares.some((x) => x.memberId === id));
        return set({ ...cur, shares: everyone ? [] : a.memberIds.map((memberId) => cur.shares.find((x) => x.memberId === memberId) ?? { memberId, parts: 1 }) });
      }
      case "sameAsLast":
        return item && s.lastSplit ? set(structuredClone(s.lastSplit)) : s;
      case "method": {
        if (!item) return s;
        const n = Math.max(1, cur.shares.length);
        return set({
          method: a.method,
          shares: cur.shares.map((x) => ({ memberId: x.memberId, parts: x.parts ?? 1, amount: a.method === "amount" ? x.amount ?? Math.floor(item.amount / n) : x.amount })),
        });
      }
      case "patchShare":
        return item ? set({ ...cur, shares: cur.shares.map((x) => (x.memberId === a.memberId ? { ...x, ...a.patch } : x)) }) : s;
      case "next":
        return canAdvance(items, s) ? { ...s, step: s.step + 1, lastSplit: cur } : s;
      case "skip":
        return s.step < items.length ? { ...s, step: s.step + 1 } : s;
      case "back":
        return { ...s, step: Math.max(0, Math.min(s.step, items.length) - 1) };
      case "jump": {
        const i = items.findIndex((x) => x.key === a.key);
        return i >= 0 ? { ...s, step: i } : s;
      }
    }
  };
}
