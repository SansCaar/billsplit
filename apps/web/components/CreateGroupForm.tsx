"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

/** Split typed text into names: commas, new lines and " and " all separate people. */
const splitNames = (s: string) => s.split(/,|\n|\s+and\s+|\s*&\s*/i).map((x) => x.trim()).filter(Boolean);

export function CreateGroupForm() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = (text: string) => {
    const next = splitNames(text).filter((n) => !people.some((p) => p.toLowerCase() === n.toLowerCase()));
    if (next.length) setPeople((ps) => [...ps, ...next]);
    setDraft("");
  };
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      try {
        const all = [...people, ...splitNames(draft)];
        const g = await api<{ _id: string }>("/api/groups", "POST", { name, placeholderNames: all });
        r.push(`/g/${g._id}`); r.refresh();
      } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <label className="field">Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apartment 4B" required /></label>
      <label className="field" htmlFor="people">Who shares costs with you? <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
      <div className="chips-field">
        {people.map((p) => (
          <span key={p} className="chip">{p}<button type="button" aria-label={`Remove ${p}`} onClick={() => setPeople((ps) => ps.filter((x) => x !== p))}>×</button></span>
        ))}
        <input id="people" value={draft} placeholder={people.length ? "Add another name" : "Ayush, Nishant"} autoComplete="off"
          onChange={(e) => { const v = e.target.value; if (/,\s*$/.test(v)) add(v); else setDraft(v); }}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { e.preventDefault(); add(draft); } else if (e.key === "Backspace" && !draft && people.length) setPeople((ps) => ps.slice(0, -1)); }}
          onBlur={() => draft.trim() && add(draft)} />
      </div>
      <p className="note" style={{ marginTop: 6 }}>Type a name and press Enter. They don&apos;t need accounts: you&apos;ll get an invite link to send them next.</p>
      {err && <div className="err">{err}</div>}
      <button className="btn primary" type="submit" disabled={busy || !name.trim()} style={{ marginTop: 6 }}>{busy ? "Creating…" : "Create group"}</button>
    </form>
  );
}
