"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@billsplit/core";
import { api } from "@/lib/client";
import { Toast } from "./Toast";

/** "Mark paid / Mark received" right on the balance row, so users don't have to switch tabs to act. */
export function QuickSettle({ groupId, fromId, toId, amount, iPay, otherName }: { groupId: string; fromId: string; toId: string; amount: number; iPay: boolean; otherName: string }) {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  return (
    <>
      <button className="btn secondary sm" disabled={busy} data-testid="quick-settle" onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/groups/${groupId}/settlements`, "POST", { fromId, toId, amount });
          setMsg({ tone: "ok", text: iPay ? `Recorded: you paid ${otherName} ${fmtMoney(amount)}` : `Recorded: ${otherName} paid you ${fmtMoney(amount)}` });
          r.refresh();
        } catch (e) { setMsg({ tone: "err", text: (e as Error).message }); }
        finally { setBusy(false); }
      }}>{busy ? "Saving…" : iPay ? "Mark paid" : "Mark received"}</button>
      {msg && <Toast tone={msg.tone} onDone={() => setMsg(null)}>{msg.text}</Toast>}
    </>
  );
}
