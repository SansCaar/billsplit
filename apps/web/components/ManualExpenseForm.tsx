"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fmtMoney, resolveSplit, type Split, type SplitMethod } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api, toCents } from "@/lib/client";

interface M { id: string; name: string }
export interface ManualInitial { id?: string; title: string; date: string; amount: number; payerId: string; split: Split }

export function ManualExpenseForm({ groupId, members, allMembers, initial, meId }: { groupId: string; members: M[]; allMembers: M[]; initial?: ManualInitial; meId: string }) {
  const r = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(initial ? (initial.amount / 100).toFixed(2) : "");
  const [payerId, setPayerId] = useState(initial?.payerId ?? meId);
  const [split, setSplit] = useState<Split>(initial?.split ?? { method: "equal", shares: members.map((m) => ({ memberId: m.id, parts: 1 })) });
  const [err, setErr] = useState<string | null>(null);
  const cents = toCents(amount);
  const preview = useMemo(() => { try { return resolveSplit(cents, split); } catch (e) { return { error: (e as Error).message }; } }, [cents, split]);
  const idx = (id: string) => allMembers.findIndex((m) => m.id === id);
  const on = (id: string) => split.shares.some((s) => s.memberId === id);
  const toggle = (id: string) => setSplit({ ...split, shares: on(id) ? split.shares.filter((s) => s.memberId !== id) : [...split.shares, { memberId: id, parts: 1, amount: 0 }] });
  const setShare = (id: string, p: { parts?: number; amount?: number }) => setSplit({ ...split, shares: split.shares.map((s) => (s.memberId === id ? { ...s, ...p } : s)) });

  const save = async () => {
    setErr(null);
    try {
      const body = { title, date, amount: cents, payerId, split };
      if (initial?.id) { await api(`/api/expenses/${initial.id}`, "PATCH", body); r.push(`/e/${initial.id}`); }
      else { const e = await api<{ _id: string }>(`/api/groups/${groupId}/expenses`, "POST", body); r.push(`/e/${e._id}`); }
      r.refresh();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <label className="field">Description<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Electricity bill" name="title" /></label>
      <div className="row wrap">
        <label className="field">Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" name="amount" /></label>
        <label className="field">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field">Paid by<select value={payerId} onChange={(e) => setPayerId(e.target.value)} name="payer">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      </div>
      <div className="tabs">
        {(["equal", "parts", "amount"] as SplitMethod[]).map((m) => (
          <button key={m} className={`btn ${split.method === m ? "primary" : ""}`} onClick={() => setSplit({ ...split, method: m })}>{m === "equal" ? "Equal" : m === "parts" ? "By parts" : "By amount"}</button>
        ))}
      </div>
      <ul className="list">
        {members.map((m) => (
          <li key={m.id} className="row">
            <input type="checkbox" checked={on(m.id)} onChange={() => toggle(m.id)} aria-label={m.name} />
            <Avatar name={m.name} index={idx(m.id)} size={26} />
            <span style={{ flex: 1 }}>{m.name}</span>
            {on(m.id) && split.method === "parts" && <input type="number" min={1} style={{ width: 70 }} value={split.shares.find((s) => s.memberId === m.id)?.parts ?? 1} onChange={(e) => setShare(m.id, { parts: Math.max(1, Number(e.target.value)) })} />}
            {on(m.id) && split.method === "amount" && <input style={{ width: 90 }} defaultValue={((split.shares.find((s) => s.memberId === m.id)?.amount ?? 0) / 100).toFixed(2)} onChange={(e) => setShare(m.id, { amount: toCents(e.target.value) })} />}
            {on(m.id) && split.method !== "amount" && "shares" in preview && <span className="amt">{fmtMoney(preview.shares.get(m.id) ?? 0)}</span>}
          </li>
        ))}
      </ul>
      {"error" in preview ? <div className="err">{String(preview.error).replace(/(\d+)¢/g, (_, c) => fmtMoney(Number(c)))}</div> : preview.remainder !== 0 && cents > 0 && split.shares.length > 0 && <p className="mute small">{fmtMoney(preview.remainder)} left over — not added to anyone.</p>}
      {err && <div className="err">{err}</div>}
      <button className="btn primary" onClick={save} data-testid="save-expense">Save</button>
    </div>
  );
}
