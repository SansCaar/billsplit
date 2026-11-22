import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy · Bill Split" };

const REPO = "https://github.com/SansCaar/billsplit";

export default function Privacy() {
  return (
    <main className="privacy">
      <Link href="/" className="privacy-brand"><span className="brand-mark">b</span>Bill Split</Link>
      <h1>Privacy policy</h1>
      <p className="muted">Last updated November 21, 2026</p>

      <p>
        Bill Split is a free, open-source app for splitting shared costs, with a Chrome extension that splits Walmart
        orders item by item. This page explains what it collects, why, and who can see it. The full source code is on{" "}
        <a href={REPO}>GitHub</a>.
      </p>

      <h2>The website</h2>
      <ul>
        <li><b>Your Google account:</b> when you sign in with Google we get your name, email address and profile photo. They identify you to the people in your groups.</li>
        <li><b>What you add:</b> groups, member names, expenses, payments between members, and a history of every change. Everyone in a group can see that group&apos;s data. People outside the group can&apos;t.</li>
        <li><b>A sign-in cookie</b> keeps you signed in. There are no ads, no analytics and no tracking cookies.</li>
      </ul>

      <h2>The Chrome extension</h2>
      <ul>
        <li>It only runs on walmart.com. It adds a <b>Split this order</b> button to order pages and does nothing else there.</li>
        <li>
          When you click that button, it reads that one order: item names, pictures, quantities and prices, fees, tax,
          totals, the order number and date, and the brand and <b>last 4 digits</b> of the card that paid. It never
          reads full card numbers, your Walmart password, your address or any other page.
        </li>
        <li>The order is kept in the extension&apos;s local storage on your computer. Once you pick a Bill Split group, it is sent to Bill Split so you can split it, and saved in that group as an expense.</li>
        <li>The extension also remembers the last group you used. It doesn&apos;t track your browsing.</li>
      </ul>

      <h2>Who else gets your data</h2>
      <p>
        Nobody, except the companies that host Bill Split: <a href="https://vercel.com">Vercel</a> runs the website,
        and the data is stored in a hosted MongoDB database. We don&apos;t sell or share your data, and we don&apos;t
        use it for anything except running Bill Split.
      </p>

      <h2>Keeping and deleting data</h2>
      <p>
        Group data is kept so the group&apos;s history and balances stay correct. Members can edit or delete expenses
        and payments at any time. To delete your account and the data tied to it,{" "}
        <a href={`${REPO}/issues/new?title=Delete%20my%20data`}>open a request on GitHub</a> without putting personal
        details in it, and we&apos;ll follow up.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update this page and its date.</p>

      <p className="muted">Bill Split isn&apos;t affiliated with Walmart.</p>
    </main>
  );
}
