"use client";
import { useEffect } from "react";

/** Feedback pinned to the bottom of the screen, so it's seen wherever the user tapped. */
export function Toast({ children, tone = "ok", onDone, ms = 5000 }: { children: React.ReactNode; tone?: "ok" | "err"; onDone?: () => void; ms?: number }) {
  useEffect(() => {
    if (!onDone || tone === "err") return;
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [onDone, ms, tone, children]);
  return (
    <div className={`toast ${tone}`} role={tone === "err" ? "alert" : "status"}>
      <div className="toast-body">{children}</div>
      {onDone && <button type="button" className="toast-x" aria-label="Dismiss" onClick={onDone}>×</button>}
    </div>
  );
}
