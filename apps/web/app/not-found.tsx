import Link from "next/link";

export default function NotFound() {
  return (
    <main className="center">
      <div className="auth" style={{ textAlign: "center" }}>
        <div className="brand-mark" style={{ margin: "0 auto 22px" }}>?</div>
        <h1>Nothing here</h1>
        <p className="muted" style={{ margin: "10px 0 24px" }}>This page doesn't exist, or it belongs to a group you're not in. If someone sent you a link, ask them for a fresh invite.</p>
        <Link href="/" className="btn primary">Go to your groups</Link>
        <p className="note" style={{ marginTop: 16 }}>Signed in with the wrong Google account? <a className="link small" href="/api/auth/signout">Sign out and switch</a></p>
      </div>
    </main>
  );
}
