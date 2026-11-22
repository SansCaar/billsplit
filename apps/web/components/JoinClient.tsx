"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@billsplit/assign-ui";
import { api } from "@/lib/client";

/** Pick who you are before joining. Nothing is preselected: a hurried tap must not create a duplicate member. */
export function JoinClient({ token, placeholders, suggestedId }: { token: string; placeholders: { id: string; name: string; index?: number }[]; suggestedId?: string }) {
  const r = useRouter();
  const NEW = "new";
  const [claim, setClaim] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = [...placeholders.map((p, i) => ({ id: p.id, label: p.name, i: p.index ?? i + 1 })), { id: NEW, label: "I'm not on this list", i: -1 }];
  const chosen = opts.find((o) => o.id === claim);
  return (
    <div>
      <div className="auth-label" id="who-label">Which one is you?</div>
      <div role="radiogroup" aria-labelledby="who-label">
        {opts.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={claim === o.id} className={`person ${claim === o.id ? "on" : ""}`} onClick={() => setClaim(o.id)} data-testid={`claim-${o.id === NEW ? "new" : o.label}`}>
            <span className="box radio">{claim === o.id ? "✓" : ""}</span>
            {o.i >= 0 ? <Avatar name={o.label} index={o.i} size={30} /> : <span className="tile" style={{ width: 30, height: 30, fontSize: 14 }}>+</span>}
            <span className="grow">{o.label}</span>
            {o.id === suggestedId && claim === null && <span className="badge">Is this you?</span>}
          </button>
        ))}
      </div>
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 12 }} data-testid="join" disabled={busy || !claim} onClick={async () => {
        setBusy(true);
        try { const j = await api<{ groupId: string }>(`/api/invite/${token}`, "POST", { claimMemberId: claim === NEW ? undefined : claim }); r.push(`/g/${j.groupId}?joined=1`); r.refresh(); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
      }}>{busy ? "Joining…" : !chosen ? "Pick your name to join" : chosen.id === NEW ? "Join as a new member" : `Join as ${chosen.label}`}</button>
      <p className="note" style={{ textAlign: "center", marginTop: 10 }}>Picking your name keeps the expenses already added for you.</p>
    </div>
  );
}
