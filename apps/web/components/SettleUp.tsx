"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@billsplit/core";
import { api, toCents } from "@/lib/client";

interface M { id: string; name: string }
interface Rec { id: string; fromId: string; toId: string; amount: number; date: string; deleted: boolean }

export function SettleUp({ groupId, members, suggestions, meId, settlements }: { groupId: string; members: M[]; suggestions: { fromId: string; toId: string; amount: number }[]; meId: string; settlements: Rec[] }) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState(meId);
  const [to, setTo] = useState(members.find((m) => m.id !== meId)?.id ?? "");
  const [amt, setAmt] = useState("");
  const name = (id: string) => (id === meId ? "You" : members.find((x) => x.id === id)?.name ?? "Someone");
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setErr(null);
    try { await fn(); r.refresh(); return true; } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(null); }
  };
  const recorded = settlements.filter((x) => !x.deleted);
  const sorted = [...suggestions].sort((a, b) => Number(b.fromId === meId || b.toId === meId) - Number(a.fromId === meId || a.toId === meId));

  return (
    <div className="two-col" id="repay">
      <section className="card">
        <div className="card-head"><h2>Suggested repayments</h2><span className="badge">Simplified</span></div>
        {err && <div className="err">{err}</div>}
        {sorted.length === 0 ? <p className="note">Everyone is even.</p> : (
          <ul className="list" data-testid="suggestions">
            {sorted.map((s, i) => (
              <li key={i} className="row between" style={{ padding: "12px 0" }}>
                <div><div className="li-title">{name(s.fromId)} → {name(s.toId)}</div><div className="li-sub amt">{fmtMoney(s.amount)}</div></div>
                <button className="btn secondary sm" disabled={busy !== null} onClick={() => run(`s${i}`, () => api(`/api/groups/${groupId}/settlements`, "POST", s))}>
                  {busy === `s${i}` ? "Saving…" : "Record payment"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="note" style={{ marginTop: 14 }}>Suggestions are a guide. Money moves outside this app.</p>
      </section>

      <section className="card">
        <div className="card-head"><h2>Repayments</h2>{!adding && <button className="link" onClick={() => setAdding(true)}>Add repayment</button>}</div>
        {adding && (
          <form className="card" style={{ background: "var(--cream)", marginBottom: 14 }} onSubmit={async (e) => {
            e.preventDefault();
            if (await run("custom", () => api(`/api/groups/${groupId}/settlements`, "POST", { fromId: from, toId: to, amount: toCents(amt) }))) { setAmt(""); setAdding(false); }
          }}>
            <div className="field-row">
              <label className="field">From<select value={from} onChange={(e) => setFrom(e.target.value)}>{members.map((x) => <option key={x.id} value={x.id}>{name(x.id)}</option>)}</select></label>
              <label className="field">To<select value={to} onChange={(e) => setTo(e.target.value)}>{members.map((x) => <option key={x.id} value={x.id}>{name(x.id)}</option>)}</select></label>
            </div>
            <label className="field">Amount<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$0.00" inputMode="decimal" /></label>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn secondary sm" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn primary sm" disabled={busy !== null || !amt}>{busy === "custom" ? "Saving…" : "Save repayment"}</button>
            </div>
          </form>
        )}
        {recorded.length === 0 ? <p className="note">Recorded repayments will appear here.</p> : (
          <ul className="list">
            {recorded.slice(0, 8).map((x) => (
              <li key={x.id} className="row between" style={{ padding: "12px 0" }}>
                <div><div className="li-title">{name(x.fromId)} paid {x.toId === meId ? "you" : name(x.toId)}</div><div className="li-sub">{new Date(x.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></div>
                <div className="row"><span className="amt">{fmtMoney(x.amount)}</span>
                  <button className="link danger small" onClick={() => confirm("Remove this repayment?") && run(`d${x.id}`, () => api(`/api/settlements/${x.id}`, "PATCH", { deleted: true }))}>Undo</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
