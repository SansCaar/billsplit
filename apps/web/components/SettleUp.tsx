"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api, toCents } from "@/lib/client";

interface M { id: string; name: string; index: number }

export function SettleUp({ groupId, members, suggestions, meId }: { groupId: string; members: M[]; suggestions: { fromId: string; toId: string; amount: number }[]; meId: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(meId);
  const [to, setTo] = useState(members.find((m) => m.id !== meId)?.id ?? "");
  const [amt, setAmt] = useState("");
  const m = (id: string) => members.find((x) => x.id === id)!;
  const label = (id: string) => (id === meId ? "You" : m(id)?.name ?? "?");
  const record = async (key: string, body: { fromId: string; toId: string; amount: number }) => {
    setBusy(key); setErr(null);
    try { await api(`/api/groups/${groupId}/settlements`, "POST", body); setAmt(""); r.refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };
  const sorted = [...suggestions].sort((a, b) => Number(b.fromId === meId || b.toId === meId) - Number(a.fromId === meId || a.toId === meId));
  return (
    <>
      <section className="card flush">
        <div className="card-head"><h2>Settle up</h2><span className="small mute">fewest payments</span></div>
        {err && <div className="err" style={{ margin: "0 16px 8px" }}>{err}</div>}
        {sorted.length === 0 ? <p className="empty small">Everyone is even. 🎉</p> : (
          <ul className="list" data-testid="suggestions">
            {sorted.map((s, i) => (
              <li key={i} className={`pay-row ${s.fromId === meId || s.toId === meId ? "me" : ""}`}>
                <Avatar name={m(s.fromId)?.name ?? "?"} index={m(s.fromId)?.index ?? 0} size={30} />
                <span className="arrow">→</span>
                <Avatar name={m(s.toId)?.name ?? "?"} index={m(s.toId)?.index ?? 0} size={30} />
                <div className="grow">
                  <div className="row-title ellipsis">{label(s.fromId)} → {label(s.toId)}</div>
                  <div className="amt">{fmtMoney(s.amount)}</div>
                </div>
                <button className="btn sm primary" disabled={busy !== null} onClick={() => record(`s${i}`, s)}>{busy === `s${i}` ? "Saving…" : "Mark paid"}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 style={{ marginBottom: 10 }}>Record a payment</h2>
        <div className="field-row">
          <label className="field">From<select value={from} onChange={(e) => setFrom(e.target.value)}>{members.map((x) => <option key={x.id} value={x.id}>{label(x.id)}</option>)}</select></label>
          <label className="field">To<select value={to} onChange={(e) => setTo(e.target.value)}>{members.map((x) => <option key={x.id} value={x.id}>{label(x.id)}</option>)}</select></label>
        </div>
        <label className="field">Amount<input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$0.00" inputMode="decimal" /></label>
        <button className="btn block" disabled={busy !== null || !amt} onClick={() => record("custom", { fromId: from, toId: to, amount: toCents(amt) })}>{busy === "custom" ? "Saving…" : "Save payment"}</button>
      </section>
    </>
  );
}
