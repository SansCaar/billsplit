"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fmtMoney, type SplitRules } from "@billsplit/core";
import { api, toCents } from "@/lib/client";
import type { GroupDoc, MemberDoc } from "@/lib/model";

interface Summary {
  group: GroupDoc;
  balances: Record<string, number>;
  suggestions: { fromId: string; toId: string; amount: number }[];
}

export function GroupSide({ summary, isCreator }: { summary: Summary; isCreator: boolean }) {
  const r = useRouter();
  const { group } = summary;
  const members = group.members.filter((m) => !m.leftAt);
  const name = (id: string) => group.members.find((m) => m.id === id)?.name ?? "?";
  const [err, setErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const run = async (fn: () => Promise<unknown>) => {
    setErr(null);
    try { await fn(); r.refresh(); } catch (e) { setErr((e as Error).message); }
  };

  // Record settlement
  const [from, setFrom] = useState(members[0]?.id ?? "");
  const [to, setTo] = useState(members[1]?.id ?? "");
  const [amt, setAmt] = useState("");
  const [newName, setNewName] = useState("");
  const [rules, setRules] = useState<SplitRules>(group.defaults.splitRules);

  return (
    <>
      {err && <div className="err" role="alert">{err}</div>}
      <section className="panel">
        <h2>Settle up</h2>
        {summary.suggestions.length === 0 ? <p className="mute small">Everyone is even. 🎉</p> : (
          <ul className="list" data-testid="suggestions">
            {summary.suggestions.map((s, i) => (
              <li key={i} className="row between">
                <span>{name(s.fromId)} → {name(s.toId)} <b className="amt">{fmtMoney(s.amount)}</b></span>
                <button className="btn" onClick={() => run(() => api(`/api/groups/${group._id}/settlements`, "POST", s))}>Mark paid</button>
              </li>
            ))}
          </ul>
        )}
        <details style={{ marginTop: 10 }}>
          <summary className="mute small">Record a different payment</summary>
          <div className="row wrap" style={{ marginTop: 8 }}>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <span className="mute">paid</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$0.00" style={{ width: 90 }} />
            <button className="btn" onClick={() => run(() => api(`/api/groups/${group._id}/settlements`, "POST", { fromId: from, toId: to, amount: toCents(amt) }))}>Save</button>
          </div>
        </details>
      </section>

      <section className="panel">
        <h2>Members</h2>
        <ul className="list">
          {members.map((m: MemberDoc) => (
            <li key={m.id} className="row between">
              <span>{m.name} {m.userId ? "" : <span className="badge">not joined</span>}</span>
              <button className="btn small" onClick={() => confirm(`Remove ${m.name}?`) && run(() => api(`/api/groups/${group._id}/members/${m.id}`, "DELETE"))}>Remove</button>
            </li>
          ))}
        </ul>
        <div className="row" style={{ marginTop: 8 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add someone by name" />
          <button className="btn" onClick={() => newName.trim() && run(async () => { await api(`/api/groups/${group._id}/members`, "POST", { name: newName }); setNewName(""); })}>Add</button>
        </div>
      </section>

      <section className="panel">
        <h2>Invite link</h2>
        {group.invite.enabled ? (
          <>
            <div className="code" data-testid="invite-link">{origin}/join/{group.invite.token}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => navigator.clipboard.writeText(`${origin}/join/${group.invite.token}`)}>Copy</button>
              {isCreator && <button className="btn" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { regenerate: true }))}>New link</button>}
              {isCreator && <button className="btn danger" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: false }))}>Turn off</button>}
            </div>
          </>
        ) : (
          <div className="row between">
            <span className="mute small">The invite link is off.</span>
            {isCreator && <button className="btn" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: true }))}>Turn on</button>}
          </div>
        )}
        {!isCreator && <p className="mute small">Only the group's creator can turn the link off.</p>}
      </section>

      <section className="panel">
        <h2>Walmart split defaults</h2>
        <p className="mute small">New orders start with these. Each order can override them while processing.</p>
        <div className="row wrap">
          <label className="field">Tax
            <select value={rules.tax} onChange={(e) => setRules({ ...rules, tax: e.target.value as SplitRules["tax"] })}>
              <option value="proportional">Proportional</option><option value="equal">Equal</option>
            </select>
          </label>
          <label className="field">Fees & tip
            <select value={rules.fees} onChange={(e) => setRules({ ...rules, fees: e.target.value as SplitRules["fees"] })}>
              <option value="equal">Equal</option><option value="proportional">Proportional</option>
            </select>
          </label>
        </div>
        <button className="btn" onClick={() => run(() => api(`/api/groups/${group._id}`, "PATCH", { splitRules: rules }))}>Save defaults</button>
      </section>
    </>
  );
}
