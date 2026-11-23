"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { NotificationLevel, NotifyPrefs } from "@/lib/model";
import { disablePush, enablePush, pushState, resyncPush, type PushState } from "@/lib/pushClient";

export const LEVEL_LABEL: Record<NotificationLevel, string> = { all: "Everything in the group", involved: "Only what involves me" };

/** This device's on/off switch, plus a test. Shared by Settings and the group-page banner's wording. */
export function DeviceSwitch() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { void pushState().then(setState); }, []);
  const run = async (fn: () => Promise<PushState | void>, ok?: string) => {
    setBusy(true); setMsg(null);
    try { const s = await fn(); if (s) setState(s); if (ok) setMsg({ ok: true, text: ok }); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  const test = async () => {
    let r = await api<{ sent: number }>("/api/push/test", "POST");
    // The server may have dropped this device: register it again and retry once.
    if (!r.sent && (await resyncPush())) r = await api<{ sent: number }>("/api/push/test", "POST");
    if (!r.sent) throw new Error("Couldn't reach this device. Try turning notifications off and on again.");
  };

  if (state === null) return <p className="note">Checking this device…</p>;
  return (
    <>
      {msg && <div className={msg.ok ? "ok" : "err"} role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
      {state === "on" && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="badge">On for this device</span>
          <button className="btn secondary sm" disabled={busy} onClick={() => run(test, "Sent. It should appear in a few seconds. Nothing? Check that notifications are allowed for your browser in your computer's settings.")}>{busy ? "Sending…" : "Send a test"}</button>
          <button className="link small" disabled={busy} onClick={() => run(disablePush)}>Turn off</button>
        </div>
      )}
      {state === "off" && <button className="btn primary" disabled={busy} onClick={() => run(enablePush)} data-testid="notify-on">{busy ? "Turning on… this can take a few seconds" : "Turn on notifications"}</button>}
      {state === "denied" && <p className="note">Notifications are blocked for this site. Allow them in your browser's site settings, then reload this page.</p>}
      {state === "ios-install" && <IosInstallSteps />}
      {state === "unsupported" && <p className="note">This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.</p>}
    </>
  );
}

export function IosInstallSteps() {
  return (
    <div className="note">
      <p style={{ margin: "0 0 6px" }}>On iPhone, notifications only work once Bill Split is on your Home Screen:</p>
      <ol style={{ margin: 0, paddingLeft: 20 }}>
        <li>Tap the <b>Share</b> button in Safari.</li>
        <li>Choose <b>Add to Home Screen</b>.</li>
        <li>Open Bill Split from your Home Screen and turn notifications on.</li>
      </ol>
    </div>
  );
}

export function NotificationSettings({ prefs }: { prefs: NotifyPrefs }) {
  const [level, setLevel] = useState<NotificationLevel>(prefs.level);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (v: NotificationLevel) => {
    const prev = level;
    setLevel(v); setErr(null);
    try { await api("/api/me/notifications", "PATCH", { level: v }); } catch (e) { setLevel(prev); setErr((e as Error).message); }
  };
  return (
    <>
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">This device</span><h2>Notifications</h2></div></div>
        <DeviceSwitch />
        <p className="note" style={{ marginBottom: 0 }}>Turn them on separately on each phone or computer you use.</p>
      </section>
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">All your groups</span><h2>Notify me about</h2></div></div>
        {err && <div className="err" role="alert">{err}</div>}
        <span className="seg" role="radiogroup" aria-label="Notify me about">
          {(["involved", "all"] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={level === v} className={level === v ? "on" : ""} onClick={() => pick(v)}>{LEVEL_LABEL[v]}</button>)}
        </span>
        <p className="note" style={{ marginBottom: 0 }}>
          You can choose differently for any group in its Settings tab. You&apos;re never notified about your own changes, and Nudges always come through.
        </p>
      </section>
    </>
  );
}
