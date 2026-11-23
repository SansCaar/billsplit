"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@billsplit/core";
import { api } from "@/lib/client";

/** Shown on the group after adding an expense: confirms it, and offers View / Undo / Add another. */
export function AddedBanner({ groupId, expenseId, title, amount }: { groupId: string; expenseId: string; title: string; amount: number }) {
  const r = useRouter();
  const [undone, setUndone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clear = () => r.replace(`/g/${groupId}?tab=expenses`, { scroll: false });
  if (undone)
    return <div className="ok added" role="status"><span className="grow">Removed “{title}”.</span><button className="link small" onClick={clear}>Dismiss</button></div>;
  return (
    <div className="ok added" role="status" data-testid="added-banner">
      <span className="grow">Added <b>“{title}”</b> · {fmtMoney(amount)}. Balances are updated for everyone.</span>
      <span className="added-actions">
        <Link className="link small" href={`/e/${expenseId}`}>View</Link>
        <button className="link small" onClick={async () => { try { await api(`/api/expenses/${expenseId}`, "PATCH", { deleted: true }); setUndone(true); r.refresh(); } catch (e) { setErr((e as Error).message); } }}>Undo</button>
        <Link className="link small" href={`/g/${groupId}/new`}>Add another</Link>
      </span>
      {err && <span className="err" style={{ margin: 0 }}>{err}</span>}
    </div>
  );
}
