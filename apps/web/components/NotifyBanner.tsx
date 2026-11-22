"use client";
import { useEffect, useState } from "react";
import { enablePush, pushState, type PushState } from "@/lib/pushClient";
import { IosInstallSteps } from "./NotificationSettings";

const DISMISSED = "bs-notify-banner-dismissed";

/** Shown once someone has added an expense or payment, until they turn notifications on or dismiss it. */
export function NotifyBanner() {
  const [state, setState] = useState<PushState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (localStorage.getItem(DISMISSED)) return;
    void pushState().then(setState);
  }, []);
  if (state !== "off" && state !== "ios-install") return null;
  const dismiss = () => { localStorage.setItem(DISMISSED, "1"); setState(null); };
  const turnOn = async () => {
    setErr(null);
    try { setState(await enablePush()); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <section className="card notify-banner" data-testid="notify-banner">
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <div className="grow">
          <h3 style={{ margin: "0 0 4px" }}>Get notified when housemates add expenses or nudge you</h3>
          {state === "off" ? <p className="note" style={{ margin: 0 }}>You choose what to hear about in Settings.</p> : <IosInstallSteps />}
          {err && <div className="err" role="alert" style={{ marginTop: 8 }}>{err}</div>}
        </div>
        <button className="link small" onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
      {state === "off" && <button className="btn primary sm" style={{ marginTop: 10 }} onClick={turnOn}>Turn on notifications</button>}
    </section>
  );
}
