"use client";
import { useState } from "react";
import { api } from "@/lib/client";
import type { NotificationLevel } from "@/lib/model";
import { LEVEL_LABEL } from "./NotificationSettings";

/** This Group's Notification Level; `null` = use my default. */
export function GroupNotifyLevel({ groupId, level: initial, fallback }: { groupId: string; level: NotificationLevel | null; fallback: NotificationLevel }) {
  const [level, setLevel] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (v: NotificationLevel | null) => {
    const prev = level;
    setLevel(v); setErr(null);
    try { await api("/api/me/notifications", "PATCH", { groupId, level: v }); } catch (e) { setLevel(prev); setErr((e as Error).message); }
  };
  const options: [NotificationLevel | null, string][] = [[null, "My default"], ["involved", LEVEL_LABEL.involved], ["all", LEVEL_LABEL.all]];
  return (
    <section className="card" data-testid="group-notify">
      <div className="card-head"><div><span className="eyebrow">Just for you</span><h2>Notifications for this group</h2></div></div>
      {err && <div className="err" role="alert">{err}</div>}
      <span className="seg" role="radiogroup" aria-label="Notifications for this group">
        {options.map(([v, label]) => <button key={label} type="button" role="radio" aria-checked={level === v} className={level === v ? "on" : ""} onClick={() => pick(v)}>{label}</button>)}
      </span>
      <p className="note" style={{ marginBottom: 0 }}>
        {level === null ? <>Your default is &ldquo;{LEVEL_LABEL[fallback]}&rdquo;. Change it, and turn notifications on for this device, in <a className="link small" href="/settings">Settings</a>.</> : <>Turn notifications on for this device in <a className="link small" href="/settings">Settings</a>.</>}
      </p>
    </section>
  );
}
