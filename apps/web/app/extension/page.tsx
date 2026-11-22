import Link from "next/link";
import { ExtensionInstall } from "@/components/ExtensionInstall";

export const metadata = { title: "Chrome extension · Bill Split" };

/** Set NEXT_PUBLIC_EXTENSION_STORE_URL once the extension is on the Chrome Web Store: install becomes one click. */
const STORE = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL;

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
          <div className="card-head"><h2>{STORE ? "Install" : "Install in two minutes"}</h2><span className="badge">Chrome on a computer</span></div>
          {STORE ? (
            <>
              <a className="btn primary block" href={STORE} target="_blank" rel="noopener noreferrer" data-testid="store-link">Add to Chrome</a>
              <p className="note">Free. Updates itself. Only runs on walmart.com, and only reads an order when you click the button.</p>
            </>
          ) : (
            <>
              <ol className="steps">
                <li>Copy the command below and paste it into your computer&apos;s terminal.</li>
                <li>Chrome opens its extensions page. Turn on <b>Developer mode</b> (top right).</li>
                <li>Drag the <b>Bill Split Extension</b> folder that appears onto that page.</li>
              </ol>
              <ExtensionInstall />
              <p className="note">The script only downloads the extension from this project&apos;s <a className="link small" href="https://github.com/SansCaar/billsplit">public GitHub releases</a> into a folder in your home directory. You can read it first.</p>
            </>
          )}
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
