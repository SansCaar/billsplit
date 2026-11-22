import Link from "next/link";

/** Points people at the Chrome extension from inside the app. Hidden on touch devices, where it can't be used. */
export function ExtensionCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`card ext-card ${compact ? "compact" : ""}`} data-testid="extension-card">
      <span className="ext-mark" aria-hidden="true">🧾</span>
      <div className="grow">
        <h3>Split Walmart orders item by item</h3>
        <p className="note" style={{ margin: "2px 0 0" }}>Add the Bill Split button to walmart.com in Chrome on a computer. Only the person who orders needs it.</p>
      </div>
      <Link className="btn secondary sm" href="/extension">Get the extension</Link>
    </section>
  );
}
