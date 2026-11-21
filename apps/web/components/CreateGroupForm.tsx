"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
export function CreateGroupForm() {
  const r = useRouter();
  const [name, setName] = useState("");
  const [people, setPeople] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      try {
        const g = await api<{ _id: string }>("/api/groups", "POST", { name, placeholderNames: people.split(",").map((s) => s.trim()).filter(Boolean) });
        r.push(`/g/${g._id}`);
      } catch (x) { setErr((x as Error).message); }
    }}>
      <label className="field">Group name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Apartment 4B" required /></label>
      <label className="field">Other people (comma separated, optional)<input value={people} onChange={(e) => setPeople(e.target.value)} placeholder="Ayush, Nishant" /></label>
      <p className="mute small">They can join later with the invite link and claim their name.</p>
      {err && <div className="err">{err}</div>}
      <button className="btn primary" type="submit">Create group</button>
    </form>
  );
}
