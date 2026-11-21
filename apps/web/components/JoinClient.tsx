"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
export function JoinClient({ token, placeholders }: { token: string; groupId: string; placeholders: { id: string; name: string }[] }) {
  const r = useRouter();
  const [claim, setClaim] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      {placeholders.length > 0 && (
        <label className="field">Are you one of these people?
          <select value={claim} onChange={(e) => setClaim(e.target.value)} data-testid="claim">
            <option value="">No, add me as someone new</option>
            {placeholders.map((p) => <option key={p.id} value={p.id}>I'm {p.name}</option>)}
          </select>
        </label>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn primary" data-testid="join" onClick={async () => {
        try { const j = await api<{ groupId: string }>(`/api/invite/${token}`, "POST", { claimMemberId: claim || undefined }); r.push(`/g/${j.groupId}`); r.refresh(); }
        catch (e) { setErr((e as Error).message); }
      }}>Join group</button>
    </div>
  );
}
