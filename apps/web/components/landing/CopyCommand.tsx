"use client";
import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="lp-cmd">
      <code>{command}</code>
      <button type="button" onClick={async () => { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
