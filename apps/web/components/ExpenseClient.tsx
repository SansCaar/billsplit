"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtMoney, type Assignments, type Item, type SplitRules } from "@billsplit/core";
import { AssignFlow, Avatar } from "@billsplit/assign-ui";
import { api } from "@/lib/client";
import type { ExpenseDoc, GroupDoc } from "@/lib/model";
import { ManualExpenseForm } from "./ManualExpenseForm";

export function ExpenseClient({ expense: e, group, meId }: { expense: ExpenseDoc; group: GroupDoc; meId: string }) {
  const r = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  useEffect(() => {
    document.body.classList.toggle("editing", editing);
    if (editing) window.scrollTo({ top: 0 });
    return () => document.body.classList.remove("editing");
  }, [editing]);
  const colorIndex = (id: string) => group.members.findIndex((m) => m.id === id);
  const active = group.members.filter((m) => !m.leftAt).map((m) => ({ id: m.id, name: m.name, colorIndex: colorIndex(m.id) }));
  const all = group.members.map((m) => ({ id: m.id, name: m.name, colorIndex: colorIndex(m.id) }));
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  const del = async (deleted: boolean) => {
    setErr(null);
    try { await api(`/api/expenses/${e._id}`, "PATCH", { deleted }); r.refresh(); } catch (x) { setErr((x as Error).message); }
  };
  const danger = (
    <div className="row hide-when-editing" style={{ justifyContent: "flex-end", margin: "-6px 0 18px" }}>
      {e.deleted ? <button className="btn secondary sm" onClick={() => del(false)}>Restore expense</button> : <button className="link danger small" onClick={() => confirm("Delete this expense? You can restore it later.") && del(true)}>Delete expense</button>}
    </div>
  );

  if (e.kind === "manual") {
    return (
      <>
        {err && <div className="err">{err}</div>}
        {editing ? (
          <ManualExpenseForm groupId={group._id} members={active} allMembers={all} meId={meId} onCancel={() => setEditing(false)}
            initial={{ id: e._id, title: e.title, date: e.date.toString().slice(0, 10), amount: e.amount, payerId: e.payerId, split: e.split! }} />
        ) : (
          <>
            <section className="card">
              <div className="card-head"><h2>Split</h2><span className="badge">{e.split!.method === "equal" ? "Equally" : e.split!.method === "parts" ? "By parts" : "By amount"}</span></div>
              <p className="note" style={{ margin: 0 }}>{e.split!.shares.map((s) => name(s.memberId) + (e.split!.method === "parts" ? ` ×${s.parts ?? 1}` : "")).join(", ")}</p>
            </section>
            {!e.deleted && <div className="sticky-bar"><div><button className="btn primary block" onClick={() => setEditing(true)} data-testid="edit">Edit expense</button></div></div>}
          </>
        )}
        {danger}
      </>
    );
  }

  const w = e.walmart!;
  if (editing) {
    return (
      <section>
        <div className="row between" style={{ marginBottom: 16 }}>
          <div><span className="eyebrow">Walmart order</span><h2 style={{ marginTop: 4 }}>Fix assignments</h2></div>
          <button className="btn secondary sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
        <AssignFlow
          order={w.order}
          members={active}
          initialAssignments={w.assignments}
          rules={w.rules}
          payerId={e.payerId}
          submitLabel="Save changes"
          startAtReview
          busy={busy}
          error={err}
          onSubmit={async ({ assignments, rules, payerId }: { assignments: Assignments; rules: SplitRules; payerId: string }) => {
            setBusy(true); setErr(null);
            try { await api(`/api/expenses/${e._id}`, "PATCH", { assignments, rules, payerId }); setEditing(false); r.refresh(); }
            catch (x) { setErr((x as Error).message); }
            finally { setBusy(false); }
          }}
        />
      </section>
    );
  }

  const live = w.order.items.filter((i) => i.amount > 0);
  const zero = w.order.items.filter((i) => i.amount <= 0);
  const isMine = (i: Item) => !!w.assignments[i.key]?.shares.some((s) => s.memberId === meId);
  const mineCount = live.filter(isMine).length;
  const shown = filter === "mine" ? live.filter(isMine) : live;
  const row = (i: Item, k: number) => {
    const s = w.assignments[i.key];
    return (
      <li key={i.key} className={`prod ${i.amount <= 0 ? "zero" : ""} ${isMine(i) && filter === "all" ? "mine" : ""}`}>
        {i.imageUrl ? <img src={i.imageUrl} alt="" loading={k > 8 ? "lazy" : "eager"} /> : <span className="ph" />}
        <div className="grow">
          <div className="name clamp2">{i.name}</div>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            {s?.shares.length ? <span className="avatars" title={s.shares.map((x) => name(x.memberId)).join(", ")}>{s.shares.map((x) => <Avatar key={x.memberId} name={name(x.memberId)} index={colorIndex(x.memberId)} size={20} />)}</span> : null}
            {s && s.method !== "equal" && <span className="badge">{s.method === "parts" ? "By parts" : "By amount"}</span>}
            {i.status !== "ok" && <span className="badge plain">{i.status}</span>}
            {i.quantity !== 1 && <span className="small faint">Qty {i.quantity}</span>}
          </div>
        </div>
        <span className="amt">{fmtMoney(i.amount)}</span>
      </li>
    );
  };

  return (
    <>
      {err && <div className="err">{err}</div>}
      <section className="card list-card">
        <div className="card-head">
          <h2>Items</h2>
          <span className="seg">
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All {live.length}</button>
            <button className={filter === "mine" ? "on" : ""} onClick={() => setFilter("mine")} data-testid="filter-mine">Mine {mineCount}</button>
          </span>
        </div>
        <ul className="list" data-testid="items">
          {shown.map(row)}
          {shown.length === 0 && <li className="empty small">None of these items are assigned to you.</li>}
        </ul>
        {zero.length > 0 && (
          <details style={{ borderTop: "1px solid var(--line)" }}>
            <summary className="link" style={{ display: "block", padding: "12px 20px", listStyle: "none", cursor: "pointer" }}>{zero.length} unavailable or refunded · $0.00</summary>
            <ul className="list">{zero.map(row)}</ul>
          </details>
        )}
        <div className="totals">
          {w.order.fees.map((f) => <div key={f.key} className="row between"><span>{f.label}</span><span className="amt">{fmtMoney(f.amount)}</span></div>)}
          <div className="row between"><span>Tax · split {w.rules.tax === "proportional" ? "by what each bought" : "equally"}</span><span className="amt">{fmtMoney(w.order.tax)}</span></div>
        </div>
      </section>
      {!e.deleted && (
        <div className="sticky-bar"><div>
          <button className="btn primary block" onClick={() => setEditing(true)} data-testid="edit">Fix assignments</button>
        </div></div>
      )}
      {danger}
    </>
  );
}
