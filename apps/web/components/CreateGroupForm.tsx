"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
export function CreateGroupForm() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [people, setPeople] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try {
        const g = await api<{ _id: string }>("/api/groups", "POST", { name, placeholderNames: people.split(",").map((s) => s.trim()).filter(Boolean) });
        r.push(`/g/${g._id}`); r.refresh();
      } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <label className="field">Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apartment 4B" required /></label>
      <label className="field">Housemates <span className="muted" style={{ fontWeight: 400 }}>(optional, comma separated)</span><input value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Ayush, Nishant" /></label>
      <p className="note" style={{ marginTop: -4 }}>They can join later with the invite link and claim their name.</p>
      {err && <div className="err">{err}</div>}
      <button className="btn primary" type="submit" disabled={busy || !name.trim()} style={{ marginTop: 6 }}>{busy ? "Creating…" : "Create group"}</button>
    </form>
  );
}
