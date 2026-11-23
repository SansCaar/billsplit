"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney } from "@billsplit/core";
import { api } from "@/lib/client";
import { fillNudgeLine, NUDGE_LINES } from "@/lib/nudgeLines";

const LIMIT = 3;

function pickThree(): number[] {
  const all = NUDGE_LINES.map((_, i) => i);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j]!, all[i]!]; }
  return all.slice(0, 3);
}

/** On an "X owes you" row: pick one of 3 random lines and send it. */
export function NudgeButton({ groupId, toId, toName, myName, amount, count }: { groupId: string; toId: string; toName: string; myName: string; amount: number; count: number }) {
  const r = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [lines, setLines] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = () => { setLines(pickThree()); setErr(null); dialog.current?.showModal(); };
  const send = async (line: number) => {
    setBusy(true); setErr(null);
    try {
      await api(`/api/groups/${groupId}/nudges`, "POST", { toId, line });
      dialog.current?.close();
      r.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const full = count >= LIMIT;
  return (
    <>
      <button className="btn secondary sm nudge-btn" onClick={open} disabled={full} data-testid={`nudge-${toName}`} title={full ? `You've nudged ${toName} ${LIMIT} times today` : `Nudge ${toName}`}>
        {full ? "Nudged 3×" : "Nudge"}
      </button>
      <dialog ref={dialog} className="nudge-dialog" aria-labelledby={`nudge-title-${toId}`} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }}>
        <h3 id={`nudge-title-${toId}`}>Nudge {toName} for {fmtMoney(amount)}</h3>
        <p className="note">Pick a line. {toName} gets it as a notification{count ? ` (nudged ${count}× today)` : ""}.</p>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="nudge-lines">
          {lines.map((i) => <button key={i} type="button" className="nudge-line" disabled={busy} onClick={() => send(i)}>{fillNudgeLine(i, myName, fmtMoney(amount))}</button>)}
        </div>
        <button type="button" className="link small" onClick={() => dialog.current?.close()}>Cancel</button>
      </dialog>
    </>
  );
}
