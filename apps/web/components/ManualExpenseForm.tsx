"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fmtMoney, resolveSplit, type Split, type SplitMethod } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api, toCents } from "@/lib/client";

interface M { id: string; name: string; colorIndex?: number }
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export interface ManualInitial { id?: string; title: string; date: string; amount: number; payerId: string; split: Split }

export function ManualExpenseForm({ groupId, members, allMembers, initial, meId, onCancel }: { groupId: string; members: M[]; allMembers: M[]; initial?: ManualInitial; meId: string; onCancel?: () => void }) {
  const r = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  // Local calendar date, set in the browser (the server may be in UTC).
  const [date, setDate] = useState(initial?.date ?? "");
  useEffect(() => { if (!initial?.date) setDate((d) => d || localToday()); }, [initial?.date]);
  const [amount, setAmount] = useState(initial ? (initial.amount / 100).toFixed(2) : "");
  const [payerId, setPayerId] = useState(initial?.payerId ?? meId);
  const [split, setSplit] = useState<Split>(initial?.split ?? { method: "equal", shares: members.map((m) => ({ memberId: m.id, parts: 1 })) });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const cents = toCents(amount);
  const preview = useMemo(() => { try { return resolveSplit(cents, split); } catch (e) { return { error: (e as Error).message }; } }, [cents, split]);
  const colorIndex = (id: string) => allMembers.find((m) => m.id === id)?.colorIndex ?? allMembers.findIndex((m) => m.id === id);
  const on = (id: string) => split.shares.some((s) => s.memberId === id);
  const share = (id: string) => split.shares.find((s) => s.memberId === id);
  const toggle = (id: string) => setSplit((sp) => ({ ...sp, shares: sp.shares.some((s) => s.memberId === id) ? sp.shares.filter((s) => s.memberId !== id) : [...sp.shares, { memberId: id, parts: 1, amount: 0 }] }));
  const setShare = (id: string, p: { parts?: number; amount?: number }) => setSplit((sp) => ({ ...sp, shares: sp.shares.map((s) => (s.memberId === id ? { ...s, ...p } : s)) }));
  const everyone = members.every((m) => on(m.id));
  const ready = title.trim() && cents > 0 && split.shares.length > 0 && !("error" in preview);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const save = async (another = false) => {
    setErr(null); setBusy(true); setSavedMsg(null);
    try {
      const body = { title, date: date || localToday(), amount: cents, payerId, split };
      if (initial?.id) { await api(`/api/expenses/${initial.id}`, "PATCH", body); onCancel?.(); r.refresh(); }
      else {
        const e = await api<{ _id: string }>(`/api/groups/${groupId}/expenses`, "POST", body);
        if (another) {
          // Entering several bills in a row: keep who paid and the split, clear the rest.
          setSavedMsg(`Added “${title.trim()}” · ${fmtMoney(cents)}`);
          setTitle(""); setAmount("");
          document.getElementById("amount")?.focus();
        } else r.push(`/g/${groupId}?tab=expenses&added=${e._id}`);
        r.refresh();
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const setMethod = (m: SplitMethod) => setSplit((sp) => {
    // Switching to "By amount" starts everyone at an equal share instead of $0.00.
    if (m !== "amount" || sp.method === "amount") return { ...sp, method: m };
    const n = Math.max(1, sp.shares.length);
    return { method: m, shares: sp.shares.map((x) => ({ ...x, amount: Math.floor(cents / n) })) };
  });

  return (
    <div className="two-col">
      <section className="card">
        <label className="field" htmlFor="amount">Amount</label>
        <div className="amount-field"><span>$</span><input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" name="amount" autoFocus={!initial} /></div>
        <label className="field">What was it for?<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Electricity, rent, pizza…" name="title" /></label>
        <div className="field-row">
          <label className="field">Paid by<select value={payerId} onChange={(e) => setPayerId(e.target.value)} name="payer">{members.map((m) => <option key={m.id} value={m.id}>{m.id === meId ? "You" : m.name}</option>)}</select></label>
          <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Split between</h2>
          <button type="button" className="link" onClick={() => setSplit({ ...split, shares: everyone ? [] : members.map((m) => share(m.id) ?? { memberId: m.id, parts: 1, amount: 0 }) })}>{everyone ? "Clear" : "Everyone"}</button>
        </div>
        <span className="seg" role="radiogroup" aria-label="How to split" style={{ marginBottom: 6 }}>
          {(["equal", "parts", "amount"] as SplitMethod[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={split.method === m} className={split.method === m ? "on" : ""} onClick={() => setMethod(m)}>{m === "equal" ? "Equally" : m === "parts" ? "By parts" : "By amount"}</button>
          ))}
        </span>
        <div>
          {members.map((m) => (
            <div key={m.id} className={`person ${on(m.id) ? "on" : ""}`} role="checkbox" aria-checked={on(m.id)} aria-label={m.name} tabIndex={0}
              onClick={() => toggle(m.id)} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(m.id); } }}>
              <span className="box">{on(m.id) ? "✓" : ""}</span>
              <Avatar name={m.name} index={colorIndex(m.id)} size={30} />
              <span className="grow ellipsis">{m.id === meId ? `${m.name} (you)` : m.name}</span>
              {on(m.id) && split.method === "parts" && (
                <span className="stepper" onClick={stop}>
                  <button type="button" aria-label={`fewer parts for ${m.name}`} onClick={() => setShare(m.id, { parts: Math.max(1, (share(m.id)?.parts ?? 1) - 1) })}>−</button>
                  <b>{share(m.id)?.parts ?? 1}</b>
                  <button type="button" aria-label={`more parts for ${m.name}`} onClick={() => setShare(m.id, { parts: (share(m.id)?.parts ?? 1) + 1 })}>+</button>
                </span>
              )}
              {on(m.id) && split.method === "amount" && <input key={`${m.id}:${split.shares.length}`} aria-label={`amount for ${m.name}`} inputMode="decimal" onClick={stop} onKeyDown={stop} defaultValue={((share(m.id)?.amount ?? 0) / 100).toFixed(2)} onChange={(e) => setShare(m.id, { amount: toCents(e.target.value) })} />}
              {on(m.id) && split.method !== "amount" && "shares" in preview && <span className="amt">{fmtMoney(preview.shares.get(m.id) ?? 0)}</span>}
            </div>
          ))}
        </div>
        {"error" in preview ? <div className="err">{String(preview.error).replace(/(\d+)¢/g, (_, c) => fmtMoney(Number(c)))}</div>
          : preview.remainder !== 0 && cents > 0 && split.shares.length > 0 && <p className="note">{fmtMoney(preview.remainder)} left over from rounding — not added to anyone.</p>}
        {split.method === "amount" && "shares" in preview && cents > 0 && (() => { const left = cents - [...preview.shares.values()].reduce((a, b) => a + b, 0); return left > 0 ? <p className="note">{fmtMoney(left)} left to assign.</p> : null; })()}
        {err && <div className="err" role="alert">{err}</div>}
      </section>

      <div className="sticky-bar" style={{ gridColumn: "1 / -1" }}><div>
        {savedMsg && <span className="ok saved-inline" role="status">{savedMsg}</span>}
        {onCancel && <button className="btn secondary" onClick={onCancel}>Cancel</button>}
        {!initial?.id && <button className="btn secondary" onClick={() => save(true)} disabled={!ready || busy} data-testid="save-another">Save &amp; add another</button>}
        <button className="btn primary block" onClick={() => save()} disabled={!ready || busy} data-testid="save-expense">{busy ? "Saving…" : initial?.id ? "Save changes" : cents > 0 ? `Add ${fmtMoney(cents)}` : "Add expense"}</button>
      </div></div>
    </div>
  );
}
