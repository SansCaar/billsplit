"use client";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { canAdvance, checkSplit, currentSplit, flowReducer, type FlowAction, type FlowState } from "./flowState";
import {
  fmtMoney,
  resolveSplit,
  splitOrder,
  type Assignments,
  type Item,
  type MemberId,
  type ParsedOrder,
  type Split,
  type SplitMethod,
  type SplitRules,
} from "@billsplit/core";

export interface FlowMember {
  id: MemberId;
  name: string;
  /** Position in the group's member list, for a stable per-person colour. */
  colorIndex?: number;
}

export interface AssignFlowProps {
  order: ParsedOrder;
  members: FlowMember[];
  initialAssignments?: Assignments;
  rules: SplitRules;
  payerId: MemberId | null;
  /** Shown above the first card, e.g. "what changed since last Processing". */
  notice?: React.ReactNode;
  submitLabel?: string;
  /** Open on the Review screen (used when fixing an already-assigned Order). */
  startAtReview?: boolean;
  busy?: boolean;
  error?: string | null;
  onSubmit: (r: { assignments: Assignments; rules: SplitRules; payerId: MemberId }) => void;
}

// Each person gets their own colour, chosen from their name so it's the same on every screen.
const COLORS = ["#d9776b", "#5b8fc7", "#4f9e6e", "#d99a2b", "#9b72c4", "#e0844a", "#3a9c93", "#cf6690", "#7381c9", "#8a9a3b"];
const hash = (s: string) => { let h = 0; for (const c of s.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** Colour by position in the group (unique within a group); falls back to the name when no position is known. */
export const memberColor = (name: string, index?: number) => COLORS[(index !== undefined && index >= 0 ? index : hash(name)) % COLORS.length]!;
const initials = (n: string) => (n.trim()[0] ?? "?").toUpperCase();

/** Initial in a coloured circle. Pass the member's position in the group as `index` so colours never clash. */
export function Avatar({ name, index, size = 36, dim = false }: { name: string; index?: number; size?: number; dim?: boolean }) {
  return (
    <span className="bs-avatar" style={{ width: size, height: size, background: memberColor(name, index), opacity: dim ? 0.4 : 1, fontSize: Math.max(10, Math.round(size * 0.42)) }}>
      {initials(name)}
    </span>
  );
}

const parseDollars = (s: string): number => Math.round(parseFloat(s.replace(/[^0-9.]/g, "") || "0") * 100);

export function AssignFlow(props: AssignFlowProps) {
  const { order, members } = props;
  const assignable = useMemo(() => order.items.filter((i) => i.amount > 0), [order]);
  const zeroItems = useMemo(() => order.items.filter((i) => i.amount <= 0), [order]);
  const reducer = useMemo(() => flowReducer(assignable), [assignable]);
  const [state, dispatch] = useReducer(reducer, undefined, (): FlowState => ({
    assignments: { ...(props.initialAssignments ?? {}) },
    step: props.startAtReview ? assignable.length : 0,
    lastSplit: null,
  }));
  const { assignments, step, lastSplit } = state;
  const [rules, setRules] = useState<SplitRules>(props.rules);
  const [payerId, setPayerId] = useState<MemberId | null>(props.payerId);
  const reviewing = step >= assignable.length;
  const item = assignable[step];
  const fulfillment = (it: Item) => order.fulfillments.find((f) => f.id === it.fulfillmentId);
  const idx = (id: MemberId) => { const m = members.find((x) => x.id === id); return m?.colorIndex ?? members.indexOf(m!); };
  const name = (id: MemberId) => members.find((m) => m.id === id)?.name ?? "?";
  const current = currentSplit(assignable, state);
  const check = checkSplit(item, current);
  const itemError = check ? check.message.replace(/(\d+)¢/g, (_, c) => fmtMoney(Number(c))) : null;
  const canNext = canAdvance(assignable, state);

  // Members/reviewing are read through a ref so the key listener is registered once and never stale;
  // the state changes themselves go through dispatch, which always applies to the latest state.
  // Bring the card/review into view whenever the step changes (e.g. jumping from the review list).
  const rootRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    const el = rootRef.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const live = useRef({ members, reviewing });
  live.current = { members, reviewing };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const { members: ms, reviewing: rv } = live.current;
      if (rv) {
        if (e.key === "ArrowLeft" || e.key === "Backspace") dispatch({ type: "back" });
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const m = ms[Number(e.key) - 1];
        if (m) dispatch({ type: "toggle", memberId: m.id });
      } else if (e.key === "a" || e.key === "A") dispatch({ type: "all", memberIds: ms.map((m) => m.id) });
      else if (e.key === "s" || e.key === "S") dispatch({ type: "sameAsLast" });
      else if (e.key === "Enter" || e.key === "ArrowRight") dispatch({ type: "next" });
      else if (e.key === "ArrowLeft" || e.key === "Backspace") dispatch({ type: "back" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const assignedCount = assignable.filter((i) => (assignments[i.key]?.shares.length ?? 0) > 0).length;
  const progress = assignable.length ? assignedCount / assignable.length : 1;

  return (
    <div className="bs-flow" ref={rootRef}>
      <div className="bs-progress" title={`${assignedCount}/${assignable.length} assigned`}>
        <span className="bs-progress-label">{assignedCount}/{assignable.length} assigned</span>
        <div className="bs-progress-track"><div className="bs-progress-bar" style={{ width: `${progress * 100}%` }} /></div>
      </div>
      {props.notice}
      {!reviewing && item ? (
        <ItemCard
          key={item.key}
          item={item}
          position={step}
          total={assignable.length}
          fulfillmentLabel={order.fulfillments.length > 1 ? fulfillment(item)?.label : undefined}
          members={members}
          split={current}
          error={itemError}
          canNext={canNext}
          hasLast={!!lastSplit}
          dispatch={dispatch}
        />
      ) : (
        <Review
          order={order}
          members={members}
          assignable={assignable}
          zeroItems={zeroItems}
          assignments={assignments}
          rules={rules}
          payerId={payerId}
          idx={idx}
          name={name}
          busy={props.busy}
          error={props.error}
          submitLabel={props.submitLabel ?? "Send to group"}
          onRules={setRules}
          onPayer={setPayerId}
          onJump={(key) => dispatch({ type: "jump", key })}
          onBack={() => dispatch({ type: "back" })}
          onSubmit={() => payerId && props.onSubmit({ assignments, rules, payerId })}
        />
      )}
    </div>
  );
}

function ItemCard(p: {
  item: Item;
  position: number;
  total: number;
  fulfillmentLabel?: string;
  members: FlowMember[];
  split: Split;
  error: string | null;
  canNext: boolean;
  hasLast: boolean;
  dispatch: React.Dispatch<FlowAction>;
}) {
  const { item, split } = p;
  const selected = new Set(split.shares.map((s) => s.memberId));
  const preview = useMemo(() => {
    try {
      return resolveSplit(item.amount, split).shares;
    } catch {
      return new Map<MemberId, number>();
    }
  }, [item, split]);
  const share = (id: MemberId) => split.shares.find((s) => s.memberId === id);
  const setShare = (memberId: MemberId, patch: { parts?: number; amount?: number }) => p.dispatch({ type: "patchShare", memberId, patch });
  const everyone = p.members.length > 0 && p.members.every((m) => selected.has(m.id));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className="bs-item" data-testid="item-card">
      <section className="bs-product">
        <div className="bs-eyebrow">
          Item {p.position + 1} of {p.total}
          {p.fulfillmentLabel ? <> · {p.fulfillmentLabel}</> : null}
        </div>
        <div className="bs-product-body">
          {item.imageUrl ? <img className="bs-img" src={item.imageUrl} alt="" /> : null}
          <div className="bs-product-info">
            <h2 className="bs-item-name" data-testid="item-name">{item.name}</h2>
            <div className="bs-item-meta">
              Qty {item.quantity}
              {item.status === "substituted" ? <span className="bs-tag">Substituted{item.substitutedFor ? ` for ${item.substitutedFor}` : ""}</span> : null}
            </div>
            <div className="bs-item-price">{fmtMoney(item.amount)}</div>
          </div>
        </div>
      </section>

      <section className="bs-editor">
        <div className="bs-editor-head">
          <h3>Who shares this?</h3>
          <div className="bs-shortcuts">
            <button type="button" onClick={() => p.dispatch({ type: "all", memberIds: p.members.map((m) => m.id) })} data-testid="all">{everyone ? "Clear" : "Everyone"}</button>
            <button type="button" onClick={() => p.dispatch({ type: "sameAsLast" })} disabled={!p.hasLast} data-testid="same-as-last">Same as last</button>
          </div>
        </div>
        <div className="bs-seg" role="tablist" aria-label="Split method">
          {(["equal", "parts", "amount"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={split.method === m} className={split.method === m ? "on" : ""} onClick={() => p.dispatch({ type: "method", method: m })}>
              {m === "equal" ? "Equally" : m === "parts" ? "By parts" : "By amount"}
            </button>
          ))}
        </div>
        <div className="bs-people" aria-label="Members">
          {p.members.map((m, i) => {
            const on = selected.has(m.id);
            const s = share(m.id);
            return (
              <div
                key={m.id}
                role="checkbox"
                aria-checked={on}
                aria-pressed={on}
                tabIndex={0}
                className={`bs-person ${on ? "on bs-share-row" : ""}`}
                onClick={() => p.dispatch({ type: "toggle", memberId: m.id })}
                onKeyDown={(e) => { if (e.key === " ") { e.preventDefault(); e.stopPropagation(); p.dispatch({ type: "toggle", memberId: m.id }); } }}
                data-testid={`member-${m.name}`}
              >
                <span className="bs-box">{on ? "✓" : ""}</span>
                <Avatar name={m.name} index={m.colorIndex ?? i} size={30} dim={!on} />
                <span className="bs-person-name bs-share-name">{m.name}</span>
                {i < 9 && <kbd>{i + 1}</kbd>}
                {on && split.method === "parts" && (
                  <span className="bs-stepper" onClick={stop}>
                    <button type="button" aria-label={`fewer parts for ${m.name}`} onClick={() => setShare(m.id, { parts: Math.max(1, (s?.parts ?? 1) - 1) })}>−</button>
                    <b>{s?.parts ?? 1}</b>
                    <button type="button" aria-label={`more parts for ${m.name}`} onClick={() => setShare(m.id, { parts: (s?.parts ?? 1) + 1 })}>+</button>
                  </span>
                )}
                {on && split.method === "amount" ? (
                  <input className="bs-money" aria-label={`amount for ${m.name}`} inputMode="decimal" onClick={stop} onKeyDown={stop}
                    defaultValue={((s?.amount ?? 0) / 100).toFixed(2)} onChange={(e) => setShare(m.id, { amount: parseDollars(e.target.value) })} />
                ) : (
                  <span className="bs-share-amt">{on ? fmtMoney(preview.get(m.id) ?? 0) : ""}</span>
                )}
              </div>
            );
          })}
        </div>
        {p.error && <div className="bs-error">{p.error}</div>}
      </section>

      <div className="bs-nav bs-nav-card">
        <button type="button" className="bs-btn ghost" onClick={() => p.dispatch({ type: "back" })} disabled={p.position === 0}>Back</button>
        <button type="button" className="bs-btn ghost" onClick={() => p.dispatch({ type: "skip" })} data-testid="skip">Skip</button>
        <button type="button" className="bs-btn primary" onClick={() => p.dispatch({ type: "next" })} disabled={!p.canNext} data-testid="next">
          {p.position + 1 === p.total ? "Review" : "Next"}
        </button>
      </div>
    </div>
  );
}

function Review(p: {
  order: ParsedOrder;
  members: FlowMember[];
  assignable: Item[];
  zeroItems: Item[];
  assignments: Assignments;
  rules: SplitRules;
  payerId: MemberId | null;
  idx: (id: MemberId) => number;
  name: (id: MemberId) => string;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onRules: (r: SplitRules) => void;
  onPayer: (id: MemberId) => void;
  onJump: (key: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const result = useMemo(() => splitOrder(p.order, p.assignments, p.rules), [p.order, p.assignments, p.rules]);
  const missing = p.assignable.filter((i) => !(p.assignments[i.key]?.shares.length));
  const ready = missing.length === 0 && !!p.payerId;
  const card = p.order.paymentCards[0];
  return (
    <div className="bs-review" data-testid="review">
      <div className="bs-review-head">
        <div className="bs-eyebrow">Review</div>
        <h2>{missing.length === 0 ? "All assigned — review & send" : `${missing.length} item${missing.length === 1 ? "" : "s"} still need someone`}</h2>
        <div className="bs-review-sub">
          Walmart #…{p.order.orderNumber.slice(-4)}
          {card?.last4 ? ` · paid with ${card.brand} •••• ${card.last4}` : ""}
          {p.order.total !== null ? ` · total ${fmtMoney(p.order.total)}` : ""}
        </div>
      </div>

      <div className="bs-review-controls">
        <label>
          Paid by
          <select value={p.payerId ?? ""} onChange={(e) => p.onPayer(e.target.value)} data-testid="payer">
            <option value="" disabled>Choose…</option>
            {p.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label>
          Tax
          <select value={p.rules.tax} onChange={(e) => p.onRules({ ...p.rules, tax: e.target.value as SplitRules["tax"] })} data-testid="tax-rule">
            <option value="proportional">Proportional</option>
            <option value="equal">Equal</option>
          </select>
        </label>
        <label>
          Fees & tip
          <select value={p.rules.fees} onChange={(e) => p.onRules({ ...p.rules, fees: e.target.value as SplitRules["fees"] })} data-testid="fee-rule">
            <option value="equal">Equal</option>
            <option value="proportional">Proportional</option>
          </select>
        </label>
      </div>

      <div className="bs-totals" data-testid="member-totals">
        {p.members.filter((m) => result.members[m.id]).map((m) => {
          const b = result.members[m.id]!;
          return (
            <div key={m.id} className="bs-total-card">
              <Avatar name={m.name} index={p.idx(m.id)} size={32} />
              <div className="bs-total-name">{m.name}</div>
              <div className="bs-total-amt" data-testid={`total-${m.name}`}>{fmtMoney(b.total)}</div>
              <div className="bs-total-break">items {fmtMoney(b.items)} · tax {fmtMoney(b.tax)}{b.fees ? ` · fees ${fmtMoney(b.fees)}` : ""}</div>
            </div>
          );
        })}
      </div>
      {result.unassignedRemainder !== 0 && missing.length === 0 && (
        <div className="bs-remainder">{fmtMoney(result.unassignedRemainder)} left over from rounding — not added to anyone.</div>
      )}

      <table className="bs-table">
        <tbody>
          {p.assignable.map((i) => {
            const s = p.assignments[i.key];
            return (
              <tr key={i.key} onClick={() => p.onJump(i.key)} className={s?.shares.length ? "" : "bs-missing"}>
                <td className="bs-td-img">{i.imageUrl ? <img src={i.imageUrl} alt="" /> : null}</td>
                <td>{i.name}</td>
                <td className="bs-td-people">
                  {s?.shares.length ? s.shares.map((x) => <Avatar key={x.memberId} name={p.name(x.memberId)} index={p.idx(x.memberId)} size={22} />) : <em>needs someone</em>}
                  {s && s.method !== "equal" ? <span className="bs-chip">{s.method === "parts" ? "parts" : "amount"}</span> : null}
                </td>
                <td className="bs-td-amt">{fmtMoney(i.amount)}</td>
              </tr>
            );
          })}
          {p.order.fees.map((f) => (
            <tr key={f.key} className="bs-fee-row">
              <td />
              <td>{f.label}{f.fulfillmentId && p.order.fulfillments.length > 1 ? ` (${p.order.fulfillments.find((x) => x.id === f.fulfillmentId)?.label})` : ""}</td>
              <td className="bs-td-people">{f.kind === "discount" ? "proportional" : p.rules.fees}</td>
              <td className="bs-td-amt">{fmtMoney(f.amount)}</td>
            </tr>
          ))}
          <tr className="bs-fee-row">
            <td />
            <td>Tax</td>
            <td className="bs-td-people">{p.rules.tax}</td>
            <td className="bs-td-amt">{fmtMoney(p.order.tax)}</td>
          </tr>
          {p.zeroItems.map((i) => (
            <tr key={i.key} className="bs-zero-row">
              <td className="bs-td-img">{i.imageUrl ? <img src={i.imageUrl} alt="" /> : null}</td>
              <td>{i.name}</td>
              <td className="bs-td-people">{i.status}</td>
              <td className="bs-td-amt">$0.00</td>
            </tr>
          ))}
        </tbody>
      </table>

      {p.error && <div className="bs-error" role="alert">{p.error}</div>}
      <div className="bs-nav bs-nav-review">
        <button className="bs-btn ghost" onClick={p.onBack} disabled={!p.assignable.length}>← Back</button>
        <button className="bs-btn primary big" disabled={!ready || p.busy} onClick={p.onSubmit} data-testid="submit">
          {p.busy ? "Sending…" : p.submitLabel}
        </button>
      </div>
    </div>
  );
}
