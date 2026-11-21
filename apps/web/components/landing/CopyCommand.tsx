"use client";
import { useEffect, useState } from "react";

export type InstallOption = {
  os: string;
  where: string;
  command: string;
  /** Regex source matched against navigator.userAgent (a string: props cross the server/client boundary). */
  detect?: string;
};

/** One-line install command with an OS switcher; preselects the visitor's OS. */
export function CopyCommand({ options }: { options: InstallOption[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const i = options.findIndex((o) => o.detect && new RegExp(o.detect).test(navigator.userAgent));
    if (i >= 0) setActive(i);
  }, [options]);
  const opt = options[active] ?? options[0]!;
  return (
    <div className="lp-cmd-wrap">
      <div className="lp-cmd-tabs" role="tablist" aria-label="Your computer">
        {options.map((o, i) => (
          <button key={o.os} type="button" role="tab" aria-selected={i === active} className={i === active ? "on" : ""} onClick={() => { setActive(i); setCopied(false); }}>
            {o.os}
          </button>
        ))}
      </div>
      <p className="lp-cmd-where">Paste into <b>{opt.where}</b> and press Enter:</p>
      <div className="lp-cmd">
        <code>{opt.command}</code>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(opt.command); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}
