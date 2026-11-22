import Link from "next/link";
import { AddToChrome } from "@/components/AddToChrome";

export const metadata = { title: "Chrome extension · Bill Split" };

export default function ExtensionPage() {
  return (
    <main className="page">
      <nav className="crumb" aria-label="Breadcrumb"><Link href="/">← Your groups</Link></nav>
      <header className="page-head">
        <div>
          <span className="eyebrow">Chrome extension</span>
          <h1 style={{ marginTop: 8 }}>Split Walmart orders item by item</h1>
          <p className="sub">Adds a <b>🧾 Split this order</b> button to your orders on walmart.com. Only the person who places the orders needs it; everyone else just uses this website.</p>
        </div>
      </header>
      <div className="two-col">
        <section className="card">
          <div className="card-head"><h2>Install</h2><span className="badge">Chrome on a computer</span></div>
          <AddToChrome className="btn primary block" />
          <p className="note">Free, from the Chrome Web Store. Updates itself. Only runs on walmart.com, and only reads an order when you click the button.</p>
          <p className="note">Installed it earlier with the terminal command? Remove that copy in <code>chrome://extensions</code> first, so you don&apos;t get two buttons.</p>
        </section>
        <section className="card">
          <div className="card-head"><h2>Then, for each order</h2></div>
          <ol className="steps">
            <li>Open the order at <a className="link small" href="https://www.walmart.com/orders" target="_blank" rel="noopener noreferrer">walmart.com/orders</a> and click <b>🧾 Split this order</b>.</li>
            <li>Pick the group, then tap who shares each item. <b>Everyone</b> and <b>Same as last</b> save taps.</li>
            <li>Check the totals on Review and press <b>Send to group</b>. It appears here for everyone.</li>
          </ol>
        </section>
      </div>
    </main>
  );
}
