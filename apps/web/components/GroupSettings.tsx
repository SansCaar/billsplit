"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney, type SplitRules } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api } from "@/lib/client";
import type { GroupDoc } from "@/lib/model";
import { InviteBox } from "./InviteBox";
import { Toast } from "./Toast";

export function GroupSettings({ group, isCreator, meId, balances }: { group: GroupDoc; isCreator: boolean; meId: string; balances: Record<string, number> }) {
  const r = useRouter();
  const members = group.members.filter((m) => !m.leftAt);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [rules, setRules] = useState<SplitRules>(group.defaults.splitRules);
  const waiting = members.filter((m) => !m.userId).length;
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setErr(null); setMsg(null);
    try { await fn(); if (done) setMsg(done); r.refresh(); } catch (e) { setErr((e as Error).message); }
  };
  const opt = (v: string) => (v === "proportional" ? "By what each bought" : "Equally");

  return (
    <>
      {err && <Toast tone="err" onDone={() => setErr(null)}>{err}</Toast>}
      {msg && <Toast onDone={() => setMsg(null)}>{msg}</Toast>}
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Invite housemates</h2><span className={`badge ${group.invite.enabled ? "" : "plain"}`}>{group.invite.enabled ? "Link on" : "Link off"}</span></div>
          {group.invite.enabled ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>Anyone with this link can join and claim their name.{waiting ? ` ${waiting} ${waiting === 1 ? "person hasn't" : "people haven't"} joined yet.` : ""}</p>
              <InviteBox token={group.invite.token} groupName={group.name} />
              {isCreator && (
                <div className="row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
                  <button className="link small" onClick={() => confirm(`Make a new invite link?${waiting ? ` ${waiting} ${waiting === 1 ? "person who hasn't" : "people who haven't"} joined yet will need the new one.` : ""} The old link stops working.`) && run(() => api(`/api/groups/${group._id}/invite`, "POST", { regenerate: true }), "New link made. The old one no longer works.")}>New link</button>
                  <button className="link danger small" onClick={() => confirm("Turn off the invite link? Nobody can join until you turn it back on.") && run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: false }), "Invite link turned off")}>Turn off</button>
                </div>
              )}
            </>
          ) : (
            <div className="row between">
              <span className="note">Nobody can join with a link right now.</span>
              {isCreator && <button className="btn secondary sm" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: true }), "Invite link turned on")}>Turn on</button>}
            </div>
          )}
          {!isCreator && <p className="note">Only the person who created the group can turn the link off.</p>}
        </section>

        <section className="card">
          <div className="card-head"><h2>Walmart split defaults</h2></div>
          <p className="note" style={{ marginTop: 0 }}>New orders start with these. Each order can change them while you split it.</p>
          <label className="field" style={{ marginTop: 14 }}>Tax
            <span className="seg">{(["proportional", "equal"] as const).map((v) => <button key={v} type="button" className={rules.tax === v ? "on" : ""} onClick={() => setRules({ ...rules, tax: v })}>{opt(v)}</button>)}</span>
          </label>
          <label className="field">Delivery fees & tip
            <span className="seg">{(["equal", "proportional"] as const).map((v) => <button key={v} type="button" className={rules.fees === v ? "on" : ""} onClick={() => setRules({ ...rules, fees: v })}>{opt(v)}</button>)}</span>
          </label>
          <button className="btn secondary sm" disabled={JSON.stringify(rules) === JSON.stringify(group.defaults.splitRules)} onClick={() => run(() => api(`/api/groups/${group._id}`, "PATCH", { splitRules: rules }), "Defaults saved")}>Save defaults</button>
        </section>
      </div>

      <section className="card list-card" style={{ marginTop: 18 }}>
        <div className="card-head"><h2>Housemates</h2><span className="note">{members.length} people</span></div>
        <ul className="list">
          {members.map((m) => {
            const bal = balances[m.id] ?? 0;
            const verb = m.id === meId ? "Leave" : "Remove";
            return (
              <li key={m.id} className="li" style={{ minHeight: 60 }}>
                <Avatar name={m.name} index={group.members.indexOf(m)} size={34} />
                <div className="grow"><div className="li-title">{m.name}{m.id === meId ? " (you)" : ""}</div><div className="li-sub">{m.userId ? "Joined" : "Hasn't joined yet"}{bal !== 0 ? ` · ${bal > 0 ? "gets back" : "owes"} ${fmtMoney(Math.abs(bal))}` : ""}</div></div>
                {bal === 0
                  ? <button className="link danger small" onClick={() => confirm(m.id === meId ? `Leave ${group.name}?` : `Remove ${m.name} from ${group.name}?`) && run(() => api(`/api/groups/${group._id}/members/${m.id}`, "DELETE"), m.id === meId ? "You left the group" : `${m.name} removed`)}>{verb}</button>
                  : <span className="small muted" title={`Balance must be $0.00 to ${verb.toLowerCase()}`}>Settle up to {verb.toLowerCase()}</span>}
              </li>
            );
          })}
        </ul>
        <form className="row" style={{ padding: "6px 20px 16px" }} onSubmit={(e) => { e.preventDefault(); if (newName.trim()) run(async () => { await api(`/api/groups/${group._id}/members`, "POST", { name: newName }); setNewName(""); }, "Housemate added"); }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add someone by name" aria-label="New housemate name" />
          <button className="btn secondary" type="submit">Add</button>
        </form>
      </section>
    </>
  );
}
