import "./landing.css";
import Link from "next/link";
import { Avatar } from "@billsplit/assign-ui";
import { Story } from "./Story";
import { CopyCommand, type InstallOption } from "./CopyCommand";

const REPO = "https://github.com/SansCaar/billsplit";
const COFFEE = "https://buymeacoffee.com/sanscar";
const RAW = "https://raw.githubusercontent.com/SansCaar/billsplit/main/tools";
const INSTALL: InstallOption[] = [
  { os: "Mac", where: "Terminal", command: `curl -fsSL ${RAW}/install-extension.sh | sh`, detect: "Macintosh|Mac OS X" },
  { os: "Windows", where: "PowerShell", command: `irm ${RAW}/install-extension.ps1 | iex`, detect: "Windows" },
  { os: "Linux", where: "a terminal", command: `curl -fsSL ${RAW}/install-extension.sh | sh`, detect: "Linux|X11" },
];

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-brand"><span className="brand-mark">b</span>Bill Split</Link>
        <nav>
          <a href="#how">How it works</a>
          <a href="#install">Extension</a>
          <Link href="/signin" className="lp-btn sm">Sign in</Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-pill">Free · for households, trips and teams</span>
          <h1>Split the Walmart order, <em>not the friendship.</em></h1>
          <p>Bill Split turns a 40-item grocery order into a fair split in about a minute. Tap who had what, and everyone sees the same balances.</p>
          <div className="lp-cta">
            <Link href="/signin" className="lp-btn">Get started</Link>
            <a href="#how" className="lp-btn ghost">See how it works ↓</a>
          </div>
        </div>
        <div className="lp-hero-art" aria-hidden="true">
          <div className="lp-receipt">
            <div className="lp-receipt-head"><span>Walmart order</span><span>$97.21</span></div>
            {[["Bananas, 2 lb", "$1.48", ["Ayush", "Nishant"]], ["Whole milk", "$4.28", ["You"]], ["Paper towels", "$12.97", ["You", "Ayush", "Nishant"]], ["Cheddar, 8 oz", "$2.97", ["Nishant"]]].map(([n, v, who]) => (
              <div key={n as string} className="lp-receipt-row">
                <span>{n}</span>
                <span className="lp-avs">{(who as string[]).map((w) => <Avatar key={w} name={w} index={["You", "Ayush", "Nishant"].indexOf(w)} size={22} />)}</span>
                <b>{v}</b>
              </div>
            ))}
            <div className="lp-receipt-foot"><span>Your share</span><b>$8.60</b></div>
          </div>
          <div className="lp-float f1"><Avatar name="Ayush" index={1} size={26} /><span>Ayush paid you <b>$14.10</b></span></div>
          <div className="lp-float f2"><span className="lp-tick">✓</span><span>Matches Walmart to the cent</span></div>
        </div>
      </section>

      <Story />

      <section className="lp-features">
        <span className="lp-kicker">Not just Walmart</span>
        <h2>Everything a shared household needs</h2>
        <div className="lp-grid">
          {[
            ["🧾", "Everyday expenses", "Rent, internet, pizza. Split equally, by parts, or by exact amounts."],
            ["⚖️", "Fewest payments", "Settle up suggests the smallest set of payments to get everyone to zero."],
            ["🕑", "Every change on record", "Activity shows who edited what, and how it moved each balance."],
            ["📱", "Works on any phone", "Housemates just open the website. Only the person splitting orders needs Chrome."],
            ["🔗", "One invite link", "Add people by name, share a link, and they claim their spot with history intact."],
            ["🔁", "Orders that change", "Refunds and substitutions? Split again: assignments are kept and the expense updates."],
          ].map(([icon, title, text]) => (
            <div key={title} className="lp-feature"><span className="lp-icon">{icon}</span><h3>{title}</h3><p>{text}</p></div>
          ))}
        </div>
      </section>

      <section className="lp-install" id="install">
        <div>
          <span className="lp-kicker">Chrome extension · Mac, Windows, Linux</span>
          <h2>Install in one line</h2>
          <p>It downloads the extension and opens Chrome with the two clicks left to do.</p>
          <CopyCommand options={INSTALL} />
          <p className="lp-small">Only the person splitting Walmart orders needs it. Open source on <a href={REPO}>GitHub</a>.</p>
        </div>
      </section>

      <section className="lp-final">
        <h2>Ready when your next order lands.</h2>
        <p>Sign in with Google. No password, no card.</p>
        <Link href="/signin" className="lp-btn light">Get started free</Link>
      </section>

      <footer className="lp-foot">
        <div className="lp-support">
          <div>
            <h3>Help shape Bill Split</h3>
            <p>It&apos;s free and open source. Ideas, bug reports and coffee all keep it going.</p>
          </div>
          <div className="lp-support-links">
            <a href={COFFEE} target="_blank" rel="noopener noreferrer" className="lp-coffee">☕ Buy me a coffee</a>
            <a href={`${REPO}/issues/new?template=feature_request.yml`} target="_blank" rel="noopener noreferrer" className="lp-btn ghost sm">💡 Suggest a feature</a>
            <a href={`${REPO}/issues/new?template=bug_report.yml`} target="_blank" rel="noopener noreferrer" className="lp-btn ghost sm">🐞 Report a problem</a>
          </div>
        </div>
        <div className="lp-foot-row">
          <span className="lp-brand small"><span className="brand-mark">b</span>Bill Split</span>
          <span>Not affiliated with Walmart.</span>
          <a href={REPO}>GitHub</a>
        </div>
      </footer>
    </div>
  );
}
