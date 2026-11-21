"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fmtMoney, resolveSplit, type Split, type SplitMethod } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api, toCents } from "@/lib/client";

interface M { id: string; name: string }
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export interface ManualInitial { id?: string; title: string; date: string; amount: number; payerId: string; split: Split }

export function ManualExpenseForm({ groupId, members, allMembers, initial, meId, onCancel }: { groupId: string; members: M[]; allMembers: M[]; initial?: ManualInitial; meId: string; onCancel?: () => void }) {
  const r = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  // Local calendar date (toISOString would give tomorrow's date in the evening in US time zones).
  const [date, setDate] = useState(initial?.date ?? "");
  useEffect(() => { if (!initial?.date) setDate((d) => d || localToday()); }, [initial?.date]);
  const [amount, setAmount] = useState(initial ? (initial.amount / 100).toFixed(2) : "");
  const [payerId, setPayerId] = useState(initial?.payerId ?? meId);
  const [split, setSplit] = useState<Split>(initial?.split ?? { method: "equal", shares: members.map((m) => ({ memberId: m.id, parts: 1 })) });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cents = toCents(amount);
  const preview = useMemo(() => { try { return resolveSplit(cents, split); } catch (e) { return { error: (e as Error).message }; } }, [cents, split]);
  const idx = (id: string) => allMembers.findIndex((m) => m.id === id);
  const on = (id: string) => split.shares.some((s) => s.memberId === id);
  const share = (id: string) => split.shares.find((s) => s.memberId === id);
  const toggle = (id: string) => setSplit((sp) => ({ ...sp, shares: sp.shares.some((s) => s.memberId === id) ? sp.shares.filter((s) => s.memberId !== id) : [...sp.shares, { memberId: id, parts: 1, amount: 0 }] }));
  const setShare = (id: string, p: { parts?: number; amount?: number }) => setSplit((sp) => ({ ...sp, shares: sp.shares.map((s) => (s.memberId === id ? { ...s, ...p } : s)) }));
  const label = (m: M) => (m.id === meId ? `${m.name} (you)` : m.name);
  const short = (m: M) => (m.id === meId ? "You" : m.name);
  const ready = title.trim() && cents > 0 && split.shares.length > 0 && !("error" in preview);

  const save = async () => {
    setErr(null); setBusy(true);
    try {
      const body = { title, date: date || localToday(), amount: cents, payerId, split };
      if (initial?.id) { await api(`/api/expenses/${initial.id}`, "PATCH", body); onCancel?.(); r.refresh(); }
      else { const e = await api<{ _id: string }>(`/api/groups/${groupId}/expenses`, "POST", body); r.push(`/e/${e._id}`); r.refresh(); }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="card">
        <label className="field" htmlFor="amount">Amount</label>
        <div className="money-input"><span>$</span><input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" name="amount" autoFocus={!initial} /></div>
        <label className="field">What was it for?<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Electricity, rent, pizza…" name="title" /></label>
        <div className="field-row">
          <label className="field">Paid by<select value={payerId} onChange={(e) => setPayerId(e.target.value)} name="payer">{members.map((m) => <option key={m.id} value={m.id}>{short(m)}</option>)}</select></label>
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Split</h2><span className="small mute">{split.shares.length} of {members.length}</span></div>
        <div className="segmented" role="tablist">
          {(["equal", "parts", "amount"] as SplitMethod[]).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={split.method === m} className={split.method === m ? "on" : ""} onClick={() => setSplit({ ...split, method: m })}>{m === "equal" ? "Equally" : m === "parts" ? "By parts" : "By amount"}</button>
          ))}
        </div>
        <div>
          {members.map((m) => (
            <div key={m.id} className={`toggle-row ${on(m.id) ? "on" : ""}`} role="checkbox" aria-checked={on(m.id)} aria-label={m.name} tabIndex={0}
              onClick={(e) => { if ((e.target as HTMLElement).closest("input,button.step")) return; toggle(m.id); }}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(m.id); } }}>
              <span className="check">{on(m.id) ? "✓" : ""}</span>
              <Avatar name={m.name} index={idx(m.id)} size={32} />
              <span className="grow row-title ellipsis">{label(m)}</span>
              {on(m.id) && split.method === "parts" && (
                <span className="stepper">
                  <button type="button" className="step" aria-label={`fewer parts for ${m.name}`} onClick={() => setShare(m.id, { parts: Math.max(1, (share(m.id)?.parts ?? 1) - 1) })}>−</button>
                  <b>{share(m.id)?.parts ?? 1}</b>
                  <button type="button" className="step" aria-label={`more parts for ${m.name}`} onClick={() => setShare(m.id, { parts: (share(m.id)?.parts ?? 1) + 1 })}>+</button>
                </span>
              )}
              {on(m.id) && split.method === "amount" && <input aria-label={`amount for ${m.name}`} inputMode="decimal" defaultValue={((share(m.id)?.amount ?? 0) / 100).toFixed(2)} onChange={(e) => setShare(m.id, { amount: toCents(e.target.value) })} />}
              {on(m.id) && split.method !== "amount" && "shares" in preview && <span className="amt">{fmtMoney(preview.shares.get(m.id) ?? 0)}</span>}
            </div>
          ))}
        </div>
        {"error" in preview ? <div className="err">{String(preview.error).replace(/(\d+)¢/g, (_, c) => fmtMoney(Number(c)))}</div>
          : preview.remainder !== 0 && cents > 0 && split.shares.length > 0 && <p className="note">{fmtMoney(preview.remainder)} left over — not added to anyone.</p>}
      </section>
      {err && <div className="err" role="alert">{err}</div>}
      <div className="sticky-bar"><div>
        {onCancel && <button className="btn" onClick={onCancel}>Cancel</button>}
        <button className="btn primary block" onClick={save} disabled={!ready || busy} data-testid="save-expense">{busy ? "Saving…" : initial?.id ? "Save changes" : `Add ${cents > 0 ? fmtMoney(cents) : "expense"}`}</button>
      </div></div>
    </>
  );
}
