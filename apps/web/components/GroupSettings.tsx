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
  const idx = (id: string) => group.members.findIndex((m) => m.id === id);

  return (
    <>
      {err && <div className="err" role="alert">{err}</div>}
      {msg && <div className="note" role="status" style={{ margin: "0 4px 10px" }}>✓ {msg}</div>}

      <section className="card">
        <div className="card-head"><h2>Invite people</h2>{group.invite.enabled ? <span className="badge">link on</span> : <span className="badge">link off</span>}</div>
        {group.invite.enabled ? (
          <>
            <p className="note" style={{ marginTop: 0 }}>Anyone with this link can join {group.name} and claim their name.</p>
            <div className="copy-box" data-testid="invite-link">{link}</div>
            <div className="row" style={{ marginTop: 10 }}>
              {canShare && <button className="btn primary grow" onClick={() => navigator.share({ title: `Join ${group.name} on Bill Split`, url: link }).catch(() => {})}>Share link</button>}
              <button className={`btn grow ${canShare ? "" : "primary"}`} onClick={() => navigator.clipboard.writeText(link).then(() => setMsg("Link copied"))}>Copy</button>
            </div>
            {isCreator && (
              <div className="row" style={{ marginTop: 6, justifyContent: "flex-end" }}>
                <button className="link-btn" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { regenerate: true }), "New link made — the old one no longer works")}>Make a new link</button>
                <button className="link-btn danger" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: false }), "Invite link turned off")}>Turn off</button>
              </div>
            )}
          </>
        ) : (
          <div className="row between">
            <span className="note">The invite link is off.</span>
            {isCreator && <button className="btn sm" onClick={() => run(() => api(`/api/groups/${group._id}/invite`, "POST", { enabled: true }), "Invite link turned on")}>Turn on</button>}
          </div>
        )}
        {!isCreator && <p className="note">Only the person who created the group can turn the link off.</p>}
      </section>

      <section className="card flush">
        <h2>Members</h2>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id} className="bal-row">
              <Avatar name={m.name} index={idx(m.id)} size={34} />
              <div className="grow">
                <div className="row-title">{m.name}{m.id === meId ? " (you)" : ""}</div>
                <div className="row-sub">{m.userId ? "joined" : "hasn't joined yet"}</div>
              </div>
              <button className="link-btn danger" onClick={() => confirm(`Remove ${m.name} from ${group.name}? They need a $0 balance.`) && run(() => api(`/api/groups/${group._id}/members/${m.id}`, "DELETE"), `${m.name} removed`)}>
                {m.id === meId ? "Leave" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
        <form className="row" style={{ padding: "8px 16px 14px" }} onSubmit={(e) => { e.preventDefault(); if (newName.trim()) run(async () => { await api(`/api/groups/${group._id}/members`, "POST", { name: newName }); setNewName(""); }, "Added"); }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add someone by name" aria-label="New member name" />
          <button className="btn" type="submit">Add</button>
        </form>
      </section>

      <section className="card">
        <h2>Walmart split defaults</h2>
        <p className="note">New orders start with these. Each order can change them while processing.</p>
        <label className="field">Tax
          <div className="segmented" role="radiogroup">
            {(["proportional", "equal"] as const).map((v) => <button key={v} type="button" className={rules.tax === v ? "on" : ""} onClick={() => setRules({ ...rules, tax: v })}>{v === "proportional" ? "By what they bought" : "Equally"}</button>)}
          </div>
        </label>
        <label className="field">Fees & tip
          <div className="segmented" role="radiogroup">
            {(["equal", "proportional"] as const).map((v) => <button key={v} type="button" className={rules.fees === v ? "on" : ""} onClick={() => setRules({ ...rules, fees: v })}>{v === "proportional" ? "By what they bought" : "Equally"}</button>)}
          </div>
        </label>
        <button className="btn block" disabled={JSON.stringify(rules) === JSON.stringify(group.defaults.splitRules)} onClick={() => run(() => api(`/api/groups/${group._id}`, "PATCH", { splitRules: rules }), "Defaults saved")}>Save defaults</button>
      </section>
    </>
  );
}
