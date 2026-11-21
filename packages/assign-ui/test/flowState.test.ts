import { describe, expect, it } from "vitest";
import type { Item } from "@billsplit/core";
import { flowReducer, type FlowAction, type FlowState } from "../src/flowState";

const items: Item[] = [1, 2, 3, 4, 5].map((n) => ({ key: `i${n}`, name: `Item ${n}`, quantity: 1, amount: n * 100, fulfillmentId: "f", status: "ok" }));
const start: FlowState = { assignments: {}, step: 0, lastSplit: null };
const run = (actions: FlowAction[], s = start) => actions.reduce(flowReducer(items), s);
const who = (s: FlowState, key: string) => s.assignments[key]?.shares.map((x) => x.memberId) ?? [];

describe("assignment flow state", () => {
  it("a burst of keys applies to the right cards, never to earlier ones", () => {
    // Exactly what happened in the real-Chrome check: card 1 = S+A, then fast keys on later cards.
    const s = run([
      { type: "toggle", memberId: "S" }, { type: "toggle", memberId: "A" }, { type: "next" },
      { type: "all", memberIds: ["S", "A", "B"] }, { type: "next" },
      { type: "toggle", memberId: "B" }, { type: "next" },
      { type: "toggle", memberId: "A" }, { type: "next" },
      { type: "toggle", memberId: "S" }, { type: "next" },
    ]);
    expect(who(s, "i1")).toEqual(["S", "A"]);
    expect(who(s, "i2")).toEqual(["S", "A", "B"]);
    expect(who(s, "i3")).toEqual(["B"]);
    expect(who(s, "i4")).toEqual(["A"]);
    expect(who(s, "i5")).toEqual(["S"]);
    expect(s.step).toBe(5); // review
  });

  it("Next does nothing until someone is assigned", () => {
    expect(run([{ type: "next" }]).step).toBe(0);
  });

  it("All toggles everyone on, then off; Same as last copies the previous card", () => {
    let s = run([{ type: "all", memberIds: ["S", "A"] }]);
    expect(who(s, "i1")).toEqual(["S", "A"]);
    s = run([{ type: "all", memberIds: ["S", "A"] }], s);
    expect(who(s, "i1")).toEqual([]);
    s = run([{ type: "toggle", memberId: "A" }, { type: "method", method: "parts" }, { type: "patchShare", memberId: "A", patch: { parts: 3 } }, { type: "next" }, { type: "sameAsLast" }], s);
    expect(s.assignments.i2).toEqual({ method: "parts", shares: [{ memberId: "A", parts: 3, amount: undefined }] });
  });

  it("by-amount over the price blocks Next; keys on review do not change cards", () => {
    let s = run([{ type: "toggle", memberId: "S" }, { type: "method", method: "amount" }, { type: "patchShare", memberId: "S", patch: { amount: 999 } }, { type: "next" }]);
    expect(s.step).toBe(0);
    s = run([{ type: "patchShare", memberId: "S", patch: { amount: 100 } }, { type: "next" }], s);
    expect(s.step).toBe(1);
    s = run([{ type: "jump", key: "i5" }, { type: "back" }], s);
    expect(s.step).toBe(3);
  });
});
