"use client";
import { useEffect, useState } from "react";
import { Toast } from "./Toast";

/** The group's invite link with Share (phones) and Copy. */
export function InviteBox({ token, groupName }: { token: string; groupName: string }) {
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); setCanShare(typeof navigator.share === "function"); }, []);
  const link = `${origin}/join/${token}`;
  return (
    <>
      <div className="copy-box" data-testid="invite-link">{link}</div>
      <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
        {canShare && <button className="btn primary sm" onClick={() => navigator.share({ title: `Join ${groupName} on Bill Split`, url: link }).catch(() => {})}>Share invite</button>}
        <button className={`btn sm ${canShare ? "secondary" : "primary"}`} data-testid="copy-invite" onClick={() => navigator.clipboard.writeText(link).then(() => setMsg("Invite link copied. Send it to your housemates."), () => setMsg("Couldn't copy. Select the link above and copy it."))}>Copy link</button>
      </div>
      {msg && <Toast onDone={() => setMsg(null)}>{msg}</Toast>}
    </>
  );
}
