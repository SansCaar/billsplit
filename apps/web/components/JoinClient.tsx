"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@billsplit/assign-ui";
import { api } from "@/lib/client";
export function JoinClient({ token, placeholders }: { token: string; groupId: string; placeholders: { id: string; name: string }[] }) {
  const r = useRouter();
  const [claim, setClaim] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      {placeholders.length > 0 && (
        <>
          <p className="field" style={{ marginBottom: 6 }}>Which one is you?</p>
          {/* Hidden select keeps a simple, testable control alongside the tap targets. */}
          <select className="sr-only" value={claim} onChange={(e) => setClaim(e.target.value)} data-testid="claim" aria-label="Which one is you?">
            <option value="">I'm someone new</option>
            {placeholders.map((p) => <option key={p.id} value={p.id}>I'm {p.name}</option>)}
          </select>
          {[...placeholders.map((p, i) => ({ id: p.id, label: p.name, i: i + 1 })), { id: "", label: "I'm someone new", i: -1 }].map((o) => (
            <button key={o.id || "new"} type="button" className={`toggle-row ${claim === o.id ? "on" : ""}`} onClick={() => setClaim(o.id)}>
              <span className="check">{claim === o.id ? "✓" : ""}</span>
              {o.i >= 0 ? <Avatar name={o.label} index={o.i} size={32} /> : <span className="icon-tile" style={{ width: 32, height: 32, fontSize: 16 }}>＋</span>}
              <span className="grow row-title">{o.label}</span>
            </button>
          ))}
        </>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 12 }} data-testid="join" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const j = await api<{ groupId: string }>(`/api/invite/${token}`, "POST", { claimMemberId: claim || undefined }); r.push(`/g/${j.groupId}`); r.refresh(); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
      }}>{busy ? "Joining…" : "Join group"}</button>
    </div>
  );
}
