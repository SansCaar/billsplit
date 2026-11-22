"use client";
import { useEffect, useState } from "react";

const RAW = "https://raw.githubusercontent.com/SansCaar/billsplit/main/tools";
const OPTIONS = [
  { os: "Mac", where: "Terminal", command: `curl -fsSL ${RAW}/install-extension.sh | sh`, detect: /Macintosh|Mac OS X/ },
  { os: "Windows", where: "PowerShell", command: `irm ${RAW}/install-extension.ps1 | iex`, detect: /Windows/ },
  { os: "Linux", where: "a terminal", command: `curl -fsSL ${RAW}/install-extension.sh | sh`, detect: /Linux|X11/ },
];

/** Developer install: a one-line command per OS, preselecting the visitor's. */
export function ExtensionInstall() {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => { const k = OPTIONS.findIndex((o) => o.detect.test(navigator.userAgent)); if (k >= 0) setI(k); }, []);
  const o = OPTIONS[i]!;
  return (
    <div>
      <div className="seg" role="radiogroup" aria-label="Your computer" style={{ marginBottom: 10 }}>
        {OPTIONS.map((x, k) => <button key={x.os} type="button" role="radio" aria-checked={k === i} className={k === i ? "on" : ""} onClick={() => { setI(k); setCopied(false); }}>{x.os}</button>)}
      </div>
      <p className="note" style={{ margin: "0 0 8px" }}>Paste into <b>{o.where}</b> and press Enter:</p>
      <div className="cmd-box"><code>{o.command}</code><button type="button" className="btn secondary sm" onClick={async () => { await navigator.clipboard.writeText(o.command); setCopied(true); }}>{copied ? "Copied ✓" : "Copy"}</button></div>
    </div>
  );
}
