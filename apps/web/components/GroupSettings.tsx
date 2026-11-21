"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SplitRules } from "@billsplit/core";
import { Avatar } from "@billsplit/assign-ui";
import { api } from "@/lib/client";
import type { GroupDoc } from "@/lib/model";

export function GroupSettings({ group, isCreator, meId }: { group: GroupDoc; isCreator: boolean; meId: string }) {
  const r = useRouter();
  const members = group.members.filter((m) => !m.leftAt);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [newName, setNewName] = useState("");
  const [rules, setRules] = useState<SplitRules>(group.defaults.splitRules);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); setCanShare(typeof navigator.share === "function"); }, []);
  const link = `${origin}/join/${group.invite.token}`;
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setErr(null); setMsg(null);
    try { await fn(); if (done) setMsg(done); r.refresh(); } catch (e) { setErr((e as Error).message); }
  };
  const opt = (v: string) => (v === "proportional" ? "By what each bought" : "Equally");

  return (
    <>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="ok" role="status">{msg}</div>}
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Invite housemates</h2><span className={`badge ${group.invite.enabled ? "" : "plain"}`}>{group.invite.enabled ? "Link on" : "Link off"}</span></div>
          {group.invite.enabled ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>Anyone with this link can join and claim their name.</p>
              <div className="copy-box" data-testid="invite-link">{link}</div>
              <div className="row" style={{ marginTop: 12 }}>
                {canShare && <button className="btn primary sm" onClick={() => navigator.share({ title: `Join ${group.name}`, url: link }).catch(() => {})}>Share</button>}
                <button className={`btn sm ${canShare ? "secondary" : "primary"}`} onClick={() => navigator.clipboard.writeText(link).then(() => setMsg("Invite link copied"))}>Copy link</button>
                <span className="grow" />
                {isCreator && <button className="link small" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { regenerate: true }), "New link made. The old one no longer works.")}>New link</button>}
                {isCreator && <button className="link danger small" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: false }), "Invite link turned off")}>Turn off</button>}
              </div>
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
          {members.map((m) => (
            <li key={m.id} className="li" style={{ minHeight: 60 }}>
              <Avatar name={m.name} index={group.members.indexOf(m)} size={34} />
              <div className="grow"><div className="li-title">{m.name}{m.id === meId ? " (you)" : ""}</div><div className="li-sub">{m.userId ? "Joined" : "Hasn't joined yet"}</div></div>
              <button className="link danger small" onClick={() => confirm(`Remove ${m.name}? Their balance needs to be $0.`) && run(() => api(`/api/groups/${group._id}/members/${m.id}`, "DELETE"), `${m.name} removed`)}>{m.id === meId ? "Leave" : "Remove"}</button>
            </li>
          ))}
        </ul>
        <form className="row" style={{ padding: "6px 20px 16px" }} onSubmit={(e) => { e.preventDefault(); if (newName.trim()) run(async () => { await api(`/api/groups/${group._id}/members`, "POST", { name: newName }); setNewName(""); }, "Housemate added"); }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add someone by name" aria-label="New housemate name" />
          <button className="btn secondary" type="submit">Add</button>
        </form>
      </section>
    </>
  );
}
