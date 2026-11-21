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
  // While editing, hide the read-only parts of the page so the editor is the focus on small screens.
  useEffect(() => {
    document.body.classList.toggle("editing", editing);
    if (editing) window.scrollTo({ top: 0 });
    return () => document.body.classList.remove("editing");
  }, [editing]);
  const active = group.members.filter((m) => !m.leftAt).map((m) => ({ id: m.id, name: m.name }));
  const all = group.members.map((m) => ({ id: m.id, name: m.name }));
  const idx = (id: string) => group.members.findIndex((m) => m.id === id);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  const del = async (deleted: boolean) => {
    setErr(null);
    try { await api(`/api/expenses/${e._id}`, "PATCH", { deleted }); r.refresh(); } catch (x) { setErr((x as Error).message); }
  };
  const danger = (
    <div className="row" style={{ justifyContent: "center", margin: "6px 0 14px" }}>
      {e.deleted ? <button className="btn" onClick={() => del(false)}>Restore expense</button> : <button className="link-btn danger" onClick={() => confirm("Delete this expense? You can restore it later.") && del(true)}>Delete expense</button>}
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
              <div className="card-head"><h2>Split</h2><span className="badge">{e.split!.method === "equal" ? "equally" : e.split!.method === "parts" ? "by parts" : "by amount"}</span></div>
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
      <section style={{ margin: "0 -4px 14px" }}>
        <div className="row between" style={{ margin: "0 4px 10px" }}>
          <h2>Fix assignments</h2>
          <button className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
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
  const row = (i: Item) => {
    const s = w.assignments[i.key];
    return (
      <li key={i.key} className={`prod ${i.amount <= 0 ? "zero" : ""} ${isMine(i) && filter === "all" ? "mine" : ""}`}>
        {i.imageUrl ? <img src={i.imageUrl} alt="" loading={live.indexOf(i) > 8 ? "lazy" : "eager"} /> : <span className="ph" />}
        <div className="grow">
          <div className="name clamp2">{i.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 3 }}>
            {s?.shares.length ? <span className="avatars" title={s.shares.map((x) => name(x.memberId)).join(", ")}>{s.shares.map((x) => <Avatar key={x.memberId} name={name(x.memberId)} index={idx(x.memberId)} size={20} />)}</span> : null}
            {s && s.method !== "equal" && <span className="badge">{s.method === "parts" ? "by parts" : "by amount"}</span>}
            {i.status !== "ok" && <span className="badge">{i.status}</span>}
            {i.quantity !== 1 && <span className="small faint">qty {i.quantity}</span>}
          </div>
        </div>
        <span className="amt">{fmtMoney(i.amount)}</span>
      </li>
    );
  };

  return (
    <>
      {err && <div className="err">{err}</div>}
      <section className="card flush">
        <div className="card-head">
          <h2>Items</h2>
          <div className="segmented" style={{ margin: 0, width: 170 }}>
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All {live.length}</button>
            <button className={filter === "mine" ? "on" : ""} onClick={() => setFilter("mine")} data-testid="filter-mine">Mine {mineCount}</button>
          </div>
        </div>
        <ul className="list" data-testid="items">
          {shown.map(row)}
          {shown.length === 0 && <li className="empty small">None of these items are assigned to you.</li>}
        </ul>
        {zero.length > 0 && (
          <details style={{ borderTop: "1px solid var(--line)" }}>
            <summary className="link-btn" style={{ padding: "12px 16px", listStyle: "none", cursor: "pointer" }}>{zero.length} unavailable or refunded item{zero.length === 1 ? "" : "s"} · $0.00</summary>
            <ul className="list">{zero.map(row)}</ul>
          </details>
        )}
        <div className="fees">
          {w.order.fees.map((f) => <div key={f.key} className="row between"><span>{f.label}</span><span className="amt">{fmtMoney(f.amount)}</span></div>)}
          <div className="row between"><span>Tax · split {w.rules.tax === "proportional" ? "by what each bought" : "equally"}</span><span className="amt">{fmtMoney(w.order.tax)}</span></div>
        </div>
      </section>
      {danger}
      {!e.deleted && (
        <div className="sticky-bar"><div>
          <button className="btn primary block" onClick={() => setEditing(true)} data-testid="edit">Fix assignments</button>
        </div></div>
      )}
    </>
  );
}
