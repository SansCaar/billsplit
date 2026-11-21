"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
export function SignInClient({ google, dev, callbackUrl }: { google: boolean; dev: boolean; callbackUrl: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div>
      {google && <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => signIn("google", { callbackUrl })}>Continue with Google</button>}
      {!google && <p className="mute small">Google sign-in is not configured yet (set AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).</p>}
      {dev && (
        <form onSubmit={(e) => { e.preventDefault(); signIn("dev", { name, email, callbackUrl }); }} style={{ marginTop: 18 }}>
          <p className="mute small">Local dev sign-in</p>
          <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} name="name" required /></label>
          <label className="field">Email<input value={email} onChange={(e) => setEmail(e.target.value)} name="email" type="email" required /></label>
          <button className="btn" type="submit">Dev sign in</button>
        </form>
      )}
    </div>
  );
}
