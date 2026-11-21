"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api, toCents } from "@/lib/client";

interface M { id: string; name: string; colorIndex: number }
interface Pay { fromId: string; toId: string; amount: number }
interface Rec { id: string; fromId: string; toId: string; amount: number; date: string; note?: string; deleted: boolean }

export function SettleUp({ groupId, members, suggestions, meId, settlements }: { groupId: string; members: M[]; suggestions: Pay[]; meId: string; settlements: Rec[] }) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [custom, setCustom] = useState<{ key: string; amount: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [form, setForm] = useState({ fromId: meId, toId: members.find((m) => m.id !== meId)?.id ?? "", amount: "", note: "" });
  const m = (id: string) => members.find((x) => x.id === id);
  const name = (id: string) => (id === meId ? "You" : m(id)?.name ?? "Someone");
  const av = (id: string, size = 40) => <Avatar name={m(id)?.name ?? "?"} index={m(id)?.colorIndex} size={size} />;

  const record = async (key: string, p: { fromId: string; toId: string; amount: number; note?: string }, msg: string) => {
    if (!(p.amount > 0)) return setErr("Enter an amount");
    setBusy(key); setErr(null); setDone(null);
    try { await api(`/api/groups/${groupId}/settlements`, "POST", p); setDone(msg); setCustom(null); r.refresh(); return true; }
    catch (e) { setErr((e as Error).message); return false; }
    finally { setBusy(null); }
  };
  const undo = async (id: string) => {
    setBusy(id); setErr(null);
    try { await api(`/api/settlements/${id}`, "PATCH", { deleted: true }); setDone("Payment removed"); r.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const mine = suggestions.filter((s) => s.fromId === meId || s.toId === meId);
  const others = suggestions.filter((s) => s.fromId !== meId && s.toId !== meId);
  const history = settlements.filter((s) => !s.deleted);

  const payCard = (s: Pay, i: number) => {
    const key = `m${i}`;
    const iPay = s.fromId === meId;
    const open = custom?.key === key;
    return (
      <div key={key} className="pay-card">
        <div className="pay-flow">{av(s.fromId)}<span className="pay-arrow" aria-hidden>→</span>{av(s.toId)}</div>
        <div className="pay-text">
          <div className="pay-title">{iPay ? <>You pay <b>{name(s.toId)}</b></> : <><b>{name(s.fromId)}</b> pays you</>}</div>
          <div className={`pay-amount ${iPay ? "neg" : "pos"}`}>{fmtMoney(s.amount)}</div>
        </div>
        {open ? (
          <form className="pay-custom" onSubmit={(e) => { e.preventDefault(); record(key, { ...s, amount: toCents(custom!.amount) }, "Payment recorded"); }}>
            <label className="field" style={{ margin: 0 }}>Amount paid<input value={custom!.amount} onChange={(e) => setCustom({ key, amount: e.target.value })} inputMode="decimal" autoFocus /></label>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setCustom(null)}>Cancel</button>
              <button type="submit" className="btn primary grow" disabled={busy !== null}>{busy === key ? "Saving…" : "Record"}</button>
            </div>
          </form>
        ) : (
          <div className="pay-actions">
            <button className="btn primary" disabled={busy !== null} onClick={() => record(key, s, iPay ? `Recorded: you paid ${name(s.toId)} ${fmtMoney(s.amount)}` : `Recorded: ${name(s.fromId)} paid you ${fmtMoney(s.amount)}`)} data-testid="mark-paid">
              {busy === key ? "Saving…" : iPay ? "Mark paid" : "Mark received"}
            </button>
            <button className="btn secondary" onClick={() => setCustom({ key, amount: (s.amount / 100).toFixed(2) })}>Other amount</button>
          </div>
        )}
      </div>
    );
  };

  const picker = (label: string, value: string, set: (id: string) => void, exclude?: string) => (
    <div className="field">
      <span>{label}</span>
      <div className="chip-pick" role="radiogroup" aria-label={label}>
        {members.filter((x) => x.id !== exclude).map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={value === x.id} className={value === x.id ? "on" : ""} onClick={() => set(x.id)}>
            <Avatar name={x.name} index={x.colorIndex} size={24} /><span className="ellipsis">{x.id === meId ? "You" : x.name}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="settle" id="settle" data-testid="settle-up">
      {err && <div className="err" role="alert">{err}</div>}
      {done && <div className="ok" role="status">{done}</div>}

      <section className="card">
        <div className="card-head"><h2>Your payments</h2><span className="badge">Fewest payments</span></div>
        {mine.length ? <div className="pay-list">{mine.map(payCard)}</div> : (
          <div className="settled"><span className="settled-mark">✓</span><div><b>You're settled up</b><div className="note">Nothing for you to pay or collect.</div></div></div>
        )}
        <p className="note" style={{ marginTop: 14 }}>Pay however you like (Venmo, Zelle, cash), then record it here so everyone's balance updates.</p>
      </section>

      {others.length > 0 && (
        <section className="card list-card">
          <div className="card-head"><h2>Between others</h2></div>
          <ul className="list" data-testid="suggestions">
            {others.map((s, i) => (
              <li key={i} className="li">
                <span className="pay-flow sm">{av(s.fromId, 28)}<span className="pay-arrow" aria-hidden>→</span>{av(s.toId, 28)}</span>
                <div className="grow"><div className="li-title ellipsis">{name(s.fromId)} pays {name(s.toId)}</div><div className="li-sub amt">{fmtMoney(s.amount)}</div></div>
                <button className="btn secondary sm" disabled={busy !== null} onClick={() => record(`o${i}`, s, `Recorded: ${name(s.fromId)} paid ${name(s.toId)} ${fmtMoney(s.amount)}`)}>{busy === `o${i}` ? "Saving…" : "Mark paid"}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Record a payment</h2>{!recording && <button className="link" onClick={() => setRecording(true)}>Something else?</button>}</div>
        {!recording ? <p className="note" style={{ margin: 0 }}>Paid a different amount, or between different people? Record it here.</p> : (
          <form onSubmit={async (e) => { e.preventDefault(); if (await record("custom", { fromId: form.fromId, toId: form.toId, amount: toCents(form.amount), note: form.note || undefined }, "Payment recorded")) { setRecording(false); setForm({ ...form, amount: "", note: "" }); } }}>
            {picker("Who paid?", form.fromId, (id) => setForm({ ...form, fromId: id, toId: form.toId === id ? members.find((x) => x.id !== id)?.id ?? "" : form.toId }))}
            {picker("Who got paid?", form.toId, (id) => setForm({ ...form, toId: id }), form.fromId)}
            <div className="field-row">
              <label className="field">Amount<input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="$0.00" inputMode="decimal" /></label>
              <label className="field">Note<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional, e.g. Venmo" /></label>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn secondary" onClick={() => setRecording(false)}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy !== null || !form.amount || !form.toId}>{busy === "custom" ? "Saving…" : "Save payment"}</button>
            </div>
          </form>
        )}
      </section>

      <section className="card list-card">
        <div className="card-head"><h2>History</h2><span className="note">{history.length} payment{history.length === 1 ? "" : "s"}</span></div>
        {history.length === 0 ? <p className="note" style={{ padding: "0 20px 14px" }}>Recorded payments will appear here.</p> : (
          <ul className="list">
            {history.map((x) => (
              <li key={x.id} className="li">
                <span className="pay-flow sm">{av(x.fromId, 28)}<span className="pay-arrow" aria-hidden>→</span>{av(x.toId, 28)}</span>
                <div className="grow">
                  <div className="li-title ellipsis">{name(x.fromId)} paid {x.toId === meId ? "you" : name(x.toId)}</div>
                  <div className="li-sub">{new Date(x.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{x.note ? ` · ${x.note}` : ""}</div>
                </div>
                <div className="li-right"><div className="amt">{fmtMoney(x.amount)}</div><button className="link danger small" disabled={busy !== null} onClick={() => confirm("Remove this payment? Balances will change back.") && undo(x.id)}>Undo</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
