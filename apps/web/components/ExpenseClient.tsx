"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney, type Assignments, type SplitRules } from "@billsplit/core";
import { AssignFlow, Avatar } from "@billsplit/assign-ui";
import { api } from "@/lib/client";
import type { ExpenseDoc, GroupDoc } from "@/lib/model";
import { ManualExpenseForm } from "./ManualExpenseForm";

export function ExpenseClient({ expense: e, group, meId }: { expense: ExpenseDoc; group: GroupDoc; meId: string }) {
  const r = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = group.members.filter((m) => !m.leftAt).map((m) => ({ id: m.id, name: m.name }));
  const all = group.members.map((m) => ({ id: m.id, name: m.name }));
  const idx = (id: string) => group.members.findIndex((m) => m.id === id);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";

  const del = async (deleted: boolean) => {
    setErr(null);
    try { await api(`/api/expenses/${e._id}`, "PATCH", { deleted }); r.refresh(); } catch (x) { setErr((x as Error).message); }
  };

  const controls = (
    <div className="row" style={{ marginBottom: 12 }}>
      {!e.deleted && <button className="btn primary" onClick={() => setEditing((v) => !v)} data-testid="edit">{editing ? "Close editor" : e.kind === "walmart" ? "Fix assignments" : "Edit"}</button>}
      {e.deleted ? <button className="btn" onClick={() => del(false)}>Restore</button> : <button className="btn danger" onClick={() => confirm("Delete this expense? It can be restored later.") && del(true)}>Delete</button>}
    </div>
  );

  if (e.kind === "manual") {
    return (
      <>
        {controls}
        {err && <div className="err">{err}</div>}
        {editing && <ManualExpenseForm groupId={group._id} members={active} allMembers={all} meId={meId} initial={{ id: e._id, title: e.title, date: e.date.toString().slice(0, 10), amount: e.amount, payerId: e.payerId, split: e.split! }} />}
      </>
    );
  }

  const w = e.walmart!;
  if (editing) {
    return (
      <section className="panel">
        {controls}
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
  return (
    <section className="panel">
      {controls}
      {err && <div className="err">{err}</div>}
      <h2>Items <span className="mute small">tax {w.rules.tax} · fees {w.rules.fees}</span></h2>
      <table className="items-table" data-testid="items">
        <tbody>
          {w.order.items.map((i) => {
            const s = w.assignments[i.key];
            return (
              <tr key={i.key} style={i.amount === 0 ? { opacity: 0.45 } : undefined}>
                <td>{i.imageUrl ? <img src={i.imageUrl} alt="" /> : null}</td>
                <td>{i.name}{i.status !== "ok" ? <span className="badge" style={{ marginLeft: 6 }}>{i.status}</span> : null}</td>
                <td>{s?.shares.map((x) => <span key={x.memberId} title={name(x.memberId)}><Avatar name={name(x.memberId)} index={idx(x.memberId)} size={22} /></span>)}</td>
                <td className="amt" style={{ textAlign: "right" }}>{fmtMoney(i.amount)}</td>
              </tr>
            );
          })}
          {w.order.fees.map((f) => <tr key={f.key}><td /><td className="mute">{f.label}</td><td /><td className="amt" style={{ textAlign: "right" }}>{fmtMoney(f.amount)}</td></tr>)}
          <tr><td /><td className="mute">Tax</td><td /><td className="amt" style={{ textAlign: "right" }}>{fmtMoney(w.order.tax)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}
